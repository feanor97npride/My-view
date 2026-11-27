// Read-only Gmail metadata (sender, subject, date, unread) classified into categories.
// Bodies are never fetched or stored. The short Gmail snippet is shown in the list but kept in memory only.
import { neon } from "@neondatabase/serverless";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { ANTHROPIC_MODEL } from "./ai";
import { BULK_CATEGORIES, CATEGORIES, categorize, isCategory, parseCategory, type Category, type EmailRule } from "./email-rules";
import { pickAwaiting, type Awaiting, type EmailItem, type ThreadLike } from "./email-view";
import { logWarn } from "./logger";
import { getEmailRules } from "./prefs";
import { getCurrentUserEmail } from "./user";

// Returns a category, or a short error code (stored in classified_by so failures are visible in the database).
const MAX_BULK_AI = 15;
const CATEGORY_HELP =
  "acao = precisa de ação do destinatário; financeiro = cobranças, pagamentos, bancos; agendamento = reuniões, convites, reservas de horário; trabalho = relacionado a trabalho; pessoal = relacionamentos e vida pessoal; compras = pedidos, entregas e rastreio de compras; viagens = passagens, hotéis, check-in, roteiros; seguranca = alertas de login, códigos de verificação, redefinição de senha, atividade suspeita; saude = consultas, exames, planos de saúde, farmácia; educacao = cursos, aulas, escola, faculdade, certificados; social = redes sociais e comunidades (notificações, menções, convites de amizade); promocao = ofertas, cupons e marketing; informativo = só para saber, newsletters e avisos genéricos. Prefira a categoria mais específica quando ela claramente se aplica.";

// `allowed` narrows the answer (bulk mail is only ever a handful of categories). Without it every category is allowed.
async function classifyWithAI(sender: string, subject: string, allowed: readonly string[] = CATEGORIES): Promise<Category | string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return "nokey";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024, // the model may emit a thinking block first; 200 was not always enough for the answer to follow
        messages: [
          {
            role: "user",
            content: `Classifique este e-mail em UMA palavra: ${allowed.join(", ")}.\n${CATEGORY_HELP}\nResponda apenas com a palavra.\nRemetente: ${sender}\nAssunto: ${subject}`,
          },
        ],
      }),
    });
    if (!res.ok) return `http${res.status}`;
    // Reads the text block wherever it is; records block types when no category is found, to diagnose the reply shape.
    const j = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = j.content?.find((b) => b.type === "text")?.text ?? "";
    return parseCategory(text, allowed) ?? `badreply:${(j.content ?? []).map((b) => b.type).join("+") || "empty"}`;
  } catch {
    // shortcut: any AI failure falls back to "informativo" so one bad key never blocks the inbox, upgrade to a retry queue when it matters
    return "network";
  }
}

import type { EmailAttachment } from "./triage";

type GPart = {
  filename?: string;
  mimeType?: string;
  body?: { size?: number; attachmentId?: string };
  parts?: GPart[];
};

type GMsg = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate: string;
  labelIds?: string[];
  payload: { headers?: { name: string; value: string }[]; parts?: GPart[]; filename?: string; mimeType?: string; body?: { size?: number; attachmentId?: string } };
};

function extractAttachments(part: GPart | undefined): EmailAttachment[] {
  if (!part) return [];
  const out: EmailAttachment[] = [];
  if (part.filename && part.body?.attachmentId) {
    out.push({
      id: part.body.attachmentId,
      filename: part.filename,
      mimeType: part.mimeType ?? "application/octet-stream",
      size: part.body.size ?? 0,
    });
  }
  for (const child of part.parts ?? []) out.push(...extractAttachments(child));
  return out;
}

const MSG_FIELDS =
  "id,threadId,snippet,internalDate,labelIds,payload(headers,filename,mimeType,body(size,attachmentId),parts(filename,mimeType,body(size,attachmentId),parts(filename,mimeType,body(size,attachmentId),parts(filename,mimeType,body(size,attachmentId)))))";

