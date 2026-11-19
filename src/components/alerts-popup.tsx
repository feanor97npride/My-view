"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { meetingStatus, type MeetingEvent } from "@/lib/day-summary";
import { FOCUS_EVENT, formatMmSs, readFocusSession, writeFocusSession, type FocusSession } from "@/lib/focus-timer";

type AlertItem = {
  id: string;
  tone: "primary" | "blue" | "red" | "violet";
  badge: string;
  text: string;
  href: string;
};

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.46);
  } catch {
    // ignore audio block
  }
}

export default function AlertsPopup({
  events,
  serverNow,
  windowMin,
  taskCount,
  mailCount,
}: {
  events: MeetingEvent[];
  serverNow: string;
  windowMin: number;
  taskCount: number;
  mailCount: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(serverNow));
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [focus, setFocus] = useState<FocusSession | null>(null);
  const [secLeft, setSecLeft] = useState(0);
  const [completing, setCompleting] = useState(false);
  const chimedRef = useRef(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("myview:alerts-minimized") === "1") setOpen(false);
      if (sessionStorage.getItem("myview:alerts-dismissed") === "1") setDismissed(true);
    } catch {
      // ignore storage errors
    }
    const syncFocus = () => {
      const f = readFocusSession();
      setFocus(f);
      if (f) {
        const rem = f.paused ? f.remainingSec : Math.max(0, Math.ceil((f.endAtMs - Date.now()) / 1000));
        setSecLeft(rem);
        chimedRef.current = rem === 0;
        setOpen(true);
      } else {
        setSecLeft(0);
      }
    };
    syncFocus();
    window.addEventListener(FOCUS_EVENT, syncFocus);
    window.addEventListener("storage", syncFocus);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.removeEventListener(FOCUS_EVENT, syncFocus);
      window.removeEventListener("storage", syncFocus);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!focus || focus.paused) return;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((focus.endAtMs - Date.now()) / 1000));
      setSecLeft(rem);
      if (rem === 0 && !chimedRef.current) {
        chimedRef.current = true;
        playChime();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [focus]);

  const meeting = meetingStatus(events, now, windowMin);

  const items: AlertItem[] = [];
  if (meeting) {
    items.push({
      id: `meeting-${meeting.event.id}`,
      tone: meeting.kind === "now" ? "primary" : "blue",
      badge: meeting.kind === "now" ? "Agora" : `Em ${meeting.minutes} min`,
      text: meeting.event.title,
      href: "/",
    });
  }
  if (taskCount > 0) {
    items.push({
      id: "tasks",
      tone: "red",
      badge: "Tarefas",
      text: `${taskCount} ${taskCount === 1 ? "tarefa atrasada ou para hoje" : "tarefas atrasadas ou para hoje"}`,
      href: "/",
    });
  }
  if (mailCount > 0) {
    items.push({
      id: "mail",
      tone: "violet",
      badge: "E-mails",
      text: `${mailCount} ${mailCount === 1 ? "e-mail de ação não lido" : "e-mails de ação não lidos"}`,
      href: "/emails?categoria=acao&naolidos=1",
    });
  }

  const hasAlerts = items.length > 0 && !dismissed;
  if (!hasAlerts && !focus) return null;

  const togglePause = () => {
    if (!focus) return;
    if (focus.paused) {
      writeFocusSession({ ...focus, paused: false, endAtMs: Date.now() + focus.remainingSec * 1000 });
    } else {
      const rem = Math.max(0, Math.ceil((focus.endAtMs - Date.now()) / 1000));
      writeFocusSession({ ...focus, paused: true, remainingSec: rem });
    }
  };

  const addFiveMin = () => {
    if (!focus) return;
    chimedRef.current = false;
    if (focus.paused) {
      writeFocusSession({ ...focus, durationSec: focus.durationSec + 300, remainingSec: focus.remainingSec + 300 });
    } else {
      const base = Math.max(Date.now(), focus.endAtMs);
      writeFocusSession({ ...focus, durationSec: focus.durationSec + 300, endAtMs: base + 300_000 });
    }
  };

  const stopFocus = () => writeFocusSession(null);

  const completeFocusTask = async () => {
    if (!focus?.taskId || completing) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/tasks/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", taskId: focus.taskId }),
      });
      if (res.ok) {
        writeFocusSession(null);
        router.refresh();
      }
    } finally {
      setCompleting(false);
    }
  };

  const minimize = () => {
    setOpen(false);
    try {
      sessionStorage.setItem("myview:alerts-minimized", "1");
    } catch {
      // ignore
    }
  };

  const expand = () => {
    setOpen(true);
    try {
      sessionStorage.setItem("myview:alerts-minimized", "0");
    } catch {
      // ignore
    }
  };

  const dismissAll = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("myview:alerts-dismissed", "1");
    } catch {
      // ignore
    }
  };

  if (!open) {
    const leadTone = focus
      ? "chip-primary"
      : meeting
        ? meeting.kind === "now"
          ? "chip-primary"
          : "chip-blue"
        : taskCount > 0
          ? "chip-red"
          : "chip-violet";
    return (
      <button
        type="button"
        onClick={expand}
        aria-label={focus ? `Foco em andamento: ${formatMmSs(secLeft)}` : `Abrir ${items.length} alertas e lembretes`}
        className="toast-enter spring-btn fixed bottom-24 right-4 z-20 flex cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-card px-3.5 py-2 text-xs font-semibold text-ink shadow-xl hover:border-primary md:bottom-5 md:right-5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {focus ? (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </>
          ) : (
            <>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </>
          )}
        </svg>
        <span>{focus ? "Foco" : "Alertas"}</span>
        <span className={`chip ${leadTone} min-w-5 justify-center px-1.5 py-0 text-[11px] tabular-nums`}>
          {focus ? formatMmSs(secLeft) : items.length}
        </span>
      </button>
    );
  }

  const pct = focus ? Math.max(0, Math.min(100, Math.round(((focus.durationSec - secLeft) / Math.max(1, focus.durationSec)) * 100))) : 0;

  return (
    <aside
      role="region"
      aria-label="Foco, alertas e lembretes"
      className="toast-enter fixed bottom-24 right-4 z-20 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[22px] border border-line-strong bg-card shadow-2xl md:bottom-5 md:right-5"
    >
      {focus && (
        <div className="border-b border-line bg-primary-soft/60 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="chip chip-primary px-2 py-0.5 text-[10px]">
              {secLeft === 0 ? "Concluído!" : focus.paused ? "Pausado" : "Em foco"}
            </span>
            <div className="flex items-center gap-1">
              <span className="font-display text-lg font-bold tabular-nums text-ink">{formatMmSs(secLeft)}</span>
              {!hasAlerts && (
                <button
                  type="button"
                  onClick={minimize}
                  title="Minimizar"
                  aria-label="Minimizar"
                  className="spring-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-xs font-bold text-mute hover:bg-card hover:text-ink"
                >
                  –
                </button>
              )}
              <button
                type="button"
                onClick={stopFocus}
                title="Encerrar foco"
                aria-label="Encerrar foco"
                className="spring-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-xs font-bold text-mute hover:bg-card hover:text-ink"
              >
                ×
              </button>
            </div>
          </div>
          <p className="mt-1 mb-2 truncate text-xs font-semibold text-ink" title={focus.title}>
            {focus.title}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {secLeft > 0 && (
              <button
                type="button"
                onClick={togglePause}
                className="btn spring-btn min-h-7 px-2.5 py-1 text-[11px]"
              >
                {focus.paused ? "Retomar" : "Pausar"}
              </button>
            )}
            <button
              type="button"
              onClick={addFiveMin}
              className="btn spring-btn min-h-7 px-2.5 py-1 text-[11px]"
            >
              +5 min
            </button>
            {focus.taskId && (
              <button
                type="button"
                onClick={completeFocusTask}
                disabled={completing}
                className="btn btn-primary spring-btn ml-auto min-h-7 px-2.5 py-1 text-[11px]"
              >
                {completing ? "Salvando…" : "✓ Concluir"}
              </button>
            )}
          </div>
        </div>
      )}

      {hasAlerts && (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <span className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                Alertas & Lembretes ({items.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={minimize}
                title="Minimizar alertas"
                aria-label="Minimizar alertas"
                className="spring-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-xs font-bold text-mute hover:bg-primary-soft hover:text-ink"
              >
                –
              </button>
              <button
                type="button"
                onClick={dismissAll}
                title="Dispensar nesta sessão"
                aria-label="Dispensar alertas nesta sessão"
                className="spring-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-xs font-bold text-mute hover:bg-primary-soft hover:text-ink"
              >
                ×
              </button>
            </div>
          </div>

          <ul className="m-0 flex list-none flex-col gap-1.5 p-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-xl bg-bg px-3 py-2 text-xs text-ink no-underline transition-colors hover:bg-primary-soft"
                >
                  <span className={`chip chip-${item.tone} shrink-0 px-2 py-0.5 text-[10px]`}>{item.badge}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{item.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
