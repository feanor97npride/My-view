"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionToast, BentoCard, type ToastAction } from "@/components/ui";
import { startFocusTimer } from "@/lib/focus-timer";

export type WeekEvent = {
  id: string;
  title: string;
  allDay: boolean;
  timeLabel: string;
  startHour?: number;
  endHour?: number;
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
  weekdayName: string;
  dayNum: string;
  longLabel: string;
  isToday: boolean;
  isWeekend: boolean;
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

  const weekdays = days.filter((d) => !d.isWeekend);
  const weekends = days.filter((d) => d.isWeekend);
  const nextKeyMap = new Map<string, string>();
  days.forEach((d, idx) => {
    if (days[idx + 1]) nextKeyMap.set(d.key, days[idx + 1].key);
  });

  const periodBusy = (events: WeekEvent[]) => {
    let morning = false;
    let afternoon = false;
    let evening = false;
    for (const e of events) {
      if (e.allDay || e.startHour === undefined || e.endHour === undefined) continue;
      if (e.startHour < 12) morning = true;
      if (e.endHour >= 12 && e.startHour < 18) afternoon = true;
      if (e.endHour >= 18 || e.startHour >= 18) evening = true;
    }
    return { morning, afternoon, evening };
  };

  const renderTask = (t: WeekTask, nextDayKey?: string) => {
    const isBusy = busyIds.has(t.id);
    return (
      <div
        key={t.id}
        className="group flex items-start gap-2.5 rounded-2xl border border-line bg-bg/80 p-3 transition-colors hover:border-primary/50"
      >
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void completeTask(t)}
          title="Concluir tarefa"
          aria-label={`Concluir ${t.title}`}
          className="mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-line-strong bg-card text-[10px] font-bold text-transparent transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary disabled:opacity-50"
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <a href={t.url} target="_blank" rel="noopener noreferrer" className="block text-[13px] font-semibold leading-snug text-ink no-underline hover:underline">
            {t.title}
            <span className="sr-only"> (abre no ClickUp, em nova aba)</span>
          </a>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5">
            <span className="truncate text-[11px] text-mute">{t.list}</span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => startFocusTimer({ title: t.title, minutes: 25, taskId: t.id })}
                title="Iniciar foco de 25 min"
                aria-label={`Focar 25 min em ${t.title}`}
                className="spring-btn cursor-pointer rounded-md border border-line-strong bg-card px-1.5 py-0.5 text-[10px] font-semibold text-mute hover:border-primary hover:text-ink"
              >
                ▶
              </button>
              {nextDayKey && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void postponeTask(t, nextDayKey, "Tarefa adiada para o dia seguinte")}
                  title="Adiar para o dia seguinte"
                  aria-label={`Adiar ${t.title} para o dia seguinte`}
                  className="spring-btn cursor-pointer rounded-md border border-line-strong bg-card px-1.5 py-0.5 text-[10px] font-semibold text-mute hover:border-primary hover:text-ink disabled:opacity-50"
                >
                  +1d
                </button>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {error && (
        <p role="alert" className="chip chip-red m-0 w-fit whitespace-normal rounded-xl px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      {/* Dias úteis: 5 colunas largas */}
      <section aria-label="Dias úteis da semana" className="spring-card spring-d2 grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-5">
        {weekdays.map((p) => {
          const nextDayKey = nextKeyMap.get(p.key);
          const ratio = Math.min(1, p.busy / Math.max(1, capacityHours));
          const circ = 2 * Math.PI * 18;
          const offset = circ * (1 - ratio);
          const periods = periodBusy(p.events);
          const allDayEvents = p.events.filter((e) => e.allDay);
          const timedEvents = p.events.filter((e) => !e.allDay);

          return (
            <BentoCard
              as="article"
              key={p.key}
              className={`flex min-h-[420px] flex-col gap-3 !p-4 ${
                p.isToday ? "!border-2 !border-primary shadow-[0_10px_28px_rgb(67_56_202_/_0.08)]" : ""
              }`}
            >
              {/* Topo: Dia + Anel radial */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${p.isToday ? "text-primary" : "text-mute"}`}>
                    {p.isToday ? `Hoje · ${p.weekdayName}` : p.weekdayName}
                  </div>
                  <div className="font-display text-3xl font-bold leading-none tabular-nums text-ink">{p.dayNum}</div>
                </div>
                <div
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center text-[11px] font-bold tabular-nums"
                  title={`${p.busy.toFixed(1).replace(".", ",")}h de ${capacityHours.toFixed(0)}h ocupadas`}
                >
                  <svg width="44" height="44" className="absolute inset-0 -rotate-90" aria-hidden="true">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--line)" strokeWidth="4" />
                    {p.busy > 0 && (
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke={ratio > 0.75 ? "var(--red-fg)" : "var(--primary)"}
                        strokeWidth="4"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                  <span style={p.busy === 0 ? { color: "var(--green-fg)" } : undefined}>
                    {p.busy > 0 ? `${p.busy.toFixed(1).replace(".", ",")}h` : "Livre"}
                  </span>
                </div>
              </div>

              {/* Barra visual Manhã / Tarde / Noite */}
              <div>
                <div className="grid grid-cols-3 gap-1">
                  <div
                    className="h-2 rounded-full transition-colors"
                    title={periods.morning ? "Manhã com reunião" : "Manhã livre"}
                    style={{ background: periods.morning ? "var(--primary)" : "var(--green-bg)" }}
                  />
                  <div
                    className="h-2 rounded-full transition-colors"
                    title={periods.afternoon ? "Tarde com reunião" : "Tarde livre"}
                    style={{ background: periods.afternoon ? "var(--primary)" : "var(--green-bg)" }}
                  />
                  <div
                    className="h-2 rounded-full transition-colors"
                    title={periods.evening ? "Noite com reunião" : "Noite livre"}
                    style={{ background: periods.evening ? "var(--primary)" : "var(--green-bg)" }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-mute">
                  <span>Manhã</span>
                  <span>Tarde</span>
                  <span>Noite</span>
                </div>
              </div>

              {/* Eventos de dia inteiro */}
              {allDayEvents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allDayEvents.map((e) => (
                    <span key={e.id} className="chip chip-blue px-2.5 py-0.5 text-[11px]">
                      {e.title}
                    </span>
                  ))}
                </div>
              )}

              {/* Reuniões com horário */}
              {timedEvents.map((e) => (
                <div key={e.id} className="flex items-start gap-2 rounded-xl bg-primary-soft/80 px-3 py-2 text-[13px]">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold tabular-nums text-primary">{e.timeLabel}</div>
                    {e.link ? (
                      <a href={e.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink no-underline hover:underline">
                        {e.title}
                        <span className="sr-only"> (abre no Google Agenda, em nova aba)</span>
                      </a>
                    ) : (
                      <span className="font-semibold text-ink">{e.title}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Tarefas ClickUp */}
              {p.tasks.map((t) => renderTask(t, nextDayKey))}

              {p.events.length === 0 && p.tasks.length === 0 && (
                <p className="mt-1 rounded-2xl border border-dashed border-line px-3 py-3 text-center text-xs text-mute">
                  Dia livre para foco.
                </p>
              )}
            </BentoCard>
          );
        })}
      </section>

      {/* Fim de semana compacto na base */}
      {weekends.length > 0 && (
        <section aria-label="Fim de semana" className="spring-card spring-d3 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {weekends.map((p) => {
            const nextDayKey = nextKeyMap.get(p.key);
            const hasContent = p.events.length > 0 || p.tasks.length > 0;
            return (
              <BentoCard key={p.key} className="flex flex-col gap-2.5 !px-5 !py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-base font-bold capitalize text-ink">{p.longLabel}</span>
                    {!hasContent && <span className="text-xs text-mute">· Dia livre para descanso ou foco</span>}
                  </div>
                  <span className={`chip ${p.busy > 0 ? "chip-blue" : "chip-green"}`}>
                    {p.busy > 0 ? `${p.busy.toFixed(1).replace(".", ",")}h` : "Livre"}
                  </span>
                </div>
                {p.events.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-xs text-ink">
                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    <span className="font-semibold text-primary tabular-nums">{e.allDay ? "Dia inteiro" : e.timeLabel}</span>
                    <span className="font-medium">{e.title}</span>
                  </div>
                ))}
                {p.tasks.map((t) => renderTask(t, nextDayKey))}
              </BentoCard>
            );
          })}
        </section>
      )}

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
