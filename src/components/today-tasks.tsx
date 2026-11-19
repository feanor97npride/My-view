"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionToast, BentoCard, type ToastAction } from "@/components/ui";
import { startFocusTimer } from "@/lib/focus-timer";
import RetryNotice from "@/components/retry-notice";

export type TodayTask = {
  id: string;
  title: string;
  list: string;
  listId: string;
  status: string;
  bucket: "overdue" | "today" | "week" | "later" | "nodate";
  url: string;
  origin?: { emailId: string; subject: string; url: string }; // the e-mail this task came from
};

type Statuses = Record<string, string[]>; // listId -> status names

type Toast = ToastAction;

async function post<T extends Record<string, unknown> = Record<string, unknown>>(
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/tasks/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, data: j } : { ok: false, error: j.error ?? `Erro ${res.status}` };
  } catch {
    return { ok: false, error: "Falha de conexão ao executar a ação." };
  }
}

export default function TodayTasks({
  tasks: initial,
  statuses,
  tasksError,
  replan,
}: {
  tasks: TodayTask[];
  replan: { taskId: string; date: string }[]; // proposed new day for every overdue task
  statuses: Statuses;
  tasksError: string | null;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  useEffect(() => setTasks(initial), [initial]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showToast = (label: string, undo: () => Promise<void>, extra?: Toast["extra"]) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ label, undo, extra });
    timer.current = setTimeout(() => setToast(null), 6000);
  };

  const mark = (id: string, on: boolean) =>
    setBusy((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  // Runs an optimistic change, rolls back and shows the error when the server refuses.
  const run = async <T extends Record<string, unknown>>(
    t: TodayTask,
    optimistic: () => void,
    body: unknown,
    onDone: (data: T) => { label: string; undo: () => Promise<{ ok: boolean; error?: string }>; extra?: Toast["extra"] },
  ) => {
    if (busy.has(t.id)) return;
    setError(null);
    mark(t.id, true);
    const before = tasks;
    optimistic();
    const r = await post<T>(body);
    mark(t.id, false);
    if (!r.ok) {
      setTasks(before);
      setError(r.error);
      return;
    }
    const { label, undo, extra } = onDone(r.data);
    showToast(
      label,
      async () => {
        setTasks(before);
        const u = await undo();
        if (!u.ok) setError(u.error ?? "Não foi possível desfazer.");
        router.refresh();
      },
      extra,
    );
    router.refresh();
  };

  const remove = (id: string) => setTasks((prev) => prev.filter((x) => x.id !== id));

  const complete = (t: TodayTask) =>
    run<{ prevStatus?: string }>(t, () => remove(t.id), { action: "complete", taskId: t.id }, (d) => ({
      label: "Tarefa concluída",
      extra: t.origin
        ? {
            label: "Arquivar e-mail de origem",
            run: async () => {
              const r = await fetch("/api/emails/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "archive", id: t.origin!.emailId }),
              });
              if (!r.ok) setError("Não foi possível arquivar o e-mail de origem.");
            },
          }
        : undefined,
      undo: async () => {
        const r = await post({ action: "restoreStatus", taskId: t.id, status: d.prevStatus ?? t.status });
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      },
    }));

  const postpone = (t: TodayTask, arg: { kind: string } | { date: string }, label: string) =>
    run<{ prevDueMs?: number | null }>(t, () => remove(t.id), { action: "postpone", taskId: t.id, ...arg }, (d) => ({
      label: `Adiada: ${label}`,
      undo: async () => {
        const r = await post({ action: "restoreDue", items: [{ taskId: t.id, dueMs: d.prevDueMs ?? null }] });
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      },
    }));

  const setStatus = (t: TodayTask, status: string) => {
    if (!status || status === t.status) return;
    return run<{ prevStatus?: string }>(
      t,
      () => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x))),
      { action: "setStatus", taskId: t.id, status },
      (d) => ({
        label: `Status: ${status}`,
        undo: async () => {
          const r = await post({ action: "restoreStatus", taskId: t.id, status: d.prevStatus ?? t.status });
          return r.ok ? { ok: true } : { ok: false, error: r.error };
        },
      }),
    );
  };

  const row = (t: TodayTask) => {
    const options = statuses[t.listId] ?? [];
    const disabled = busy.has(t.id);
    return (
      <li key={t.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-bg p-4 transition-colors hover:border-line-strong">
        <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink no-underline hover:underline">
          {t.title}
          <span className="sr-only"> (abre no ClickUp, em nova aba)</span>
        </a>
        <span className="flex flex-wrap items-center gap-2">
          <span className={`chip ${t.bucket === "overdue" ? "chip-red" : "chip-amber"}`}>{t.bucket === "overdue" ? "Atrasada" : "Hoje"}</span>
          <span className="text-[13px] text-mute">{t.list} · {t.status}</span>
        </span>
        {t.origin && (
          <a href={t.origin.url} target="_blank" rel="noopener noreferrer" className="truncate text-[13px] text-mute no-underline hover:underline">
            ✉ Veio de: {t.origin.subject}
            <span className="sr-only"> (abre no Gmail, em nova aba)</span>
          </a>
        )}
        <span className="flex flex-wrap items-center gap-2 pt-0.5">
          <button type="button" disabled={disabled} onClick={() => complete(t)} className="btn btn-primary spring-btn min-h-9 px-3.5 py-1 text-[13px] disabled:opacity-50">
            Concluir
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => startFocusTimer({ title: t.title, minutes: 25, taskId: t.id })}
            title="Iniciar sessão de foco de 25 min para esta tarefa"
            className="btn spring-btn min-h-9 px-3 py-1 text-[13px] disabled:opacity-50"
          >
            ▶ Focar 25m
          </button>
          <details className="relative">
            <summary className="btn min-h-9 list-none px-3 py-1 text-[13px] [&::-webkit-details-marker]:hidden">Adiar ▾</summary>
            <div className="absolute left-0 z-20 mt-1 flex w-56 flex-col gap-1 rounded-2xl border border-line-strong bg-card p-2 shadow-lg">
              <button type="button" disabled={disabled} onClick={() => postpone(t, { kind: "tomorrow" }, "amanhã")} className="min-h-9 rounded-xl bg-transparent px-3 text-left text-sm text-ink hover:bg-primary-soft">
                Amanhã
              </button>
              <button type="button" disabled={disabled} onClick={() => postpone(t, { kind: "nextBusiness" }, "próximo dia útil")} className="min-h-9 rounded-xl bg-transparent px-3 text-left text-sm text-ink hover:bg-primary-soft">
                Próximo dia útil
              </button>
              <button type="button" disabled={disabled} onClick={() => postpone(t, { kind: "monday" }, "segunda-feira")} className="min-h-9 rounded-xl bg-transparent px-3 text-left text-sm text-ink hover:bg-primary-soft">
                Segunda-feira
              </button>
              <label className="flex flex-col gap-1 px-3 py-1 text-xs text-mute">
                Escolher data
                <input
                  type="date"
                  disabled={disabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) postpone(t, { date: v }, v.split("-").reverse().join("/"));
                  }}
                  className="min-h-9 rounded-xl border border-line-strong bg-card px-2 text-sm text-ink"
                />
              </label>
            </div>
          </details>
          {options.length > 1 && (
            <label className="flex items-center">
              <span className="sr-only">Mudar status</span>
              <select
                value={t.status}
                disabled={disabled}
                onChange={(e) => setStatus(t, e.target.value)}
                className="min-h-9 rounded-xl border border-line-strong bg-card px-2 text-[13px] text-ink disabled:opacity-50"
              >
                {!options.includes(t.status) && <option value={t.status}>{t.status}</option>}
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          )}
        </span>
      </li>
    );
  };

  const overdueLeft = tasks.filter((t) => t.bucket === "overdue").length;
  const fmtDay = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
  const plan = replan.filter((p) => tasks.some((t) => t.id === p.taskId && t.bucket === "overdue"));

  const applyReplan = async () => {
    if (plan.length === 0 || replanning) return;
    setError(null);
    setReplanning(true);
    const before = tasks;
    const ids = new Set(plan.map((p) => p.taskId));
    setTasks((prev) => prev.filter((x) => !ids.has(x.id)));
    setPreview(false);
    const r = await post<{ prev?: { taskId: string; dueMs: number | null }[]; failed?: string[] }>({ action: "postponeMany", items: plan });
    setReplanning(false);
    if (!r.ok) {
      setTasks(before);
      setError(r.error);
      return;
    }
    const failed = new Set(r.data.failed ?? []);
    if (failed.size > 0) {
      setTasks((prev) => [...prev, ...before.filter((x) => failed.has(x.id))]);
      setError(`${failed.size} tarefa(s) não puderam ser adiadas.`);
    }
    const prev = r.data.prev ?? [];
    showToast(`${prev.length} atrasadas replanejadas`, async () => {
      setTasks(before);
      const u = await post({ action: "restoreDue", items: prev });
      if (!u.ok) setError(u.error);
      router.refresh();
    });
    router.refresh();
  };

  return (
    <BentoCard>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold">Fazer agora</h2>
        {overdueLeft > 0 && (
          <span className="text-[13px] font-semibold" style={{ color: "var(--red-fg)" }}>{overdueLeft} atrasadas</span>
        )}
      </div>
      {overdueLeft > 0 && replan.length > 0 && (
        <div className="my-2 flex flex-col gap-2">
          <button type="button" onClick={() => setPreview((v) => !v)} aria-expanded={preview} className="btn spring-btn min-h-9 self-start px-3 py-1 text-[13px]">
            Replanejar atrasadas
          </button>
          {preview && (
            <div className="flex flex-col gap-2 rounded-2xl border border-line-strong p-3" style={{ background: "var(--surface-3)" }}>
              <p className="m-0 text-xs text-mute">Nova data de cada atrasada, distribuídas pelos próximos dias úteis:</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                {plan.map((p) => (
                  <li key={p.taskId} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{tasks.find((t) => t.id === p.taskId)?.title}</span>
                    <span className="shrink-0 font-semibold tabular-nums">→ {fmtDay(p.date)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button type="button" disabled={replanning} onClick={applyReplan} className="btn btn-primary spring-btn min-h-9 px-3 py-1 text-[13px] disabled:opacity-50">
                  {replanning ? "Aplicando…" : `Aplicar a ${plan.length}`}
                </button>
                <button type="button" onClick={() => setPreview(false)} className="btn spring-btn min-h-9 px-3 py-1 text-[13px]">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="chip-red my-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="btn min-h-8 px-2.5 py-1 text-xs">Fechar</button>
        </div>
      )}
      {tasksError && <RetryNotice message={`ClickUp indisponível: ${tasksError}`} />}
      {!tasksError && tasks.length === 0 && <p className="text-mute">Nada atrasado nem para hoje.</p>}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{tasks.slice(0, 4).map(row)}</ul>
      {tasks.length > 4 && (
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary-ink">
            Ver as outras {tasks.length - 4} atrasadas ou para hoje
          </summary>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{tasks.slice(4).map(row)}</ul>
        </details>
      )}

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </BentoCard>
  );
}
