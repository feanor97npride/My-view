"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type PlanItem = {
  id: string;
  kind: "task" | "email" | "finance";
  title: string;
  minutes: number;
  startIso: string;
  endIso: string;
  label: string; // "14:00–14:30", already in the calendar's time zone
  url?: string;
  href?: string; // in-app link for bundles (e-mails, financeiro)
};

const KIND: Record<PlanItem["kind"], [string, string]> = {
  task: ["Tarefa", "chip-amber"],
  email: ["E-mails", "chip-violet"],
  finance: ["Financeiro", "chip-green"],
};

async function post<T extends Record<string, unknown> = Record<string, unknown>>(
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/emails/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, data: j } : { ok: false, error: j.error ?? `Erro ${res.status}` };
  } catch {
    return { ok: false, error: "Falha de conexão ao executar a ação." };
  }
}

export default function DayPlan({
  items,
  unplaced,
  note,
  freeLabel,
}: {
  items: PlanItem[];
  unplaced: string[];
  note: string | null; // why there is no plan (work day over, nothing to do...)
  freeLabel: string;
}) {
  const router = useRouter();
  const [reserved, setReserved] = useState<Record<string, string>>({}); // item id -> calendar event id
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ label: string; undo: () => Promise<void> } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showToast = (label: string, undo: () => Promise<void>) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ label, undo });
    timer.current = setTimeout(() => setToast(null), 6000);
  };

  const body = (it: PlanItem) => ({
    action: "schedule",
    title: it.title,
    description: [it.url ? `Tarefa: ${it.url}` : "", it.href ? `Abrir: ${window.location.origin}${it.href}` : "", "Criado pelo Plano do dia (My View)"]
      .filter(Boolean)
      .join("\n"),
    startIso: it.startIso,
    endIso: it.endIso,
  });

  const reserve = async (list: PlanItem[]) => {
    const todo = list.filter((i) => !reserved[i.id] && !busy.has(i.id));
    if (todo.length === 0) return;
    setError(null);
    setBusy((p) => new Set([...p, ...todo.map((i) => i.id)]));
    const done: Record<string, string> = {};
    for (const it of todo) {
      const r = await post<{ eventId?: string }>(body(it));
      if (!r.ok) {
        setError(r.error);
        break;
      }
      if (r.data.eventId) done[it.id] = r.data.eventId;
    }
    setBusy((p) => {
      const n = new Set(p);
      todo.forEach((i) => n.delete(i.id));
      return n;
    });
    const n = Object.keys(done).length;
    if (n === 0) return;
    setReserved((p) => ({ ...p, ...done }));
    showToast(n === 1 ? "Bloco reservado na agenda" : `${n} blocos reservados na agenda`, async () => {
      for (const eventId of Object.values(done)) {
        const u = await post({ action: "unschedule", eventId });
        if (!u.ok) setError(u.error);
      }
      setReserved((p) => {
        const next = { ...p };
        Object.keys(done).forEach((k) => delete next[k]);
        return next;
      });
      router.refresh();
    });
    router.refresh();
  };

  const pending = items.filter((i) => !reserved[i.id]);

  return (
    <section aria-label="Plano do dia" className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Plano do dia</h2>
          <p className="m-0 text-[13px] text-mute">{freeLabel}</p>
        </div>
        {pending.length > 1 && (
          <button type="button" onClick={() => reserve(pending)} disabled={busy.size > 0} className="btn btn-primary min-h-9 px-3 py-1 text-[13px] disabled:opacity-50">
            Reservar tudo ({pending.length})
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="chip-red flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="btn min-h-8 px-2.5 py-1 text-xs">Fechar</button>
        </div>
      )}

      {note && items.length === 0 && <p className="m-0 text-mute">{note}</p>}

      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((it) => {
          const [kindLabel, kindChip] = KIND[it.kind];
          const done = !!reserved[it.id];
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-3 rounded-2xl p-3" style={{ background: "var(--surface-3)" }}>
              <span className="w-[104px] shrink-0 text-sm font-semibold tabular-nums">{it.label}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`chip ${kindChip}`}>{kindLabel}</span>
                  <span className="text-xs text-mute">{it.minutes} min</span>
                </span>
                {it.url ? (
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="truncate font-semibold text-ink no-underline hover:underline">
                    {it.title}
                    <span className="sr-only"> (abre no ClickUp, em nova aba)</span>
                  </a>
                ) : it.href ? (
                  <Link href={it.href} className="truncate font-semibold text-ink no-underline hover:underline">{it.title}</Link>
                ) : (
                  <span className="truncate font-semibold">{it.title}</span>
                )}
              </span>
              <button
                type="button"
                disabled={done || busy.has(it.id)}
                onClick={() => reserve([it])}
                className="btn min-h-9 shrink-0 px-3 py-1 text-[13px] disabled:opacity-60"
              >
                {done ? "Reservado ✓" : busy.has(it.id) ? "Reservando…" : "Reservar na agenda"}
              </button>
            </li>
          );
        })}
      </ol>

      {unplaced.length > 0 && (
        <p className="m-0 text-[13px] text-mute">
          Sem espaço hoje: {unplaced.slice(0, 3).join(", ")}
          {unplaced.length > 3 ? ` e mais ${unplaced.length - 3}` : ""}. Considere adiar ou replanejar.
        </p>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 right-4 z-30 flex items-center gap-3 rounded-2xl border border-line-strong bg-card px-4 py-3 text-sm font-medium shadow-lg md:bottom-6 md:right-6"
        >
          <span>{toast.label}</span>
          <button
            type="button"
            onClick={() => {
              const undo = toast.undo;
              setToast(null);
              void undo();
            }}
            className="btn btn-primary min-h-9 px-3 py-1 text-xs"
          >
            Desfazer
          </button>
        </div>
      )}
    </section>
  );
}