export async function getAttachment(token: string, messageId: string, attachmentId: string): Promise<Buffer> {
  const res = await gget<{ data?: string }>(`/messages/${messageId}/attachments/${attachmentId}`, token);
  const b64 = (res.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

type FullPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: FullPart[];
};

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function collectPartText(part: FullPart | undefined, targetMime: "text/plain" | "text/html"): string[] {
  if (!part) return [];
  const out: string[] = [];
  if (part.mimeType?.toLowerCase().startsWith(targetMime) && part.body?.data) {
    out.push(decodeBase64Url(part.body.data));
  }
  for (const child of part.parts ?? []) {
    out.push(...collectPartText(child, targetMime));
  }
  return out;
}

// Fetches clean readable text on demand (in memory only — never stored in Postgres).
export async function getEmailPlainText(token: string, messageId: string): Promise<string> {
  const msg = await gget<{ snippet?: string; payload?: FullPart }>(
    `/messages/${encodeURIComponent(messageId)}?format=full`,
    token,
  );
  const plainParts = collectPartText(msg.payload, "text/plain");
  let raw = plainParts.join("\n").trim();
  if (!raw) {
    const htmlParts = collectPartText(msg.payload, "text/html");
    raw = stripHtmlToText(htmlParts.join("\n")).trim();
  }
  if (!raw) raw = msg.snippet ?? "";
  return raw
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 12_000);
}

export async function summarizeNewsletterWithAI(subject: string, bodyText: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: `Faça um resumo falado executivo em português (para ouvir em cerca de 30 segundos, 3 a 5 frases curtas e naturais, sem markdown nem símbolos) dos principais destaques desta newsletter.\n\nAssunto: ${subject}\n\nConteúdo:\n${bodyText.slice(0, 7000)}`,
        },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = j.content?.find((b) => b.type === "text")?.text?.trim();
  if (!text) throw new Error("A IA não retornou um resumo.");
  return text;
}

async function mapConcurrent<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

const isQuotaError = (status: number, body: string) =>
  status === 429 || (status === 403 && /quota|rateLimitExceeded|userRateLimitExceeded|Total Query Cost/i.test(body));

async function gmailFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (res.ok) return res;
    const text = await res.text();
    if (attempt < maxAttempts - 1 && isQuotaError(res.status, text)) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 6000)
        : 1200 * 2 ** attempt + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, backoffMs));
      continue;
    }
    if (isQuotaError(res.status, text)) {
      throw new Error("Cota temporária do Gmail atingida (Total Query Cost). Aguarde ~1 minuto e tente novamente.");
    }
    throw new Error(`Gmail ${res.status}: ${text.slice(0, 200)}`);
  }
  throw new Error("Cota temporária do Gmail atingida (Total Query Cost). Aguarde ~1 minuto e tente novamente.");
}

async function gget<T>(path: string, token: string): Promise<T> {
  const res = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, token);
  return res.json();
}

