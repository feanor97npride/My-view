// Pure date and planning helpers for tasks (no imports, testable in plain Node).
// A "day key" is YYYY-MM-DD in the calendar's time zone. Due dates are stored at 12:00 UTC of that day,
// which lands on the same calendar day for every time zone from UTC-12 to UTC+11.

export type Postpone = "tomorrow" | "monday" | "nextBusiness";

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDayKey(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = KEY.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s;
}

export const dayKey = (d: Date, tz: string): string => d.toLocaleDateString("en-CA", { timeZone: tz });

const toUtc = (key: string) => {
  const m = KEY.exec(key)!;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export const addDaysKey = (key: string, n: number): string => new Date(toUtc(key) + n * 86_400_000).toISOString().slice(0, 10);

// 0 = Sunday ... 6 = Saturday
export const weekdayOf = (key: string): number => new Date(toUtc(key)).getUTCDay();

export const isBusinessDay = (key: string): boolean => {
  const w = weekdayOf(key);
  return w !== 0 && w !== 6;
};

export const dueForKey = (key: string): number => toUtc(key) + 12 * 3_600_000;

export function nextBusinessKey(key: string): string {
  let k = addDaysKey(key, 1);
  while (!isBusinessDay(k)) k = addDaysKey(k, 1);
  return k;
}

// Day the task moves to: tomorrow, the next Monday, or the next business day.
export function postponeKey(kind: Postpone, now: Date, tz: string): string {
  const today = dayKey(now, tz);
  if (kind === "tomorrow") return addDaysKey(today, 1);
  if (kind === "nextBusiness") return nextBusinessKey(today);
  let k = addDaysKey(today, 1);
  while (weekdayOf(k) !== 1) k = addDaysKey(k, 1);
  return k;
}

export const isPostpone = (x: unknown): x is Postpone => x === "tomorrow" || x === "monday" || x === "nextBusiness";

// ---------------------------------------------------------------------------------------------
// Planning: spreading overdue tasks over business days and fitting work into free calendar time.
// ---------------------------------------------------------------------------------------------

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const rank = (p: string | null) => (p && p in PRIORITY_RANK ? PRIORITY_RANK[p] : 4);

export type PlanTask = { id: string; priority: string | null; dueMs: number | null };

// Moves overdue tasks to the next business days, `perDay` at a time, most urgent and oldest first.
// `existing` is how many tasks already sit on each day, so busy days take fewer.
export function planOverdue(
  tasks: PlanTask[],
  todayKey: string,
  perDay: number,
  existing: Record<string, number> = {},
): { taskId: string; date: string }[] {
  const cap = Math.max(1, Math.floor(perDay));
  const order = [...tasks].sort(
    (a, b) => rank(a.priority) - rank(b.priority) || (a.dueMs ?? Infinity) - (b.dueMs ?? Infinity),
  );
  const load: Record<string, number> = { ...existing };
  let day = isBusinessDay(todayKey) ? todayKey : nextBusinessKey(todayKey);
  const out: { taskId: string; date: string }[] = [];
  for (const t of order) {
    while ((load[day] ?? 0) >= cap) day = nextBusinessKey(day);
    out.push({ taskId: t.id, date: day });
    load[day] = (load[day] ?? 0) + 1;
  }
  return out;
}

// UTC offset (ms) of `tz` at the instant `ms`.
function tzOffsetMs(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(ms / 1000) * 1000;
}

// The instant when it is `hhmm` ("09:00") on `key` in `tz`.
export function zonedMs(key: string, hhmm: string, tz: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = toUtc(key) + (h * 60 + m) * 60_000;
  const first = guess - tzOffsetMs(guess, tz);
  return guess - tzOffsetMs(first, tz);
}

export type Span = { start: number; end: number };

// Free windows between `from` and `to`, at least `minMin` long, once the busy spans are removed.
export function freeBlocks(busy: Span[], from: number, to: number, minMin: number): Span[] {
  const sorted = busy
    .filter((b) => b.end > from && b.start < to)
    .map((b) => ({ start: Math.max(b.start, from), end: Math.min(b.end, to) }))
    .sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  let cursor = from;
  for (const b of sorted) {
    if (b.start - cursor >= minMin * 60_000) out.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (to - cursor >= minMin * 60_000) out.push({ start: cursor, end: to });
  return out;
}

export type Candidate = { id: string; kind: "task" | "email" | "finance"; title: string; minutes: number; score: number; url?: string };
export type Planned = Candidate & { startMs: number; endMs: number };

// Highest score first, each one placed in the first free block that still fits it.
export function suggestPlan(blocks: Span[], candidates: Candidate[], gapMin = 5): { items: Planned[]; unplaced: Candidate[] } {
  const cursors = blocks.map((b) => b.start);
  const items: Planned[] = [];
  const unplaced: Candidate[] = [];
  for (const c of [...candidates].sort((a, b) => b.score - a.score)) {
    const len = c.minutes * 60_000;
    const i = blocks.findIndex((b, n) => cursors[n] + len <= b.end);
    if (i < 0) {
      unplaced.push(c);
      continue;
    }
    items.push({ ...c, startMs: cursors[i], endMs: cursors[i] + len });
    cursors[i] += len + gapMin * 60_000;
  }
  return { items: items.sort((a, b) => a.startMs - b.startMs), unplaced };
}

// How pressing a task is: overdue grows with age, due today is fixed, priority adds a bonus.
export function scoreTask(bucket: string, overdueDays: number, priority: string | null): number {
  const base = bucket === "overdue" ? 70 + Math.min(overdueDays, 20) : bucket === "today" ? 70 : 40;
  const bonus = priority === "urgent" ? 20 : priority === "high" ? 10 : 0;
  return base + bonus;
}

export type PlanPrefs = { perDay: number; start: string; end: string; taskMin: number };
export const DEFAULT_PLAN: PlanPrefs = { perDay: 3, start: "09:00", end: "18:00", taskMin: 30 };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Anything invalid falls back to the default; an end before the start resets both times.
export function normalizePlanPrefs(x: unknown): PlanPrefs {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : def;
  };
  const start = typeof o.start === "string" && HHMM.test(o.start) ? o.start : DEFAULT_PLAN.start;
  const end = typeof o.end === "string" && HHMM.test(o.end) ? o.end : DEFAULT_PLAN.end;
  const ok = start < end;
  return {
    perDay: num(o.perDay, 1, 10, DEFAULT_PLAN.perDay),
    start: ok ? start : DEFAULT_PLAN.start,
    end: ok ? end : DEFAULT_PLAN.end,
    taskMin: num(o.taskMin, 15, 240, DEFAULT_PLAN.taskMin),
  };
}
