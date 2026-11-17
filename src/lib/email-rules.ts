// Pure e-mail classification rules (no Gmail, no database, no relative imports), testable in plain Node.

// Categories the classifier can assign. "Aguardando resposta" is not one of them: it is computed from sent mail.
export const CATEGORIES = ["acao", "financeiro", "agendamento", "trabalho", "pessoal", "informativo"] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(x: unknown): x is Category {
  return typeof x === "string" && (CATEGORIES as readonly string[]).includes(x);
}

const KEYWORD_RULES: [Category, RegExp][] = [
  ["financeiro", /fatura|boleto|pagamento|nota fiscal|invoice|recibo|receipt|\bpix\b|extrato/i],
  ["agendamento", /convite|invitation|reuni[aã]o|meeting|agendad|reserva|booking/i],
  ["acao", /urgente|a[cç][aã]o necess[aá]ria|action required|aprovar|pendente|vence hoje/i],
];

// Returns a category when a keyword rule matches, otherwise null.
export function ruleCategory(sender: string, subject: string): Category | null {
  const text = `${sender} ${subject}`;
  return KEYWORD_RULES.find(([, re]) => re.test(text))?.[0] ?? null;
}

// Finds a known category in the model's reply, ignoring accents and case ("Ação." -> acao).
export function parseCategory(text: string): Category | null {
  const norm = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return CATEGORIES.find((c) => norm.includes(c)) ?? null;
}

export type EmailRule = { match: string; category: Category };

export const MAX_RULES = 50;
const DOMAIN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/;
const ADDRESS = /^[^\s@<>]+@[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/;

// Validates user input at the boundary: a domain or an address, plus a known category.
export function normalizeRule(input: { match: string; category: string }): EmailRule | null {
  const match = input.match.trim().toLowerCase();
  if (!match || match.length > 100 || !isCategory(input.category)) return null;
  return ADDRESS.test(match) || DOMAIN.test(match) ? { match, category: input.category } : null;
}

const addressOf = (sender: string) => (sender.match(/<([^>]+)>/)?.[1] ?? sender).trim().toLowerCase();

// First rule that matches wins. A domain rule also covers subdomains ("google.com" matches "mail.google.com").
export function matchUserRule(sender: string, rules: EmailRule[]): Category | null {
  const addr = addressOf(sender);
  const domain = addr.split("@")[1] ?? "";
  const hit = rules.find((r) =>
    r.match.includes("@") ? r.match === addr : domain === r.match || domain.endsWith(`.${r.match}`),
  );
  return hit?.category ?? null;
}

// Decision made without the AI: the user's rules first, then keywords, then bulk mail (List-Unsubscribe).
export function categorize(
  sender: string,
  subject: string,
  hasListUnsubscribe: boolean,
  userRules: EmailRule[],
): { category: Category; by: string } | null {
  const user = matchUserRule(sender, userRules);
  if (user) return { category: user, by: "rule:user" };
  const keyword = ruleCategory(sender, subject);
  if (keyword) return { category: keyword, by: "rule" };
  if (hasListUnsubscribe) return { category: "informativo", by: "rule:bulk" };
  return null;
}