async function gpost(path: string, token: string, body: unknown): Promise<void> {
  await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function fallbackEmailsFromDb(userEmail: string) {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`
    SELECT id, sender, subject, received_at, unread, category
    FROM emails
    WHERE user_email = ${userEmail}
    ORDER BY received_at DESC
    LIMIT 25`;
  const counts = await fetchEmailCountsByUser(userEmail);
  return {
    counts,
    emails: rows.map((r): Omit<EmailItem, "receivedAt"> & { receivedAt: string } => ({
      id: String(r.id),
      threadId: String(r.id),
      sender: String(r.sender ?? ""),
      subject: String(r.subject ?? "(sem assunto)"),
      receivedAt: new Date(r.received_at as string | Date).toISOString(),
      unread: Boolean(r.unread),
      category: String(r.category ?? "informativo"),
      snippet: "",
      attachments: [] as EmailAttachment[],
    })),
    nextPageToken: null,
  };
}

async function syncEmailsUncached(token: string, userEmail: string, userRules: EmailRule[], pageToken?: string) {
  const q = encodeURIComponent("is:unread OR newer_than:7d OR in:inbox");
  const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
  let list: { messages?: { id: string }[]; nextPageToken?: string };
  let msgs: GMsg[];
  try {
    list = await gget<{ messages?: { id: string }[]; nextPageToken?: string }>(
      `/messages?q=${q}&maxResults=20${pageParam}`,
      token,
    );
    msgs = await mapConcurrent(
      list.messages ?? [],
      2,
      (m) => gget<GMsg>(`/messages/${m.id}?format=full&fields=${encodeURIComponent(MSG_FIELDS)}`, token),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!pageToken && /Cota temporária do Gmail|quota|429/i.test(msg)) {
      logWarn("gmail", "Usando fallback do Postgres devido à cota do Gmail", err);
      return fallbackEmailsFromDb(userEmail);
    }
    throw err;
  }

  const sql = neon(process.env.DATABASE_URL ?? "");
  const ids = msgs.map((m) => m.id);
  const known = ids.length
    ? await sql`SELECT id, category, classified_by FROM emails WHERE id = ANY(${ids}) AND (user_email = ${userEmail} OR user_email = '')`
    : [];
  const knownMap = new Map(known.map((r) => [r.id as string, r]));

  type DraftItem = {
    m: GMsg;
    sender: string;
    subject: string;
    category?: string;
    by?: string;
    needsAi?: { allowed: readonly string[]; isBulk: boolean };
  };

  let bulkBudget = MAX_BULK_AI;
  const drafts: DraftItem[] = [];
  for (const m of msgs) {
    const headers = m.payload.headers ?? [];
    const h = (n: string) => headers.find((x) => x.name === n)?.value ?? "";
    const sender = h("From");
    const subject = h("Subject") || "(sem assunto)";
    const hasUnsub = headers.some((x) => x.name.toLowerCase() === "list-unsubscribe");
    const old = knownMap.get(m.id);
    let category = old?.category as string | undefined;
    let by = old?.classified_by as string | undefined;
    let needsAi: DraftItem["needsAi"];
    const decided = categorize(sender, subject, hasUnsub, userRules);
    if (decided && decided.by === "rule:bulk") {
      if (old?.classified_by === "ai:bulk" && (BULK_CATEGORIES as readonly string[]).includes(old.category as string)) {
        category = old.category as Category;
        by = "ai:bulk";
      } else {
        category = decided.category;
        by = decided.by;
        if (bulkBudget > 0) {
          bulkBudget--;
          needsAi = { allowed: BULK_CATEGORIES, isBulk: true };
        }
      }
    } else if (decided) {
      category = decided.category;
      by = decided.by;
    } else if (!category || by?.startsWith("fallback") || by?.startsWith("rule")) {
      needsAi = { allowed: CATEGORIES, isBulk: false };
    }
    drafts.push({ m, sender, subject, category, by, needsAi });
  }

  // Run pending AI classifications with bounded concurrency (3) to avoid rate-limits while staying ~3x faster.
  const pendingAi = drafts.filter((d) => d.needsAi);
  for (let i = 0; i < pendingAi.length; i += 3) {
    await Promise.all(
      pendingAi.slice(i, i + 3).map(async (d) => {
        const ai = await classifyWithAI(d.sender, d.subject, d.needsAi!.allowed);
        if (isCategory(ai)) {
          d.category = ai;
          d.by = d.needsAi!.isBulk ? "ai:bulk" : "ai";
        } else if (!d.needsAi!.isBulk) {
          d.category = "informativo";
          d.by = `fallback:${ai}`;
        }
      }),
    );
  }

  const rows: Record<string, unknown>[] = [];
  const emails: (Omit<EmailItem, "receivedAt"> & { receivedAt: string })[] = [];
  for (const d of drafts) {
    const receivedAt = new Date(Number(d.m.internalDate)).toISOString();
    const unread = d.m.labelIds?.includes("UNREAD") ?? false;
    rows.push({
      id: d.m.id,
      sender: d.sender,
      subject: d.subject,
      received_at: receivedAt,
      unread,
      category: d.category,
      classified_by: d.by,
      user_email: userEmail,
    });
    emails.push({
      id: d.m.id,
      threadId: d.m.threadId,
      sender: d.sender,
      subject: d.subject,
      receivedAt,
      unread,
      category: d.category as string,
      snippet: d.m.snippet ?? "", // raw: still HTML-encoded, decoded where it is displayed
      attachments: extractAttachments(d.m.payload),
    });
  }

  if (rows.length) {
    await sql`
      INSERT INTO emails (id, sender, subject, received_at, unread, category, classified_by, user_email, updated_at)
      SELECT id, sender, subject, received_at, unread, category, classified_by, user_email, now()
      FROM json_populate_recordset(NULL::emails, ${JSON.stringify(rows)})
      ON CONFLICT (id) DO UPDATE SET unread = EXCLUDED.unread, category = EXCLUDED.category,
        classified_by = EXCLUDED.classified_by, user_email = EXCLUDED.user_email, updated_at = now()`;
  }

  const counts = await fetchEmailCountsByUser(userEmail);
  return {
    counts,
    emails: emails.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)),
    nextPageToken: list.nextPageToken ?? null,
  };
}

