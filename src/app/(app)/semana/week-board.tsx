"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionToast, BentoCard, type ToastAction } from "@/components/ui";

export type WeekEvent = {
  id: string;
  title: string;
  allDay: boolean;
  timeLabel: string;
  link?: string | null;
};

export type WeekTask = {
  id: string;
  title: string;
  list: string;
  url: string;
  dayKey: string;
};

export type WeekDay = {
  key: string;
  longLabel: string;
  isToday: boolean;
  busy: number;
  events: WeekEvent[];
  tasks: WeekTask[];
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

export default function WeekBoard({
  initialDays,
  capacityHours,
}: {
  initialDays: WeekDay[];
  capacityHours: number;
}) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  useEffect(() => setDays(initialDays), [initialDays]);

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
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const completeTask = async (t: WeekTask) => {
    if (busyIds.has(t.id)) return;
    setError(null);
    markBusy(t.id, true);
    const before = days;
    setDays((prev) => prev.map((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) })));

    const res = await postTaskAction<{ prevStatus?: string }>({ action: "complete", taskId: t.id });
    markBusy(t.id, false);
    if (!res.ok) {
      setDays(before);
      setError(res.error);
      return;
    }

    const prevStatus = res.data.prevStatus;
    showToast("Tarefa concluída", async () => {
      setDays(before);
      if (prevStatus) {
        const u = await postTaskAction({ action: "restoreStatus", taskId: t.id, status: prevStatus });
        if (!u.ok) setError(u.error);
      }
      router.refresh();
    });
    router.refresh();
  };

  const postponeTask = async (t: WeekTask, nextKey: string, label: string) => {
    if (busyIds.has(t.id)) return;
    setError(null);
    markBusy(t.id, true);
    const before = days;
    setDays((prev) =>
      prev.map((d) => {
        const without = d.tasks.filter((x) => x.id !== t.id);
        if (d.key === nextKey) return { ...d, tasks: [...without, { ...t, dayKey: nextKey }] };
        return { ...d, tasks: without };
      }),
    );

    const res = await postTaskAction<{ prevDueMs?: number | null }>({
      action: "postpone",
      taskId: t.id,
      date: nextKey,
    });
    markBusy(t.id, false);
    if (!res.ok) {
      setDays(before);
      setError(res.error);
      return;
    }

    const prevDueMs = res.data.prevDueMs ?? null;
    showToast(label, async () => {
      setDays(before);
      const u = await postTaskAction({ action: "restoreDue", items: [{ taskId: t.id, dueMs: prevDueMs }] });
      if (!u.ok) setError(u.error);
      router.refresh();
    });
    router.refresh();
  };

  return (
    <>
      {error && (
        <p role="alert" className="chip chip-red m-0 w-fit whitespace-normal rounded-xl px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      <section aria-label="Dias da semana" className="spring-card spring-d3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((p, idx) => {
          const nextDayKey = days[idx + 1]?.key;
          return (
            <BentoCard
              as="article"
              key={p.key}
              className={`flex flex-col gap-2.5 !p-4 ${
                p.isToday ? "!border-2 !border-primary !bg-primary-soft/45" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {p.isToday && <span className="chip chip-primary mb-1 px-2 py-0 text-[10px]">Hoje</span>}
                  <h3 className="font-display text-[16px] font-semibold capitalize leading-snug">{p.longLabel}</h3>
                </div>
                <span className={`chip shrink-0 ${p.busy > capacityHours * 0.75 ? "chip-red" : p.busy > 0 ? "chip-blue" : "chip-slate"}`}>
                  {p.busy > 0 ? `${p.busy.toFixed(1).replace(".", ",")}h` : "livre"}
                </span>
              </div>

              {p.events.length === 0 && p.tasks.length === 0 && (
                <p className="mt-1 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-mute">
                  Dia livre para foco.
                </p>
              )}

              {p.events.map((e) => (
                <p key={e.id} className="m-0 text-[13px] leading-snug">
                  <span className="tabular-nums text-mute">{e.allDay ? "Dia inteiro" : e.timeLabel}</span>
                  <br />
                  {e.link ? (
                    <a href={e.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink no-underline hover:underline">
                      {e.title}
                      <span className="sr-only"> (abre no Google Agenda, em nova aba)</span>
                    </a>
                  ) : (
                    <span className="font-semibold">{e.title}</span>
                  )}
                </p>
              ))}

              {p.tasks.map((t) => {
                const isBusy = busyIds.has(t.id);
                return (
                  <div key={t.id} className="rounded-xl border border-line bg-bg/70 p-2 text-[13px] leading-snug">
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span className="chip chip-amber px-2 py-px text-[10px]">Prazo</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void completeTask(t)}
                          title="Concluir tarefa"
                          aria-label={`Concluir ${t.title}`}
                          className="spring-btn cursor-pointer rounded-md border border-line-strong bg-card px-1.5 py-0.5 text-[11px] font-semibold text-ink hover:bg-primary-soft disabled:opacity-50"
                        >
                          ✓
                        </button>
                        {nextDayKey && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void postponeTask(t, nextDayKey, "Tarefa adiada para o dia seguinte")}
                            title="Adiar para o dia seguinte"
                            aria-label={`Adiar ${t.title} para o dia seguinte`}
                            className="spring-btn cursor-pointer rounded-md border border-line-strong bg-card px-1.5 py-0.5 text-[11px] font-semibold text-mute hover:bg-primary-soft hover:text-ink disabled:opacity-50"
                          >
                            +1d
                          </button>
                        )}
                      </div>
                    </div>
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="block font-semibold text-ink no-underline hover:underline">
                      {t.title}
                      <span className="sr-only"> (abre no ClickUp, em nova aba)</span>
                    </a>
                    <span className="text-[11px] text-mute">{t.list}</span>
                  </div>
                );
              })}
            </BentoCard>
          );
        })}
      </section>

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
