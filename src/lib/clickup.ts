// Read-only ClickUp tasks from the lists the owner picked (ids from the workspace hierarchy).
const API = "https://api.clickup.com/api/v2";
const LISTS = [
  "1000480000007959", // Sustentação CFTV · Sprint 01 · 12/11 a 27/11
  "901321112382", // Projeto G.A. Plus Ultra
  "1000480000007117", // Academy · Projeto Portal
];

export type Task = {
  id: string;
  title: string;
  list: string;
  status: string;
  priority: string | null;
  due: Date | null;
  subtasks: number;
  bucket: "overdue" | "today" | "week" | "later" | "nodate";
};

type RawTask = {
  id: string;
  name: string;
  status: { status: string; type: string };
  priority: { priority: string } | null;
  due_date: string | null;
  date_done?: string | null;
  subtasks?: unknown[];
  list: { name: string };
};

// Statuses that mean the same across lists, merged in charts only.
// shortcut: hand-kept map, add an entry when a list gets a new status name.
const STATUS_ALIAS: Record<string, string> = {
  "in progress": "Em andamento",
  "em progresso": "Em andamento",
  "to do": "A fazer",
  pendente: "A fazer",
  "eu - pendente": "A fazer",
};
export const canonicalStatus = (s: string) => STATUS_ALIAS[s.trim().toLowerCase()] ?? s;

const isClosed = (t: RawTask) => ["closed", "done"].includes(t.status.type);

// Groups a task by how urgent it is relative to `now` (ms epoch of the due date).
export function bucketOf(due: Date | null, now: Date): Task["bucket"] {
  if (!due) return "nodate";
  const t = due.getTime();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (t < now.getTime()) return "overdue";
  if (t <= endOfToday.getTime()) return "today";
  if (t <= now.getTime() + 7 * 86_400_000) return "week";
  return "later";
}

// Counts dates per calendar day (in `tz`) for the last `days` days, oldest first, zero-filled.
export function countByDay(dates: Date[], days: number, tz: string, now = new Date()): { day: string; n: number }[] {
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
  const out = Array.from({ length: days }, (_, i) => ({
    day: key(new Date(now.getTime() - (days - 1 - i) * 86_400_000)),
    n: 0,
  }));
  for (const d of dates) {
    const row = out.find((r) => r.day === key(d));
    if (row) row.n++;
  }
  return out;
}

async function fetchLists(query: string): Promise<RawTask[]> {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN não configurado");
  const all = await Promise.all(
    LISTS.map(async (id) => {
      // shortcut: only the first 100 tasks per list (one page), enough for a daily view
      const res = await fetch(`${API}/list/${id}/task?subtasks=true&${query}`, {
        headers: { Authorization: token },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const { tasks } = (await res.json()) as { tasks: RawTask[] };
      return tasks;
    }),
  );
  return all.flat();
}

export async function openTasks(now = new Date()): Promise<Task[]> {
  return (await fetchLists("include_closed=false"))
    .filter((t) => !isClosed(t))
    .map((t) => {
      const due = t.due_date ? new Date(Number(t.due_date)) : null;
      return {
        id: t.id,
        title: t.name,
        list: t.list.name,
        status: t.status.status,
        priority: t.priority?.priority ?? null,
        due,
        subtasks: t.subtasks?.length ?? 0,
        bucket: bucketOf(due, now),
      };
    })
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
}

// When tasks were completed during the last `days` days.
export async function completedDates(days = 14, now = new Date()): Promise<Date[]> {
  const since = now.getTime() - days * 86_400_000;
  return (await fetchLists(`include_closed=true&date_done_gt=${since}`))
    .filter((t) => isClosed(t) && t.date_done)
    .map((t) => new Date(Number(t.date_done)));
}