const cachedSyncEmails = unstable_cache(
  async (userEmail: string, rulesKey: string, pageKey: string, token: string, userRules: EmailRule[]) => {
    void rulesKey;
    return syncEmailsUncached(token, userEmail, userRules, pageKey || undefined);
  },
  ["gmail-sync"],
  { revalidate: 600, tags: ["emails"] },
);

// shortcut: 20 matching messages per page, with nextPageToken for loading older batches
export const syncEmails = cache(async (token: string, pageToken?: string) => {
  const [userEmail, userRules] = await Promise.all([
    getCurrentUserEmail().then((e) => e ?? ""),
    getEmailRules().catch(() => [] as EmailRule[]),
  ]);
  const rulesKey = JSON.stringify(userRules);
  const raw = await cachedSyncEmails(userEmail, rulesKey, pageToken ?? "", token, userRules);

  // Overlay latest unread/category state from Postgres (0 Gmail quota cost) so actions reflect immediately without busting the Gmail cache.
  const ids = raw.emails.map((e) => e.id);
  const dbRows = ids.length
    ? await neon(process.env.DATABASE_URL ?? "")`
        SELECT id, unread, category FROM emails
        WHERE id = ANY(${ids}) AND (user_email = ${userEmail} OR user_email = '')`
        .catch(() => [] as { id: string; unread: boolean; category: string }[])
    : [];
  const dbMap = new Map(dbRows.map((r) => [r.id as string, r]));

  return {
    counts: raw.counts,
    emails: raw.emails.map((e) => {
      const ov = dbMap.get(e.id);
      return {
        ...e,
        unread: ov ? Boolean(ov.unread) : e.unread,
        category: ov?.category ? String(ov.category) : e.category,
        receivedAt: new Date(e.receivedAt),
      };
    }),
    nextPageToken: raw.nextPageToken,
  };
});

async function fetchEmailCountsByUser(userEmail: string): Promise<Record<string, number>> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`
    SELECT category, COUNT(*)::int AS n FROM emails
    WHERE received_at > now() - interval '7 days' AND user_email = ${userEmail}
    GROUP BY category`;
  return Object.fromEntries(rows.map((c) => [c.category, c.n]));
}

// E-mails per category over the last 7 days, read from the database (no Gmail call).
export const emailCounts = cache(async (): Promise<Record<string, number>> => {
  const userEmail = (await getCurrentUserEmail()) ?? "";
  return fetchEmailCountsByUser(userEmail);
});

