export const DEFAULT_NEWSLETTER_RULES: string[] = [
  "resumo diario de noticias de ia",
  "resumo geopolitico",
  "resumo geo politico",
];

export function normalizeNewsletterText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesNewsletter(
  item: { sender: string; subject: string },
  rules: readonly string[],
): boolean {
  if (rules.length === 0) return false;
  const hay = normalizeNewsletterText(`${item.sender} ${item.subject}`);
  return rules.some((r) => {
    const clean = normalizeNewsletterText(r);
    return clean.length > 0 && hay.includes(clean);
  });
}

export type NewsletterItem = {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  when: string;
  unread: boolean;
  url: string;
};
