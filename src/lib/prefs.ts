// Single-user preferences kept in Neon (table `preferences`), so they follow the owner across devices.
import { neon } from "@neondatabase/serverless";

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

// null = nothing saved yet, meaning "show every calendar".
export async function getSelectedCalendars(): Promise<string[] | null> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`SELECT value FROM preferences WHERE key = ${CALENDARS}`;
  return rows[0] ? (rows[0].value as string[]) : null;
}

export async function setSelectedCalendars(ids: string[]): Promise<void> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO preferences (key, value) VALUES (${CALENDARS}, ${JSON.stringify(ids)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// Sender rules the owner edits in Configurações. Anything that no longer validates is dropped on read.
export async function getEmailRules(): Promise<EmailRule[]> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`SELECT value FROM preferences WHERE key = ${EMAIL_RULES}`;
  const raw = (rows[0]?.value ?? []) as { match: string; category: string }[];
  return raw.map(normalizeRule).filter((r): r is EmailRule => r !== null);
}

export async function setEmailRules(rules: EmailRule[]): Promise<void> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO preferences (key, value) VALUES (${EMAIL_RULES}, ${JSON.stringify(rules)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// Minutes before a meeting when the alert starts showing; 30 until the owner changes it.
export async function getMeetingWindow(): Promise<number> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`SELECT value FROM preferences WHERE key = ${MEETING_WINDOW}`;
  return normalizeWindow(rows[0]?.value);
}

export async function setMeetingWindow(minutes: number): Promise<void> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO preferences (key, value) VALUES (${MEETING_WINDOW}, ${JSON.stringify(normalizeWindow(minutes))}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// Days without an answer before a sent conversation counts as "aguardando resposta"; 2 until the owner changes it.
export async function getAwaitingDays(): Promise<number> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`SELECT value FROM preferences WHERE key = ${AWAITING_DAYS}`;
  return normalizeAwaitingDays(rows[0]?.value);
}

export async function setAwaitingDays(days: number): Promise<void> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO preferences (key, value) VALUES (${AWAITING_DAYS}, ${JSON.stringify(normalizeAwaitingDays(days))}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// Default ClickUp list when turning an e-mail into a task.
export async function getDefaultClickupList(): Promise<string> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`SELECT value FROM preferences WHERE key = ${CLICKUP_LIST}`;
  return normalizeClickupList(rows[0]?.value);
}

export async function setDefaultClickupList(id: string): Promise<void> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO preferences (key, value) VALUES (${CLICKUP_LIST}, ${JSON.stringify(normalizeClickupList(id))}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// Keyboard shortcuts on the E-mails triage desk; enabled until the owner disables them.
export async function getKeyboardShortcutsEnabled(): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`SELECT value FROM preferences WHERE key = ${KEYBOARD_SHORTCUTS}`;
  return rows[0] ? Boolean(rows[0].value) : true;
}

export async function setKeyboardShortcutsEnabled(enabled: boolean): Promise<void> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO preferences (key, value) VALUES (${KEYBOARD_SHORTCUTS}, ${JSON.stringify(Boolean(enabled))}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// Day plan: overdue tasks per day, work hours and default block length.
export async function getPlanPrefs(): Promise<PlanPrefs> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`SELECT value FROM preferences WHERE key = ${DAY_PLAN}`;
  return rows[0] ? normalizePlanPrefs(rows[0].value) : DEFAULT_PLAN;
}

export async function setPlanPrefs(prefs: Partial<PlanPrefs>): Promise<void> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO preferences (key, value) VALUES (${DAY_PLAN}, ${JSON.stringify(normalizePlanPrefs(prefs))}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}