// Unread action e-mails from the database only (no Gmail call), cheap enough for the menu badge on every page.
export const unreadActionCount = cache(async (): Promise<number> => {
  const userEmail = (await getCurrentUserEmail()) ?? "";
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM emails
    WHERE unread AND category IN ('acao', 'seguranca')
      AND received_at > now() - interval '7 days'
      AND user_email = ${userEmail}`;
  return rows[0]?.n ?? 0;
});

const cachedAwaitingReply = unstable_cache(
  async (myEmail: string, minDays: number, dayKey: string, token: string) => {
    void dayKey;
    const list = await gget<{ threads?: { id: string }[] }>(
      `/threads?q=${encodeURIComponent("in:sent newer_than:14d")}&maxResults=10`,
      token,
    );
    const threads = await mapConcurrent(
      list.threads ?? [],
      2,
      (t) => gget<ThreadLike>(`/threads/${t.id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject`, token),
    );
    return pickAwaiting(threads, myEmail, new Date(), minDays);
  },
  ["gmail-awaiting-reply"],
  { revalidate: 900, tags: ["emails-awaiting"] },
);

// Conversations where my message is the last one and nobody answered yet (sent mail, last 14 days).
export const awaitingReply = cache(async (token: string, myEmail: string, minDays: number, now = new Date()): Promise<Awaiting[]> => {
  const dayKey = now.toISOString().slice(0, 10);
  return cachedAwaitingReply(myEmail, minDays, dayKey, token);
});

export async function archiveEmail(token: string, id: string): Promise<void> {
  await gpost(`/messages/${encodeURIComponent(id)}/modify`, token, { removeLabelIds: ["INBOX"] });
}

export async function unarchiveEmail(token: string, id: string): Promise<void> {
  await gpost(`/messages/${encodeURIComponent(id)}/modify`, token, { addLabelIds: ["INBOX"] });
}

export async function markEmailsRead(token: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await gpost("/messages/batchModify", token, { ids, removeLabelIds: ["UNREAD"] });
  const userEmail = (await getCurrentUserEmail()) ?? "";
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`UPDATE emails SET unread = false, updated_at = now() WHERE id = ANY(${ids}) AND (user_email = ${userEmail} OR user_email = '')`.catch((err) =>
    logWarn("gmail", "Falha ao atualizar unread=false no DB", err),
  );
}

export async function markEmailsUnread(token: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await gpost("/messages/batchModify", token, { ids, addLabelIds: ["UNREAD"] });
  const userEmail = (await getCurrentUserEmail()) ?? "";
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`UPDATE emails SET unread = true, updated_at = now() WHERE id = ANY(${ids}) AND (user_email = ${userEmail} OR user_email = '')`.catch((err) =>
    logWarn("gmail", "Falha ao atualizar unread=true no DB", err),
  );
}

export async function createFollowupDraft(
  token: string,
  input: { threadId: string; to: string; subject: string },
): Promise<{ id: string }> {
  const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
  const subject = /^re:/i.test(input.subject.trim()) ? clean(input.subject) : `Re: ${clean(input.subject)}`;
  const lines = [
    ...(input.to ? [`To: ${clean(input.to)}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    "Olá,",
    "",
    "Passando para retomar este assunto e saber se há alguma novidade.",
    "",
    "Obrigado!",
  ];
  const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { threadId: input.threadId, raw } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { id: string };
  return { id: j.id };
}

export async function deleteDraft(token: string, draftId: string): Promise<void> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function createReplyDraftWithAI(
  token: string,
  input: { threadId: string; to: string; subject: string; snippet: string; tone?: "direto" | "formal" | "followup" },
): Promise<{ id: string; text: string }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada");

  const toneHint =
    input.tone === "formal"
      ? "tom formal, educado e corporativo"
      : input.tone === "followup"
        ? "tom de cobrança leve e cordial para retomar o assunto"
        : "tom direto, claro e cordial";

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Escreva apenas o corpo de uma resposta curta em português (${toneHint}), sem linha de assunto nem explicações extras.\nRemetente original: ${input.to}\nAssunto: ${input.subject}\nTrecho: ${input.snippet.slice(0, 300)}`,
        },
      ],
    }),
    cache: "no-store",
  });
  if (!aiRes.ok) throw new Error(`Anthropic ${aiRes.status}`);
  const aiJson = (await aiRes.json()) as { content?: { type: string; text?: string }[] };
  const text = aiJson.content?.find((b) => b.type === "text")?.text?.trim();
  if (!text) throw new Error("A IA não retornou um rascunho.");

  const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
  const subject = /^re:/i.test(input.subject.trim()) ? clean(input.subject) : `Re: ${clean(input.subject)}`;
  const lines = [
    ...(input.to ? [`To: ${clean(input.to)}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    ...text.split(/\r?\n/),
  ];
  const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { threadId: input.threadId, raw } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { id: string };
  return { id: j.id, text };
}

