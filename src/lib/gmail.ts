// Read-only Gmail metadata (sender, subject, date, unread) classified into categories.
// Bodies are never fetched or stored.
import { neon } from "@neondatabase/serverless";

export const CATEGORIES = ["acao", "financeiro", "agendamento", "trabalho", "pessoal", "aguardando", "informativo"] as const;
export type Category = (typeof CATEGORIES)[number];

const RULES: [Category, RegExp][] = [
  ["financeiro", /fatura|boleto|pagamento|nota fiscal|invoice|recibo|receipt|\bpix\b|extrato/i],
  ["agendamento", /convite|invitation|reuni[aã]o|meeting|agendad|reserva|booking/i],
  ["acao", /urgente|a[cç][aã]o necess[aá]ria|action required|aprovar|pendente|vence hoje/i],
];

// Returns a category when a rule matches, otherwise null (the AI decides).
export function ruleCategory(sender: string, subject: string): Category | null {
  const text = `${sender} ${subject}`;
  return RULES.find(([, re]) => re.test(text))?.[0] ?? null;
}

// Accepts only a known category word from the model's reply.
export function parseCategory(text: string): Category | null {
  const word = text.trim().toLowerCase().replace(/[^a-z]/g, "");
  return (CATEGORIES as readonly string[]).includes(word) ? (word as Category) : null;
}

async function classifyWithAI(sender: string, subject: string): Promise<Category | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: `Classifique este e-mail em UMA palavra: ${CATEGORIES.join(", ")}.\nacao = precisa de ação do destinatário; aguardando = espera resposta; trabalho = relacionado a trabalho; pessoal = relacionamentos e vida pessoal; informativo = só para saber.\nRemetente: ${sender}\nAssunto: ${subject}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { content?: { text?: string }[] };
    return parseCategory(j.content?.[0]?.text ?? "");
  } catch {
    // shortcut: any AI failure falls back to "informativo" so one bad key never blocks the inbox, upgrade to a retry queue when it matters
    return null;
  }
}

type GMsg = {
  id: string;
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
  const list = await gget<{ messages?: { id: string }[] }>(
    `/messages?q=${encodeURIComponent("is:unread OR newer_than:7d")}&maxResults=50`,
    token,
  );
  const msgs = await Promise.all(
    (list.messages ?? []).map((m) =>
      gget<GMsg>(`/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, token),
    ),
  );

  const sql = neon(process.env.DATABASE_URL ?? "");
  const ids = msgs.map((m) => m.id);
  const known = ids.length
    ? await sql`SELECT id, category, classified_by FROM emails WHERE id = ANY(${ids})`
    : [];
  const knownMap = new Map(known.map((r) => [r.id as string, r]));

  // Each message is classified once; later loads only refresh the unread flag.
  const rows = await Promise.all(
    msgs.map(async (m) => {
      const h = (n: string) => m.payload.headers.find((x) => x.name === n)?.value ?? "";
      const sender = h("From");
      const subject = h("Subject") || "(sem assunto)";
      const old = knownMap.get(m.id);
      let category = old?.category as Category | undefined;
      let by = old?.classified_by as string | undefined;
      if (!category) {
        const rule = ruleCategory(sender, subject);
        const ai = rule ? null : await classifyWithAI(sender, subject);
        category = rule ?? ai ?? "informativo";
        by = rule ? "rule" : ai ? "ai" : "fallback"; // fallback: no key or model error
      }
      return {
        id: m.id,
        sender,
        subject,
        received_at: new Date(Number(m.internalDate)).toISOString(),
        unread: m.labelIds?.includes("UNREAD") ?? false,
        category,
        classified_by: by,
      };
    }),
  );

  if (rows.length) {
    await sql`
      INSERT INTO emails (id, sender, subject, received_at, unread, category, classified_by, updated_at)
      SELECT id, sender, subject, received_at, unread, category, classified_by, now()
      FROM json_populate_recordset(NULL::emails, ${JSON.stringify(rows)})
      ON CONFLICT (id) DO UPDATE SET unread = EXCLUDED.unread, updated_at = now()`;
  }

  const actions = await sql`
    SELECT sender, subject, received_at FROM emails
    WHERE category = 'acao' AND unread ORDER BY received_at DESC LIMIT 10`;
  const counts = await sql`
    SELECT category, COUNT(*)::int AS n FROM emails
    WHERE received_at > now() - interval '7 days' GROUP BY category`;
  return { actions, counts: Object.fromEntries(counts.map((c) => [c.category, c.n])) as Record<string, number> };
}
