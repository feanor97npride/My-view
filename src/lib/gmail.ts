// Read-only Gmail metadata (sender, subject, date, unread) classified into categories.
// Bodies are never fetched or stored. The short Gmail snippet is shown in the list but kept in memory only.
import { neon } from "@neondatabase/serverless";
import { CATEGORIES, categorize, isCategory, parseCategory, type Category } from "./email-rules";
import { pickAwaiting, type Awaiting, type EmailItem, type ThreadLike } from "./email-view";
import { getEmailRules } from "./prefs";

// Returns a category, or a short error code (stored in classified_by so failures are visible in the database).
async function classifyWithAI(sender: string, subject: string): Promise<Category | string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return "nokey";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 1024, // the model may emit a thinking block first; 200 was not always enough for the answer to follow
        messages: [
          {
            role: "user",
            content: `Classifique este e-mail em UMA palavra: ${CATEGORIES.join(", ")}.\nacao = precisa de ação do destinatário; financeiro = cobranças, pagamentos, bancos; agendamento = reuniões, convites, reservas; trabalho = relacionado a trabalho; pessoal = relacionamentos e vida pessoal; informativo = só para saber.\nRemetente: ${sender}\nAssunto: ${subject}`,
          },
        ],
      }),
    });
    if (!res.ok) return `http${res.status}`;
    // Reads the text block wherever it is; records block types when no category is found, to diagnose the reply shape.
    const j = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = j.content?.find((b) => b.type === "text")?.text ?? "";
    return parseCategory(text) ?? `badreply:${(j.content ?? []).map((b) => b.type).join("+") || "empty"}`;
  } catch {
    // shortcut: any AI failure falls back to "informativo" so one bad key never blocks the inbox, upgrade to a retry queue when it matters
    return "network";
  }
}

type GMsg = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate: string;
  labelIds?: string[];
  payload: { headers: { name: string; value: string }[] };
};

async function gget<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// shortcut: only the 50 most recent matching messages per load, upgrade with pagination when the inbox grows
export async function syncEmails(token: string) {
  const [list, userRules] = await Promise.all([
    gget<{ messages?: { id: string }[] }>(`/messages?q=${encodeURIComponent("is:unread OR newer_than:7d")}&maxResults=50`, token),
    getEmailRules().catch(() => []), // rules are optional: without them only keywords, bulk mail and the AI apply
  ]);
  const msgs = await Promise.all(
    (list.messages ?? []).map((m) =>
      gget<GMsg>(`/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`, token),
    ),
  );

  const sql = neon(process.env.DATABASE_URL ?? "");
  const ids = msgs.map((m) => m.id);
  const known = ids.length
    ? await sql`SELECT id, category, classified_by FROM emails WHERE id = ANY(${ids})`
    : [];
  const knownMap = new Map(known.map((r) => [r.id as string, r]));

  // Rules are re-checked on every load and always win, even over an older AI answer.
  // The AI only runs for new e-mails, earlier failures, or e-mails whose rule no longer matches.
  // Sequential on purpose: parallel bursts hit the API rate limit and fall back to "informativo".
  const rows: Record<string, unknown>[] = [];
  const emails: EmailItem[] = [];
  for (const m of msgs) {
    const h = (n: string) => m.payload.headers.find((x) => x.name === n)?.value ?? "";
    const sender = h("From");
    const subject = h("Subject") || "(sem assunto)";
    const hasUnsub = m.payload.headers.some((x) => x.name.toLowerCase() === "list-unsubscribe");
    const old = knownMap.get(m.id);
    let category = old?.category as Category | undefined;
    let by = old?.classified_by as string | undefined;
    const decided = categorize(sender, subject, hasUnsub, userRules);
    if (decided) {
      category = decided.category;
      by = decided.by;
    } else if (!category || by?.startsWith("fallback") || by?.startsWith("rule")) {
      const ai = await classifyWithAI(sender, subject);
      if (isCategory(ai)) {
        category = ai;
        by = "ai";
      } else {
        category = "informativo";
        by = `fallback:${ai}`;
      }
    }
    const receivedAt = new Date(Number(m.internalDate));
    const unread = m.labelIds?.includes("UNREAD") ?? false;
    rows.push({ id: m.id, sender, subject, received_at: receivedAt.toISOString(), unread, category, classified_by: by });
    emails.push({
      id: m.id,
      threadId: m.threadId,
      sender,
      subject,
      receivedAt,
      unread,
      category: category as string,
      snippet: m.snippet ?? "", // raw: still HTML-encoded, decoded where it is displayed
    });
  }

  if (rows.length) {
    await sql`
      INSERT INTO emails (id, sender, subject, received_at, unread, category, classified_by, updated_at)
      SELECT id, sender, subject, received_at, unread, category, classified_by, now()
      FROM json_populate_recordset(NULL::emails, ${JSON.stringify(rows)})
      ON CONFLICT (id) DO UPDATE SET unread = EXCLUDED.unread, category = EXCLUDED.category,
        classified_by = EXCLUDED.classified_by, updated_at = now()`;
  }

  const actions = await sql`
    SELECT sender, subject, received_at FROM emails
    WHERE category = 'acao' AND unread ORDER BY received_at DESC LIMIT 10`;
  return { actions, counts: await emailCounts(), emails: emails.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()) };
}

// E-mails per category over the last 7 days, read from the database (no Gmail call).
export async function emailCounts(): Promise<Record<string, number>> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const rows = await sql`
    SELECT category, COUNT(*)::int AS n FROM emails
    WHERE received_at > now() - interval '7 days' GROUP BY category`;
  return Object.fromEntries(rows.map((c) => [c.category, c.n]));
}

// Conversations where my message is the last one and nobody answered yet (sent mail, last 14 days).
// shortcut: at most 30 conversations, upgrade with pagination if you send more than that in two weeks
export async function awaitingReply(token: string, myEmail: string, now = new Date()): Promise<Awaiting[]> {
  const list = await gget<{ threads?: { id: string }[] }>(
    `/threads?q=${encodeURIComponent("in:sent newer_than:14d")}&maxResults=30`,
    token,
  );
  const threads = await Promise.all(
    (list.threads ?? []).map((t) =>
      gget<ThreadLike>(`/threads/${t.id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject`, token),
    ),
  );
  return pickAwaiting(threads, myEmail, now);
}
