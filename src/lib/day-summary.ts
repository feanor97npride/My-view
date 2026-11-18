// Pure logic for the "Resumo do dia" block and its alerts (no imports, testable in plain Node).
// Unknown data (a source that failed) is passed as null and simply left out of the text.

export const ALERTA_REUNIAO_MIN = 30;
export const JANELAS_REUNIAO = [5, 10, 15, 30, 60];

// Anything that is not one of the allowed windows falls back to the default.
export function normalizeWindow(v: unknown): number {
  const n = Number(v);
  return JANELAS_REUNIAO.includes(n) ? n : ALERTA_REUNIAO_MIN;
}
const AGUARDANDO_DIAS = 2; // keep equal to AGUARDANDO_DIAS in email-view.ts (this file has no imports)

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const oneDecimal = (h: number) => String(Math.round(h * 10) / 10).replace(".", ",");

export type SummaryInput = {
  eventsCount: number | null;
  busyHours: number;
  nextEventTime: string | null; // already formatted, e.g. "16:50"
  overdue: number | null;
  dueToday: number | null;
  actionEmails: number | null;
};

export function summarize(i: SummaryInput): string {
  const parts: string[] = [];
  if (i.eventsCount !== null) {
    parts.push(
      i.eventsCount === 0
        ? "Hoje você não tem compromissos."
        : `Hoje você tem ${plural(i.eventsCount, "compromisso", "compromissos")}${
            i.busyHours > 0 ? ` (${oneDecimal(i.busyHours)} h na agenda)` : ""
          }${i.nextEventTime ? `, o próximo às ${i.nextEventTime}` : ""}.`,
    );
  }
  if (i.overdue !== null && i.dueToday !== null) {
    parts.push(
      `${plural(i.overdue, "tarefa atrasada", "tarefas atrasadas")}, ${i.dueToday} ${i.dueToday === 1 ? "vence" : "vencem"} hoje.`,
    );
  }
  if (i.actionEmails !== null) {
    parts.push(i.actionEmails === 0 ? "Nenhum e-mail de ação por ler." : `${plural(i.actionEmails, "e-mail de ação", "e-mails de ação")} por ler.`);
  }
  return parts.join(" ");
}

export type Alert = { id: string; tone: "red" | "amber" | "violet"; label: string; text: string; href: string };

// Only what exists: nothing is returned for a zero or an unknown (null) count.
export function staticAlerts(i: {
  overdue: number | null;
  oldestOverdueDays: number;
  dueToday: number | null;
  actionEmails: number | null;
  awaiting?: number | null;
}): Alert[] {
  const out: Alert[] = [];
  if (i.overdue) {
    out.push({
      id: "overdue",
      tone: "red",
      label: "Atrasadas",
      text: `${plural(i.overdue, "tarefa atrasada", "tarefas atrasadas")}${
        i.oldestOverdueDays > 0 ? `, a mais antiga há ${plural(i.oldestOverdueDays, "dia", "dias")}` : ""
      }`,
      href: "/indicadores",
    });
  }
  if (i.dueToday) {
    out.push({ id: "today", tone: "amber", label: "Hoje", text: `${plural(i.dueToday, "tarefa vence", "tarefas vencem")} hoje`, href: "/semana" });
  }
  if (i.actionEmails) {
    out.push({
      id: "mail",
      tone: "violet",
      label: "E-mails",
      text: `${plural(i.actionEmails, "e-mail de ação", "e-mails de ação")} por ler`,
      href: "/emails?categoria=acao&naolidos=1",
    });
  }
  if (i.awaiting) {
    out.push({
      id: "awaiting",
      tone: "amber",
      label: "Sem resposta",
      text: `${plural(i.awaiting, "conversa", "conversas")} aguardando resposta há ${AGUARDANDO_DIAS}+ dias`,
      href: "/emails?categoria=aguardando",
    });
  }
  return out;
}

export type MeetingEvent = { id: string; title: string; start: string; end: string }; // ISO strings
export type MeetingStatus = { kind: "now" | "soon"; event: MeetingEvent; minutes: number };

// A meeting in progress wins (minutes = time left); otherwise the next one starting within windowMin (minutes = time to start).
// Pass timed events only: all-day events are the caller's to leave out.
export function meetingStatus(events: MeetingEvent[], now: Date, windowMin = ALERTA_REUNIAO_MIN): MeetingStatus | null {
  const t = now.getTime();
  let soon: MeetingStatus | null = null;
  for (const e of events) {
    const start = Date.parse(e.start);
    const end = Date.parse(e.end);
    if (start <= t && t < end) return { kind: "now", event: e, minutes: Math.ceil((end - t) / 60_000) };
    if (start > t && start - t <= windowMin * 60_000 && (!soon || start < Date.parse(soon.event.start))) {
      soon = { kind: "soon", event: e, minutes: Math.ceil((start - t) / 60_000) };
    }
  }
  return soon;
}
