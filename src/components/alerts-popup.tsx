"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { meetingStatus, type MeetingEvent } from "@/lib/day-summary";

type AlertItem = {
  id: string;
  tone: "primary" | "blue" | "red" | "violet";
  badge: string;
  text: string;
  href: string;
};

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
  const [now, setNow] = useState(() => new Date(serverNow));
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("myview:alerts-minimized") === "1") setOpen(false);
      if (sessionStorage.getItem("myview:alerts-dismissed") === "1") setDismissed(true);
    } catch {
      // ignore storage errors
    }
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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

  if (items.length === 0 || dismissed) return null;

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
    const leadTone = meeting ? (meeting.kind === "now" ? "chip-primary" : "chip-blue") : taskCount > 0 ? "chip-red" : "chip-violet";
    return (
      <button
        type="button"
        onClick={expand}
        aria-label={`Abrir ${items.length} alertas e lembretes`}
        className="toast-enter spring-btn fixed bottom-24 right-4 z-20 flex cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-card px-3.5 py-2 text-xs font-semibold text-ink shadow-xl hover:border-primary md:bottom-5 md:right-5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span>Alertas</span>
        <span className={`chip ${leadTone} min-w-5 justify-center px-1.5 py-0 text-[11px]`}>{items.length}</span>
      </button>
    );
  }

  return (
    <aside
      role="region"
      aria-label="Alertas e lembretes"
      className="toast-enter fixed bottom-24 right-4 z-20 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[22px] border border-line-strong bg-card shadow-2xl md:bottom-5 md:right-5"
    >
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
    </aside>
  );
}
