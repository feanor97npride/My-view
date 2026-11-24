// Per-user preferences kept in Neon (table `preferences`), isolated by user_email prefix.
import { neon } from "@neondatabase/serverless";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";

import { decryptSecret, encryptSecret } from "./crypto";
import { normalizeClickupList } from "./clickup";
import { normalizeWindow } from "./day-summary";
import { normalizeAwaitingDays } from "./email-view";
import { DEFAULT_PLAN, normalizePlanPrefs, type PlanPrefs } from "./task-dates";
import { normalizeRule, QUEUE_CATEGORIES, type CustomCategory, type EmailRule, type QueueCategory } from "./email-rules";
import { getCurrentUserEmail } from "./user";

const CALENDARS = "calendars";
const EMAIL_RULES = "email_rules";
const CUSTOM_CATEGORIES = "custom_categories";
const AWAITING_DAYS = "awaiting_days";
const MEETING_WINDOW = "meeting_window_min";
const CLICKUP_LIST = "default_clickup_list";
const CLICKUP_TOKEN = "clickup_token";
const KEYBOARD_SHORTCUTS = "keyboard_shortcuts";
const DAY_PLAN = "day_plan";
const QUICK_NOTES = "quick_notes";
const SNOOZED_EMAILS = "snoozed_emails";
const REPLY_TEMPLATES = "reply_templates";
const ASSISTANT_MEMORY = "assistant_memory";
const ASSISTANT_HISTORY = "assistant_history";
const OBSIDIAN_VAULT = "obsidian_vault";
const GITHUB_TOKEN = "github_token";
const GOOGLE_TTS_KEY = "google_tts_key";
const AUTOMATION_PREFS = "automation_prefs";
const DAILY_BRIEFING_CACHE = "daily_briefing_cache";
const AUTOMATION_STATE = "automation_state";
const AUTO_READ_EMAILS = "auto_read_emails";

export type ReplyTemplate = { id: string; label: string; body: string };
export type StoredChatMsg = { role: "user" | "assistant"; content: string; actions?: string[] };
export type AutomationPrefs = {
  autoBriefing: boolean;
  autoReplan: boolean;
  autoFollowupTask: boolean;
};
export type CachedDailyBriefing = { dateKey: string; text: string; updatedAt: string };
export type AutomationState = {
  lastReplanDate?: string;
  followupThreads?: Record<string, string>;
};

export const DEFAULT_AUTOMATIONS: AutomationPrefs = {
  autoBriefing: true,
  autoReplan: false,
  autoFollowupTask: false,
};

export const DEFAULT_REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: "tpl-1",
    label: "Recebido, analiso em breve",
    body: "Olá,\n\nRecebi sua mensagem. Vou analisar com atenção e te retorno assim que possível.\n\nObrigado!",
  },
  {
    id: "tpl-2",
    label: "Confirmando recebimento",
    body: "Olá,\n\nConfirmando o recebimento por aqui. Qualquer novidade, te aviso.\n\nAbraço!",
  },
  {
    id: "tpl-3",
    label: "Retorno amanhã",
    body: "Olá,\n\nObrigado pelo envio. Consigo olhar este ponto amanhã e já te dou um retorno.\n\nObrigado!",
  },
];

