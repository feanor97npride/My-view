import { unstable_cache } from "next/cache";
import { cache } from "react";

// Read-only ClickUp tasks from the lists the owner picked (ids from the workspace hierarchy).
const API = "https://api.clickup.com/api/v2";
export const CLICKUP_LISTS = [
  { id: "1000480000007959", name: "Sustentação CFTV · Sprint 01" },
  { id: "901321112382", name: "Projeto G.A. Plus Ultra" },
  { id: "1000480000007117", name: "Academy · Projeto Portal" },
] as const;
const LISTS = CLICKUP_LISTS.map((l) => l.id);

export function normalizeClickupList(id: unknown): string {
  return typeof id === "string" && CLICKUP_LISTS.some((l) => l.id === id) ? id : CLICKUP_LISTS[0].id;
}

export type Task = {
  id: string;
  title: string;
  list: string;
  listId: string;
  status: string;
  priority: string | null;
  due: Date | null;
  subtasks: number;
  bucket: "overdue" | "today" | "week" | "later" | "nodate";
  url: string; // opens the task in ClickUp
};

type RawTask = {
  id: string;
  name: string;
  status: { status: string; type: string };
  priority: { priority: string } | null;
  due_date: string | null;
  date_done?: string | null;
  subtasks?: unknown[];
  list: { id?: string; name: string };
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

import { getUserClickupToken } from "./prefs";
import { getCurrentUserEmail } from "./user";

async function fetchLists(query: string, token: string): Promise<RawTask[]> {
  const all = await Promise.all(
    LISTS.map(async (id) => {
      const listTasks: RawTask[] = [];
      for (let page = 0; page < 5; page++) {
        const res = await fetch(`${API}/list/${id}/task?subtasks=true&page=${page}&${query}`, {
          headers: { Authorization: token },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const { tasks, last_page } = (await res.json()) as { tasks: RawTask[]; last_page?: boolean };
        listTasks.push(...tasks);
        if (last_page || tasks.length < 100) break;
      }
      return listTasks;
    }),
  );
  return all.flat();
}

const cachedOpenRaw = unstable_cache(
  (scope: string, token: string) => {
    void scope;
    return fetchLists("include_closed=false", token);
  },
  ["clickup-open-raw"],
  { revalidate: 60, tags: ["tasks"] },
);

const cachedDoneRaw = unstable_cache(
  (scope: string, token: string, since: number) => {
    void scope;
    return fetchLists(`include_closed=true&date_done_gt=${since}`, token);
  },
  ["clickup-done-raw"],
  { revalidate: 120, tags: ["tasks"] },
);

async function requireClickup(): Promise<{ email: string; token: string }> {
  const [email, token] = await Promise.all([getCurrentUserEmail(), getUserClickupToken()]);
  if (!token) throw new Error("ClickUp não configurado para esta conta (configure em Configurações → ClickUp).");
  return { email: email ?? "", token };
}

export const openTasks = cache(async (now = new Date()): Promise<Task[]> => {
  const { email, token } = await requireClickup();
  return (await cachedOpenRaw(email, token))
    .filter((t) => !isClosed(t))
    .map((t) => {
      const due = t.due_date ? new Date(Number(t.due_date)) : null;
      return {
        id: t.id,
        title: t.name,
        list: t.list.name,
        listId: t.list.id ?? "",
        status: t.status.status,
        priority: t.priority?.priority ?? null,
        due,
        subtasks: t.subtasks?.length ?? 0,
        bucket: bucketOf(due, now),
        url: `https://app.clickup.com/t/${t.id}`,
      };
    })
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
});

const cachedUrgentCount = unstable_cache(
  async (scope: string, token: string) => {
    const raw = await cachedOpenRaw(scope, token);
    const now = new Date();
    return raw
      .filter((t) => !isClosed(t))
      .filter((t) => {
        const b = bucketOf(t.due_date ? new Date(Number(t.due_date)) : null, now);
        return b === "overdue" || b === "today";
      }).length;
  },
  ["urgent-tasks-count"],
  { revalidate: 60, tags: ["tasks"] },
);

// Overdue plus due-today tasks, cached for 60 s per user so the menu badge does not hit ClickUp on every page.
export async function urgentTasksCount(): Promise<number> {
  const [email, token] = await Promise.all([getCurrentUserEmail(), getUserClickupToken()]);
  if (!token) return 0;
  return cachedUrgentCount(email ?? "", token);
}

// When tasks were completed during the last `days` days.
export const completedDates = cache(async (days = 14, now = new Date()): Promise<Date[]> => {
  const { email, token } = await requireClickup();
  // Bucket timestamp to the hour so cache keys stay stable across requests within the same hour.
  const hourBucket = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
  const since = hourBucket - days * 86_400_000;
  return (await cachedDoneRaw(email, token, since))
    .filter((t) => isClosed(t) && t.date_done)
    .map((t) => new Date(Number(t.date_done)));
});

export async function createClickupTask(
  listId: string,
  input: { name: string; description: string; dueMs?: number | null },
): Promise<{ id: string; url: string }> {
  const { token } = await requireClickup();
  const res = await fetch(`${API}/list/${encodeURIComponent(normalizeClickupList(listId))}/task`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      ...(typeof input.dueMs === "number" ? { due_date: input.dueMs, due_date_time: false } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { id: string; url?: string };
  return { id: j.id, url: j.url ?? `https://app.clickup.com/t/${j.id}` };
}

export async function deleteClickupTask(taskId: string): Promise<void> {
  const { token } = await requireClickup();
  const res = await fetch(`${API}/task/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const clickupHeaders = async () => {
  const { token } = await requireClickup();
  return { Authorization: token, "Content-Type": "application/json" };
};

export const inScopeList = (listId: string) => CLICKUP_LISTS.some((l) => l.id === listId);

export type TaskSnapshot = { id: string; listId: string; status: string; dueMs: number | null };

// Reads the fields an action needs to undo itself, and the list so the caller can check the task is in scope.
export async function getClickupTask(taskId: string): Promise<TaskSnapshot> {
  const res = await fetch(`${API}/task/${encodeURIComponent(taskId)}`, { headers: await clickupHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const t = (await res.json()) as { id: string; status: { status: string }; due_date: string | null; list: { id: string } };
  return { id: t.id, listId: t.list.id, status: t.status.status, dueMs: t.due_date ? Number(t.due_date) : null };
}

export type ListStatus = { status: string; type: string };

export async function listStatuses(listId: string, explicitToken?: string): Promise<ListStatus[]> {
  const headers = explicitToken ? { Authorization: explicitToken, "Content-Type": "application/json" } : await clickupHeaders();
  const res = await fetch(`${API}/list/${encodeURIComponent(listId)}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { statuses?: ListStatus[] };
  return j.statuses ?? [];
}

// The status that closes a task in this list: "closed" first, then "done".
export const closingStatus = (statuses: ListStatus[]): string | null =>
  (statuses.find((s) => s.type === "closed") ?? statuses.find((s) => s.type === "done"))?.status ?? null;

export async function updateClickupTask(taskId: string, patch: { status?: string; dueMs?: number | null }): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.dueMs !== undefined) body.due_date = patch.dueMs;
  const res = await fetch(`${API}/task/${encodeURIComponent(taskId)}`, {
    method: "PUT",
    headers: await clickupHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const cachedStatusesByScope = unstable_cache(
  (listId: string, token: string) => listStatuses(listId, token),
  ["list-statuses"],
  { revalidate: 600 },
);

// Statuses per list change rarely, so the Hoje screen reads them from a 10-minute cache per token.
export async function cachedListStatuses(listId: string): Promise<ListStatus[]> {
  const token = await getUserClickupToken();
  if (!token) return [];
  return cachedStatusesByScope(listId, token);
}
