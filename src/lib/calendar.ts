import { unstable_cache } from "next/cache";

// Read-only Google Calendar access for "today" (no SDK: plain REST keeps the dependency count down).
const API = "https://www.googleapis.com/calendar/v3";

export type CalEvent = {
  id: string;
  title: string;
  calendar: string;
  start: Date;
  end: Date;
  allDay: boolean;
  link: string | null; // opens the event in Google Calendar
};

type GEvent = {
  id: string;
  summary?: string;
  status?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

// Start/end instants of the calendar day containing `now` in IANA zone `tz`.
export function dayWindow(now: Date, tz: string): { start: Date; end: Date } {
  const wall = (d: Date) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).formatToParts(d).map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  };
  const offset = (d: Date) => wall(d) - d.getTime();
  const today = wall(now);
  const midnight = Date.UTC(new Date(today).getUTCFullYear(), new Date(today).getUTCMonth(), new Date(today).getUTCDate());
  const next = midnight + 86_400_000;
  // shortcut: offset read at local midnight, so the one DST-switch hour may be off, fine for a daily view
  return {
    start: new Date(midnight - offset(new Date(midnight))),
    end: new Date(next - offset(new Date(next))),
  };
}

export function toEvent(e: GEvent, calendar: string): CalEvent {
  const allDay = !e.start.dateTime;
  return {
    id: e.id,
    title: e.summary ?? "(sem título)",
    calendar,
    start: new Date(e.start.dateTime ?? e.start.date ?? 0),
    end: new Date(e.end.dateTime ?? e.end.date ?? 0),
    allDay,
    link: e.htmlLink ?? null,
  };
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export type CalendarInfo = { id: string; name: string; primary: boolean };

export async function listCalendars(token: string): Promise<CalendarInfo[]> {
  const { items } = await get<{ items: { id: string; summary: string; summaryOverride?: string; primary?: boolean }[] }>(
    "/users/me/calendarList",
    token,
  );
  return items.map((c) => ({ id: c.id, name: c.summaryOverride ?? c.summary, primary: !!c.primary }));
}

// Calendars to show: the chosen ones that still exist, or all when no valid choice is saved.
export function pickCalendars<T extends { id: string }>(all: T[], selected: string[] | null | undefined): T[] {
  const chosen = selected?.length ? all.filter((c) => selected.includes(c.id)) : [];
  return chosen.length ? chosen : all;
}

export async function primaryTz(token: string): Promise<string> {
  const { items } = await get<{ items: { primary?: boolean; timeZone?: string }[] }>("/users/me/calendarList", token);
  return items.find((c) => c.primary)?.timeZone ?? "UTC";
}

// Hours covered by timed events, counting overlaps once.
export function busyHours(events: CalEvent[]): number {
  const iv = events
    .filter((e) => !e.allDay)
    .map((e) => [e.start.getTime(), e.end.getTime()])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let end = -Infinity;
  for (const [s, e] of iv) {
    if (e <= end) continue;
    total += e - Math.max(s, end);
    end = e;
  }
  return total / 3_600_000;
}

// Events from the start of today through the end of day `days` (1 = today only).
export async function timeline(token: string, now = new Date(), days = 1, selected?: string[] | null) {
  const { items } = await get<{ items: { id: string; summary: string; primary?: boolean; timeZone?: string }[] }>(
    "/users/me/calendarList",
    token,
  );
  const tz = items.find((c) => c.primary)?.timeZone ?? "UTC";
  const start = dayWindow(now, tz).start;
  const end = dayWindow(new Date(now.getTime() + (days - 1) * 86_400_000), tz).end;
  const q = `singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`;
  // shortcut: a calendar that fails is skipped silently, so one bad calendar does not blank the whole day
  const lists = await Promise.all(
    pickCalendars(items, selected).map((c) =>
      get<{ items: GEvent[] }>(`/calendars/${encodeURIComponent(c.id)}/events?${q}`, token)
        .then((r) => r.items.filter((e) => e.status !== "cancelled").map((e) => toEvent(e, c.summary)))
        .catch(() => []),
    ),
  );
  const events = lists.flat().sort((a, b) => a.start.getTime() - b.start.getTime());
  return { tz, events };
}

// Timed events of today still to end, as ISO strings, cached 60 s per token so the meeting banner
// in the shared layout does not call Google on every page. The browser keeps the countdown moving.
export const upcomingTimed = unstable_cache(
  async (token: string, selected: string[] | null) => {
    const t = await timeline(token, new Date(), 1, selected);
    const now = Date.now();
    return t.events
      .filter((e) => !e.allDay && e.end.getTime() > now)
      .map((e) => ({ id: e.id, title: e.title, start: e.start.toISOString(), end: e.end.toISOString() }));
  },
  ["upcoming-timed"],
  { revalidate: 60 },
);

export async function createCalendarEvent(
  token: string,
  input: { title: string; description: string; startIso: string; endIso: string; calendarId?: string },
): Promise<{ id: string; link: string | null }> {
  const cal = encodeURIComponent(input.calendarId ?? "primary");
  const res = await fetch(`${API}/calendars/${cal}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: input.title,
      description: input.description,
      start: { dateTime: input.startIso },
      end: { dateTime: input.endIso },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { id: string; htmlLink?: string };
  return { id: j.id, link: j.htmlLink ?? null };
}

export async function deleteCalendarEvent(token: string, eventId: string, calendarId = "primary"): Promise<void> {
  const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
