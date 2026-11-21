"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionToast, BentoCard, type ToastAction } from "@/components/ui";
import { startFocusTimer } from "@/lib/focus-timer";

export type ClickupBoardTask = {
  id: string;
  title: string;
  list: string;
  listId: string;
  status: string;
  bucket: "overdue" | "today" | "upcoming" | "none";
  dueLabel: string | null;
  priority: string | null;
  url: string;
  origin?: { subject: string; url: string };
};

export type ClickupListOption = { id: string; name: string };

const BUCKET_META: Record<ClickupBoardTask["bucket"], { label: string; chip: string }> = {
  overdue: { label: "Atrasada", chip: "chip-red" },
  today: { label: "Hoje", chip: "chip-amber" },
  upcoming: { label: "Próximas", chip: "chip-blue" },
  none: { label: "Sem prazo", chip: "chip-slate" },
};

async function postTaskAction<T extends Record<string, unknown> = Record<string, unknown>>(
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

export default function ClickupBoard({
  initialTasks,
  lists,
  statuses,
  defaultListId,
}: {
  initialTasks: ClickupBoardTask[];
  lists: ClickupListOption[];
  statuses: Record<string, string[]>;
  defaultListId: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<ClickupBoardTask[]>(initialTasks);
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const [q, setQ] = useState("");
  const [listFilter, setListFilter] = useState<string>("all");
  const [bucketFilter, setBucketFilter] = useState<"all" | ClickupBoardTask["bucket"]>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  const [newTitle, setNewTitle] = useState("");
  const [newListId, setNewListId] = useState(defaultListId);
  const [newDue, setNewDue] = useState<"today" | "tomorrow" | "none">("today");
  const [creating, setCreating] = useState(false);

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastAction | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showToast = (label: string, undo: () => Promise<void>) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ label, undo });
    timer.current = setTimeout(() => setToast(null), 6000);
  };

  const markBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    setError(null);
    const res = await postTaskAction<{ id?: string; url?: string }>({
      action: "create",
      title: newTitle.trim(),
      due: newDue,
      listId: newListId,
    });
    setCreating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNewTitle("");
    router.refresh();
  };

  const complete = async (t: ClickupBoardTask) => {
    if (busyIds.has(t.id)) return;
    setError(null);
    markBusy(t.id, true);
    const before = tasks;
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    const r = await postTaskAction<{ prevStatus?: string }>({ action: "complete", taskId: t.id });
    markBusy(t.id, false);
    if (!r.ok) {
      setTasks(before);
      setError(r.error);
      return;
    }
    const prevStatus = r.data.prevStatus;
    showToast("Tarefa concluída", async () => {
      setTasks(before);
      if (prevStatus) {
        const u = await postTaskAction({ action: "restoreStatus", taskId: t.id, status: prevStatus });
        if (!u.ok) setError(u.error);
      }
      router.refresh();
    });
    router.refresh();
  };

  const setStatus = async (t: ClickupBoardTask, nextStatus: string) => {
    if (nextStatus === t.status || busyIds.has(t.id)) return;
    setError(null);
    markBusy(t.id, true);
    const before = tasks;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: nextStatus } : x)));
    const r = await postTaskAction<{ prevStatus?: string }>({ action: "setStatus", taskId: t.id, status: nextStatus });
    markBusy(t.id, false);
    if (!r.ok) {
      setTasks(before);
      setError(r.error);
      return;
    }
    const prevStatus = r.data.prevStatus ?? t.status;
    showToast(`Status alterado para ${nextStatus}`, async () => {
      setTasks(before);
      const u = await postTaskAction({ action: "restoreStatus", taskId: t.id, status: prevStatus });
      if (!u.ok) setError(u.error);
      router.refresh();
    });
    router.refresh();
  };

  const postpone = async (t: ClickupBoardTask, payload: { kind?: string; date?: string }, label: string) => {
    if (busyIds.has(t.id)) return;
    setError(null);
    markBusy(t.id, true);
    const before = tasks;
    const r = await postTaskAction<{ prevDueMs?: number | null; date?: string }>({
      action: "postpone",
      taskId: t.id,
      ...payload,
    });
    markBusy(t.id, false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setTasks((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? {
              ...x,
              bucket: "upcoming",
              dueLabel: r.data.date ? r.data.date.split("-").reverse().slice(0, 2).join("/") : label,
            }
          : x,
      ),
    );
    const prevDueMs = r.data.prevDueMs ?? null;
    showToast(`Adiada para ${label}`, async () => {
      setTasks(before);
      const u = await postTaskAction({ action: "restoreDue", items: [{ taskId: t.id, dueMs: prevDueMs }] });
      if (!u.ok) setError(u.error);
      router.refresh();
    });
    router.refresh();
  };

  const counts = useMemo(() => {
    const c = { total: tasks.length, overdue: 0, today: 0, upcoming: 0, none: 0 };
    for (const t of tasks) c[t.bucket]++;
    return c;
  }, [tasks]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (listFilter !== "all" && t.listId !== listFilter) return false;
      if (bucketFilter !== "all" && t.bucket !== bucketFilter) return false;
      if (query && !t.title.toLowerCase().includes(query) && !t.list.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [tasks, q, listFilter, bucketFilter]);

  const renderTaskCard = (t: ClickupBoardTask) => {
    const disabled = busyIds.has(t.id);
    const options = statuses[t.listId] ?? [];
    const meta = BUCKET_META[t.bucket];

    return (
      <article
        key={t.id}
        className="flex flex-col gap-2.5 rounded-2xl border border-line bg-bg/80 p-4 transition-colors hover:border-line-strong"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <a href={t.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 font-semibold text-ink no-underline hover:text-primary hover:underline">
            {t.title}
          </a>
          <span className={`chip ${meta.chip} shrink-0 px-2.5 py-0.5 text-[11px]`}>
            {t.dueLabel ? `${meta.label} · ${t.dueLabel}` : meta.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
          <span>{t.list}</span>
          <span>·</span>
          <span>{t.status}</span>
          {t.origin && (
            <>
              <span>·</span>
              <a href={t.origin.url} target="_blank" rel="noopener noreferrer" className="truncate text-mute no-underline hover:underline">
                ✉ {t.origin.subject}
              </a>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void complete(t)}
            className="btn btn-primary spring-btn min-h-8 px-3 py-1 text-xs disabled:opacity-50"
          >
            ✓ Concluir
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => startFocusTimer({ title: t.title, minutes: 25, taskId: t.id })}
            className="btn spring-btn min-h-8 px-2.5 py-1 text-xs disabled:opacity-50"
          >
            ▶ Focar 25m
          </button>
          <details className="relative">
            <summary className="btn min-h-8 list-none px-2.5 py-1 text-xs [&::-webkit-details-marker]:hidden">Adiar ▾</summary>
            <div className="absolute left-0 z-20 mt-1 flex w-48 flex-col gap-1 rounded-2xl border border-line-strong bg-card p-2 shadow-lg">
              <button type="button" disabled={disabled} onClick={() => void postpone(t, { kind: "tomorrow" }, "amanhã")} className="min-h-8 rounded-xl bg-transparent px-3 text-left text-xs text-ink hover:bg-primary-soft">
                Amanhã
              </button>
              <button type="button" disabled={disabled} onClick={() => void postpone(t, { kind: "nextBusiness" }, "próximo dia útil")} className="min-h-8 rounded-xl bg-transparent px-3 text-left text-xs text-ink hover:bg-primary-soft">
                Próximo dia útil
              </button>
              <button type="button" disabled={disabled} onClick={() => void postpone(t, { kind: "monday" }, "segunda-feira")} className="min-h-8 rounded-xl bg-transparent px-3 text-left text-xs text-ink hover:bg-primary-soft">
                Segunda-feira
              </button>
            </div>
          </details>
          {options.length > 1 && (
            <select
              aria-label="Mudar status"
              value={t.status}
              disabled={disabled}
              onChange={(e) => void setStatus(t, e.target.value)}
              className="min-h-8 rounded-xl border border-line-strong bg-card px-2 text-xs text-ink disabled:opacity-50"
            >
              {!options.includes(t.status) && <option value={t.status}>{t.status}</option>}
              {options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <button type="button" onClick={() => setBucketFilter("all")} className={`card cursor-pointer text-left transition-colors ${bucketFilter === "all" ? "!border-primary bg-primary-soft/40" : ""}`}>
          <div className="text-xs text-mute">Total abertas</div>
          <div className="font-display text-2xl font-bold tabular-nums">{counts.total}</div>
        </button>
        <button type="button" onClick={() => setBucketFilter("overdue")} className={`card cursor-pointer text-left transition-colors ${bucketFilter === "overdue" ? "!border-primary bg-primary-soft/40" : ""}`}>
          <div className="text-xs text-mute">Atrasadas</div>
          <div className="font-display text-2xl font-bold tabular-nums" style={counts.overdue > 0 ? { color: "var(--red-fg)" } : undefined}>{counts.overdue}</div>
        </button>
        <button type="button" onClick={() => setBucketFilter("today")} className={`card cursor-pointer text-left transition-colors ${bucketFilter === "today" ? "!border-primary bg-primary-soft/40" : ""}`}>
          <div className="text-xs text-mute">Para hoje</div>
          <div className="font-display text-2xl font-bold tabular-nums" style={counts.today > 0 ? { color: "var(--amber-fg)" } : undefined}>{counts.today}</div>
        </button>
        <button type="button" onClick={() => setBucketFilter("upcoming")} className={`card cursor-pointer text-left transition-colors ${bucketFilter === "upcoming" ? "!border-primary bg-primary-soft/40" : ""}`}>
          <div className="text-xs text-mute">Próximos dias</div>
          <div className="font-display text-2xl font-bold tabular-nums text-primary">{counts.upcoming}</div>
        </button>
        <button type="button" onClick={() => setBucketFilter("none")} className={`card cursor-pointer text-left transition-colors ${bucketFilter === "none" ? "!border-primary bg-primary-soft/40" : ""}`}>
          <div className="text-xs text-mute">Sem prazo</div>
          <div className="font-display text-2xl font-bold tabular-nums text-mute">{counts.none}</div>
        </button>
      </div>

      {/* Criação rápida + Filtros */}
      <BentoCard className="flex flex-col gap-3 !py-4">
        <form onSubmit={createTask} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="+ Nova tarefa no ClickUp…"
            required
            className="min-h-10 min-w-[220px] flex-1 rounded-xl border border-line-strong bg-bg px-3.5 text-sm text-ink outline-none focus:border-primary"
          />
          <select
            aria-label="Lista da nova tarefa"
            value={newListId}
            onChange={(e) => setNewListId(e.target.value)}
            className="min-h-10 rounded-xl border border-line-strong bg-bg px-3 text-xs text-ink"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select
            aria-label="Prazo da nova tarefa"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value as "today" | "tomorrow" | "none")}
            className="min-h-10 rounded-xl border border-line-strong bg-bg px-3 text-xs text-ink"
          >
            <option value="today">Prazo: Hoje</option>
            <option value="tomorrow">Prazo: Amanhã</option>
            <option value="none">Sem prazo</option>
          </select>
          <button type="submit" disabled={creating || !newTitle.trim()} className="btn btn-primary spring-btn min-h-10 px-4 text-xs disabled:opacity-50">
            {creating ? "Criando…" : "Criar tarefa"}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar tarefa…"
              className="min-h-9 w-56 rounded-xl border border-line-strong bg-bg px-3 text-xs text-ink outline-none focus:border-primary"
            />
            <select
              aria-label="Filtrar por lista"
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              className="min-h-9 rounded-xl border border-line-strong bg-bg px-2.5 text-xs text-ink"
            >
              <option value="all">Todas as listas ({tasks.length})</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({tasks.filter((t) => t.listId === l.id).length})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`btn spring-btn min-h-8 px-3 py-1 text-xs ${viewMode === "list" ? "border-primary bg-primary-soft text-primary-ink" : ""}`}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`btn spring-btn min-h-8 px-3 py-1 text-xs ${viewMode === "kanban" ? "border-primary bg-primary-soft text-primary-ink" : ""}`}
            >
              Por Lista
            </button>
          </div>
        </div>
      </BentoCard>

      {error && (
        <div role="alert" className="chip chip-red rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Conteúdo */}
      {filtered.length === 0 ? (
        <BentoCard>
          <p className="m-0 text-sm text-mute">Nenhuma tarefa encontrada para os filtros selecionados.</p>
        </BentoCard>
      ) : viewMode === "list" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((t) => renderTaskCard(t))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {lists
            .filter((l) => listFilter === "all" || l.id === listFilter)
            .map((l) => {
              const col = filtered.filter((t) => t.listId === l.id);
              return (
                <BentoCard key={l.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
                    <h2 className="font-display text-base font-bold text-ink">{l.name}</h2>
                    <span className="chip chip-slate px-2 py-0.5 text-xs tabular-nums">{col.length}</span>
                  </div>
                  {col.length === 0 ? (
                    <p className="m-0 text-xs text-mute">Sem tarefas neste filtro.</p>
                  ) : (
                    <div className="flex flex-col gap-2.5">{col.map((t) => renderTaskCard(t))}</div>
                  )}
                </BentoCard>
              );
            })}
        </div>
      )}

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