function primaryAllowedEmail(): string | null {
  const raw = process.env.ALLOWED_EMAILS?.trim() || process.env.ALLOWED_EMAIL?.trim() || "";
  const first = raw
    .split(/[\s,;]+/)
    .map((s) => s.replace(/^["']+|["']+$/g, "").trim().toLowerCase())
    .find((s) => s && s !== "*");
  return first ?? null;
}

const fetchPrefsByUser = unstable_cache(
  async (email: string): Promise<Record<string, unknown>> => {
    const sql = neon(process.env.DATABASE_URL ?? "");
    const prefix = `${email}:`;
    const isPrimary = email !== "" && email === primaryAllowedEmail();
    const rows = isPrimary
      ? await sql`SELECT key, value FROM preferences WHERE key LIKE ${prefix + "%"} OR key NOT LIKE '%:%'`
      : await sql`SELECT key, value FROM preferences WHERE key LIKE ${prefix + "%"}`;
    const out: Record<string, unknown> = {};
    // Legacy keys (without prefix) are loaded first so user-prefixed keys always take precedence.
    for (const r of rows) {
      const k = String(r.key);
      if (!k.includes(":")) out[k] = r.value;
    }
    for (const r of rows) {
      const k = String(r.key);
      if (k.startsWith(prefix)) out[k.slice(prefix.length)] = r.value;
    }
    return out;
  },
  ["preferences-by-user"],
  { revalidate: 120, tags: ["prefs"] },
);

const loadPrefsMap = cache(async (): Promise<Record<string, unknown>> => {
  const email = await getCurrentUserEmail();
  if (!email) return {};
  return fetchPrefsByUser(email);
});

async function upsertPref(key: string, value: unknown): Promise<void> {
  const email = await getCurrentUserEmail();
  if (!email) throw new Error("Não autenticado");
  const scopedKey = `${email}:${key}`;
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`
    INSERT INTO preferences (key, value) VALUES (${scopedKey}, ${JSON.stringify(value)}::jsonb)
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

const VALID_CHIPS = new Set([
  "chip-violet", "chip-green", "chip-blue", "chip-amber", "chip-pink", "chip-teal", "chip-red", "chip-slate",
]);

export async function getCustomCategories(): Promise<CustomCategory[]> {
  const map = await loadPrefsMap();
  const raw = map[CUSTOM_CATEGORIES];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is CustomCategory => !!c && typeof c === "object" && typeof (c as CustomCategory).id === "string" && typeof (c as CustomCategory).label === "string")
    .map((c) => ({
      id: c.id.trim().toLowerCase().slice(0, 32),
      label: c.label.trim().slice(0, 40),
      queue: (QUEUE_CATEGORIES as readonly string[]).includes(c.queue) ? (c.queue as QueueCategory) : "trabalho",
      chip: VALID_CHIPS.has(c.chip) ? c.chip : "chip-violet",
    }))
    .filter((c) => c.id.length >= 2 && c.label.length >= 1)
    .slice(0, 25);
}

export async function setCustomCategories(cats: CustomCategory[]): Promise<void> {
  const seen = new Set<string>();
  const clean: CustomCategory[] = [];
  for (const c of cats) {
    const id = c.id.trim().toLowerCase().slice(0, 32);
    const label = c.label.trim().slice(0, 40);
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    clean.push({
      id,
      label,
      queue: (QUEUE_CATEGORIES as readonly string[]).includes(c.queue) ? c.queue : "trabalho",
      chip: VALID_CHIPS.has(c.chip) ? c.chip : "chip-violet",
    });
  }
  await upsertPref(CUSTOM_CATEGORIES, clean.slice(0, 25));
}

// Sender rules the owner edits in Configurações. Anything that no longer validates is dropped on read.
export async function getEmailRules(): Promise<EmailRule[]> {
  const [map, custom] = await Promise.all([loadPrefsMap(), getCustomCategories()]);
  const customIds = custom.map((c) => c.id);
  const raw = (map[EMAIL_RULES] ?? []) as { match: string; category: string }[];
  return raw.map((r) => normalizeRule(r, customIds)).filter((r): r is EmailRule => r !== null);
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

// Per-user ClickUp token; falls back to CLICKUP_API_TOKEN only for the primary owner account.
export async function getUserClickupToken(): Promise<string | null> {
  const email = await getCurrentUserEmail();
  if (!email) return null;
  const map = await loadPrefsMap();
  if (CLICKUP_TOKEN in map) {
    const v = typeof map[CLICKUP_TOKEN] === "string" ? decryptSecret(map[CLICKUP_TOKEN]) : "";
    return v || null;
  }
  if (email === primaryAllowedEmail()) {
    return process.env.CLICKUP_API_TOKEN?.trim() || null;
  }
  return null;
}

export async function setUserClickupToken(token: string): Promise<void> {
  await upsertPref(CLICKUP_TOKEN, encryptSecret(token));
  revalidateTag("tasks");
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

export async function getQuickNotes(): Promise<string> {
  const map = await loadPrefsMap();
  return typeof map[QUICK_NOTES] === "string" ? map[QUICK_NOTES] : "";
}

export async function setQuickNotes(text: string): Promise<void> {
  await upsertPref(QUICK_NOTES, text.slice(0, 10_000));
}

export async function getSnoozedEmails(): Promise<Record<string, string>> {
  const map = await loadPrefsMap();
  const raw = map[SNOOZED_EMAILS];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) out[k] = v;
  }
  return out;
}

export async function setSnoozedEmails(next: Record<string, string>): Promise<void> {
  await upsertPref(SNOOZED_EMAILS, next);
}

export async function getReplyTemplates(): Promise<ReplyTemplate[]> {
  const map = await loadPrefsMap();
  const raw = map[REPLY_TEMPLATES];
  if (!Array.isArray(raw)) return DEFAULT_REPLY_TEMPLATES;
  const list = raw
    .filter((x): x is ReplyTemplate => !!x && typeof x === "object" && typeof (x as ReplyTemplate).label === "string" && typeof (x as ReplyTemplate).body === "string")
    .map((x, idx) => ({ id: x.id || `tpl-${idx}`, label: x.label.trim().slice(0, 50), body: x.body.trim().slice(0, 2000) }))
    .filter((x) => x.label && x.body)
    .slice(0, 10);
  return list.length > 0 ? list : DEFAULT_REPLY_TEMPLATES;
}

export async function setReplyTemplates(list: ReplyTemplate[]): Promise<void> {
  const clean = list
    .map((x, idx) => ({ id: x.id || `tpl-${idx}`, label: x.label.trim().slice(0, 50), body: x.body.trim().slice(0, 2000) }))
    .filter((x) => x.label && x.body)
    .slice(0, 10);
  await upsertPref(REPLY_TEMPLATES, clean);
}

export async function getAssistantMemory(): Promise<string[]> {
  const map = await loadPrefsMap();
  const raw = map[ASSISTANT_MEMORY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 60);
}

export async function setAssistantMemory(facts: string[]): Promise<void> {
  const clean = [...new Set(facts.map((f) => f.trim().slice(0, 200)).filter(Boolean))].slice(0, 60);
  await upsertPref(ASSISTANT_MEMORY, clean);
}

export async function addAssistantMemory(fact: string): Promise<string[]> {
  const current = await getAssistantMemory();
  const next = [...current, fact.trim().slice(0, 200)];
  await setAssistantMemory(next);
  return getAssistantMemory();
}

export async function getAssistantHistory(): Promise<StoredChatMsg[]> {
  const map = await loadPrefsMap();
  const raw = map[ASSISTANT_HISTORY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is StoredChatMsg =>
        !!m &&
        typeof m === "object" &&
        ((m as StoredChatMsg).role === "user" || (m as StoredChatMsg).role === "assistant") &&
        typeof (m as StoredChatMsg).content === "string",
    )
    .slice(-20);
}

export async function setAssistantHistory(messages: StoredChatMsg[]): Promise<void> {
  const clean = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim().length > 0)
    .slice(-20)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 4000),
      ...(m.actions?.length ? { actions: m.actions.slice(0, 10) } : {}),
    }));
  await upsertPref(ASSISTANT_HISTORY, clean);
}

export async function getObsidianVault(): Promise<string> {
  const map = await loadPrefsMap();
  return typeof map[OBSIDIAN_VAULT] === "string" ? map[OBSIDIAN_VAULT] : "";
}

export async function setObsidianVault(vault: string): Promise<void> {
  await upsertPref(OBSIDIAN_VAULT, vault.trim().slice(0, 100));
}

export async function getUserGithubToken(): Promise<string | null> {
  const email = await getCurrentUserEmail();
  const map = await loadPrefsMap();
  if (GITHUB_TOKEN in map) {
    const val = typeof map[GITHUB_TOKEN] === "string" ? decryptSecret(map[GITHUB_TOKEN]) : "";
    return val || null;
  }
  const primary = primaryAllowedEmail();
  if (!primary || email === primary) {
    return process.env.GITHUB_TOKEN?.trim() || null;
  }
  return null;
}

export async function setUserGithubToken(token: string): Promise<void> {
  await upsertPref(GITHUB_TOKEN, encryptSecret(token));
  revalidateTag("github");
}

export async function getUserGoogleTtsKey(): Promise<string | null> {
  const email = await getCurrentUserEmail();
  const map = await loadPrefsMap();
  if (GOOGLE_TTS_KEY in map) {
    const val = typeof map[GOOGLE_TTS_KEY] === "string" ? decryptSecret(map[GOOGLE_TTS_KEY]) : "";
    return val || null;
  }
  const primary = primaryAllowedEmail();
  if (!primary || email === primary) {
    return process.env.GOOGLE_TTS_API_KEY?.trim() || null;
  }
  return null;
}

export async function setUserGoogleTtsKey(key: string): Promise<void> {
  await upsertPref(GOOGLE_TTS_KEY, encryptSecret(key));
}

export async function getAutomationPrefs(): Promise<AutomationPrefs> {
  const map = await loadPrefsMap();
  const raw = map[AUTOMATION_PREFS];
  if (!raw || typeof raw !== "object") return DEFAULT_AUTOMATIONS;
  const o = raw as Record<string, unknown>;
  return {
    autoBriefing: typeof o.autoBriefing === "boolean" ? o.autoBriefing : DEFAULT_AUTOMATIONS.autoBriefing,
    autoReplan: typeof o.autoReplan === "boolean" ? o.autoReplan : DEFAULT_AUTOMATIONS.autoReplan,
    autoFollowupTask: typeof o.autoFollowupTask === "boolean" ? o.autoFollowupTask : DEFAULT_AUTOMATIONS.autoFollowupTask,
  };
}

export async function setAutomationPrefs(prefs: AutomationPrefs): Promise<void> {
  await upsertPref(AUTOMATION_PREFS, {
    autoBriefing: Boolean(prefs.autoBriefing),
    autoReplan: Boolean(prefs.autoReplan),
    autoFollowupTask: Boolean(prefs.autoFollowupTask),
  });
}

export async function getCachedDailyBriefing(dateKey: string): Promise<string | null> {
  const map = await loadPrefsMap();
  const raw = map[DAILY_BRIEFING_CACHE];
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<CachedDailyBriefing>;
  if (o.dateKey === dateKey && typeof o.text === "string" && o.text.trim()) {
    return o.text;
  }
  return null;
}

export async function setCachedDailyBriefing(dateKey: string, text: string): Promise<void> {
  const payload: CachedDailyBriefing = {
    dateKey,
    text: text.slice(0, 6000),
    updatedAt: new Date().toISOString(),
  };
  await upsertPref(DAILY_BRIEFING_CACHE, payload);
}

export async function getAutomationState(): Promise<AutomationState> {
  const map = await loadPrefsMap();
  const raw = map[AUTOMATION_STATE];
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Partial<AutomationState>;
  return {
    lastReplanDate: typeof o.lastReplanDate === "string" ? o.lastReplanDate : undefined,
    followupThreads:
      o.followupThreads && typeof o.followupThreads === "object"
        ? (o.followupThreads as Record<string, string>)
        : undefined,
  };
}

export async function setAutomationState(state: AutomationState): Promise<void> {
  const entries = Object.entries(state.followupThreads ?? {}).slice(-100);
  await upsertPref(AUTOMATION_STATE, {
    ...(state.lastReplanDate ? { lastReplanDate: state.lastReplanDate } : {}),
    followupThreads: Object.fromEntries(entries),
  });
}

export async function getAutoReadEmailRules(): Promise<string[]> {
  const map = await loadPrefsMap();
  const raw = map[AUTO_READ_EMAILS];
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === "string").map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, 30);
}

export async function setAutoReadEmailRules(rules: string[]): Promise<void> {
  const clean = [...new Set(rules.map((s) => s.trim().toLowerCase().slice(0, 100)).filter(Boolean))].slice(0, 30);
  await upsertPref(AUTO_READ_EMAILS, clean);
}
