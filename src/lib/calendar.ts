// Read-only Google Calendar access for "today" (no SDK: plain REST keeps the dependency count down).
const API = "https://www.googleapis.com/calendar/v3";

export type CalEvent = {
  id: string;
  title: string;
  calendar: string;
  start: Date;
  end: Date;
  allDay: boolean;
};

type GEvent = {
  id: string;
  summary?: string;
  status?: string;
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
  };
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
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
export async function timeline(token: string, now = new Date(), days = 1) {
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
    items.map((c) =>
      get<{ items: GEvent[] }>(`/calendars/${encodeURIComponent(c.id)}/events?${q}`, token)
        .then((r) => r.items.filter((e) => e.status !== "cancelled").map((e) => toEvent(e, c.summary)))
        .catch(() => []),
    ),
  );
  const events = lists.flat().sort((a, b) => a.start.getTime() - b.start.getTime());
  return { tz, events };
}
