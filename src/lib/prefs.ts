// Single-user preferences kept in Neon (table `preferences`), so they follow the owner across devices.
import { neon } from "@neondatabase/serverless";

import { normalizeWindow } from "./day-summary";
import { normalizeRule, type EmailRule } from "./email-rules";

const CALENDARS = "calendars";
const EMAIL_RULES = "email_rules";
const MEETING_WINDOW = "meeting_window_min";

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