export async function createTemplateDraft(
  token: string,
  input: { threadId: string; to: string; subject: string; body: string },
): Promise<{ id: string }> {
  const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
  const subject = /^re:/i.test(input.subject.trim()) ? clean(input.subject) : `Re: ${clean(input.subject)}`;
  const lines = [
    ...(input.to ? [`To: ${clean(input.to)}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    ...input.body.split(/\r?\n/),
  ];
  const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { threadId: input.threadId, raw } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { id: string };
  return { id: j.id };
}

export async function generateDailyBriefingWithAI(input: {
  events: { time: string; title: string }[];
  tasks: { bucket: string; title: string }[];
  emails: { sender: string; subject: string }[];
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada");

  const evTxt = input.events.slice(0, 8).map((e) => `- ${e.time}: ${e.title}`).join("\n") || "Nenhum evento.";
  const tkTxt = input.tasks.slice(0, 10).map((t) => `- [${t.bucket}] ${t.title}`).join("\n") || "Nenhuma tarefa urgente.";
  const emTxt = input.emails.slice(0, 8).map((m) => `- ${m.sender}: ${m.subject}`).join("\n") || "Nenhum e-mail de ação.";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1400,
      messages: [
        {
          role: "user",
          content: `Faça um briefing executivo do dia em português em exatamente 3 tópicos curtos e completos (começando com "• "), indicando por onde começar, o maior risco/prioridade e o próximo passo prático. Não corte frases.\n\nAgenda:\n${evTxt}\n\nTarefas:\n${tkTxt}\n\nE-mails de ação:\n${emTxt}`,
        },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = j.content?.find((b) => b.type === "text")?.text?.trim();
  if (!text) throw new Error("A IA não retornou um briefing.");
  return text;
}

export async function summarizeInformativosWithAI(
  items: { sender: string; subject: string; snippet: string }[],
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada");
  if (items.length === 0) return "Nenhum informativo para resumir.";

  const list = items
    .slice(0, 30)
    .map((m, idx) => `${idx + 1}. ${m.sender} — ${m.subject}${m.snippet ? ` (${m.snippet.slice(0, 120)})` : ""}`)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Resuma estes ${Math.min(items.length, 30)} e-mails informativos em português, de forma bem direta, em até 5 tópicos curtos (uma linha por tópico, começando com "• "). Agrupe assuntos parecidos.\n\n${list}`,
        },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = j.content?.find((b) => b.type === "text")?.text?.trim();
  if (!text) throw new Error("A IA não retornou um resumo.");
  return text;
}

export async function updateEmailCategory(id: string, category: string, by = "rule:user"): Promise<void> {
  const userEmail = (await getCurrentUserEmail()) ?? "";
  const sql = neon(process.env.DATABASE_URL ?? "");
  await sql`UPDATE emails SET category = ${category}, classified_by = ${by}, updated_at = now() WHERE id = ${id} AND (user_email = ${userEmail} OR user_email = '')`.catch((err) =>
    logWarn("gmail", "Falha ao atualizar categoria no DB", err, { id }),
  );
}

export async function muteSenderFilter(token: string, senderEmail: string, archiveIds: string[] = []): Promise<{ id: string }> {
  const res = await gmailFetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/filters", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      criteria: { from: senderEmail },
      action: { removeLabelIds: ["INBOX"] },
    }),
  });
  const j = (await res.json()) as { id: string };
  if (archiveIds.length > 0) {
    await gpost("/messages/batchModify", token, { ids: archiveIds, removeLabelIds: ["INBOX"] }).catch((err) =>
      logWarn("gmail", "Falha ao arquivar após criar filtro", err),
    );
  }
  return { id: j.id };
}

export async function deleteSenderFilter(token: string, filterId: string, restoreIds: string[] = []): Promise<void> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/settings/filters/${encodeURIComponent(filterId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (restoreIds.length > 0) {
    await gpost("/messages/batchModify", token, { ids: restoreIds, addLabelIds: ["INBOX"] }).catch((err) =>
      logWarn("gmail", "Falha ao restaurar após remover filtro", err),
    );
  }
}
