// Single-user preferences kept in Neon (table `preferences`), so they follow the owner across devices.
import { neon } from "@neondatabase/serverless";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";

import { normalizeClickupList } from "./clickup";
import { normalizeWindow } from "./day-summary";
import { normalizeAwaitingDays } from "./email-view";
import { DEFAULT_PLAN, normalizePlanPrefs, type PlanPrefs } from "./task-dates";
import { normalizeRule, type EmailRule } from "./email-rules";

const CALENDARS = "calendars";
const EMAIL_RULES = "email_rules";
const AWAITING_DAYS = "awaiting_days";
const MEETING_WINDOW = "meeting_window_min";
const CLICKUP_LIST = "default_clickup_list";
const KEYBOARD_SHORTCUTS = "keyboard_shortcuts";
const DAY_PLAN = "day_plan";

const loadPrefsMap = cache(
  unstable_cache(
    async (): Promise<Record<string, unknown>> => {
      const sql = neon(process.env.DATABASE_URL ?? "");
      const rows = await sql`SELECT key, value FROM preferences`;
      const out: Record<string, unknown> = {};
      for (const r of rows) out[String(r.key)] = r.value;
      return out;
    },
    ["preferences-all"],
    { revalidate: 120, tags: ["prefs"] },
  ),
);

async function upsertPref(key: string, value: unknown): Promise<void> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO preferences (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  revalidateTag("prefs");
}

// null = nothing saved yet, meaning "show every calendar".
export async function getSelectedCalendars(): Promise<string[] | null> {
  const map = await loadPrefsMap();
  return CALENDARS in map ? (map[CALENDARS] as string[]) : null;
}

export async function setSelectedCalendars(ids: string[]): Promise<void> {
  await upsertPref(CALENDARS, ids);
}

// Sender rules the owner edits in Configurações. Anything that no longer validates is dropped on read.
export async function getEmailRules(): Promise<EmailRule[]> {
  const map = await loadPrefsMap();
  const raw = (map[EMAIL_RULES] ?? []) as { match: string; category: string }[];
  return raw.map(normalizeRule).filter((r): r is EmailRule => r !== null);
}

export async function setEmailRules(rules: EmailRule[]): Promise<void> {
  await upsertPref(EMAIL_RULES, rules);
}

// Minutes before a meeting when the alert starts showing; 30 until the owner changes it.
export async function getMeetingWindow(): Promise<number> {
  const map = await loadPrefsMap();
  return normalizeWindow(map[MEETING_WINDOW]);
}

export async function setMeetingWindow(minutes: number): Promise<void> {
  await upsertPref(MEETING_WINDOW, normalizeWindow(minutes));
}

// Days without an answer before a sent conversation counts as "aguardando resposta"; 2 until the owner changes it.
export async function getAwaitingDays(): Promise<number> {
  const map = await loadPrefsMap();
  return normalizeAwaitingDays(map[AWAITING_DAYS]);
}

export async function setAwaitingDays(days: number): Promise<void> {
  await upsertPref(AWAITING_DAYS, normalizeAwaitingDays(days));
}

// Default ClickUp list when turning an e-mail into a task.
export async function getDefaultClickupList(): Promise<string> {
  const map = await loadPrefsMap();
  return normalizeClickupList(map[CLICKUP_LIST]);
}

export async function setDefaultClickupList(id: string): Promise<void> {
  await upsertPref(CLICKUP_LIST, normalizeClickupList(id));
}

// Keyboard shortcuts on the E-mails triage desk; enabled until the owner disables them.
export async function getKeyboardShortcutsEnabled(): Promise<boolean> {
  const map = await loadPrefsMap();
  return KEYBOARD_SHORTCUTS in map ? Boolean(map[KEYBOARD_SHORTCUTS]) : true;
}

export async function setKeyboardShortcutsEnabled(enabled: boolean): Promise<void> {
  await upsertPref(KEYBOARD_SHORTCUTS, Boolean(enabled));
}

// Day plan: overdue tasks per day, work hours and default block length.
export async function getPlanPrefs(): Promise<PlanPrefs> {
  const map = await loadPrefsMap();
  return DAY_PLAN in map ? normalizePlanPrefs(map[DAY_PLAN]) : DEFAULT_PLAN;
}

export async function setPlanPrefs(prefs: Partial<PlanPrefs>): Promise<void> {
  await upsertPref(DAY_PLAN, normalizePlanPrefs(prefs));
}
