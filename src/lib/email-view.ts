// Pure helpers for the e-mail list (no Gmail, no database), so they can be tested in plain Node.

export type EmailItem = {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  receivedAt: Date;
  unread: boolean;
  category: string;
  snippet: string; // short preview from Gmail, kept in memory only, never stored
};

export const CATEGORY_LABEL: Record<string, string> = {
  acao: "Ação",
  financeiro: "Financeiro",
  agendamento: "Agendamento",
  trabalho: "Trabalho",
  pessoal: "Pessoal",
  aguardando: "Aguardando",
  informativo: "Informativo",
};

export const CATEGORY_CHIP: Record<string, string> = {
  acao: "chip-violet",
  financeiro: "chip-green",
  agendamento: "chip-blue",
  trabalho: "chip-amber",
  pessoal: "chip-pink",
  aguardando: "chip-teal",
  informativo: "chip-slate",
};

// "Nome <a@b.com>", '"Nome" <a@b.com>', "<a@b.com>" or "a@b.com" -> display name and address.
export function parseSender(raw: string): { name: string; address: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const address = m[2].trim();
    return { name: m[1].trim() || address, address };
  }
  const t = raw.trim();
  return { name: t, address: t.includes("@") ? t : "" };
}

// Gmail snippets arrive HTML-encoded (&#39; &amp; ...). One pass, so "&amp;lt;" stays "&lt;".
export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return named[e.toLowerCase()] ?? match;
  });
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterEmails<T extends { category: string; unread: boolean; sender: string; subject: string }>(
  emails: T[],
  f: { categoria?: string; naolidos?: boolean; q?: string },
): T[] {
  const q = f.q ? norm(f.q.trim()) : "";
  return emails.filter(
    (e) =>
      (!f.categoria || e.category === f.categoria) &&
      (!f.naolidos || e.unread) &&
      (!q || norm(`${e.sender} ${e.subject}`).includes(q)),
  );
}

// Today -> "14:05"; any other day -> "14 nov".
export function shortDate(d: Date, now: Date, tz: string): string {
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  if (day(d) === day(now)) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: tz }).replace(" de ", " ").replace(".", "");
}
