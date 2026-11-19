// Pure logic for the e-mail triage screen (no imports, testable in plain Node).
// Phase 1 is read-only: an e-mail counts as "triado" once it has been read, because nothing can be archived from here yet.

export const FILAS = ["acao", "financeiro", "agendamento", "trabalho", "aguardando", "pessoal", "informativo"] as const;
export type Fila = (typeof FILAS)[number];

// Finer categories (picked by the AI) and the queue each one belongs to. Everything else is its own queue.
const PARENT: Record<string, string> = {
  compras: "informativo",
  promocao: "informativo",
  social: "informativo",
  seguranca: "acao",
  viagens: "agendamento",
  saude: "pessoal",
  educacao: "pessoal",
};
export const filaOf = (category: string): string => PARENT[category] ?? category;

export const IMPORTANTES = ["acao", "financeiro", "agendamento"];
export const MIN_BARULHENTO = 3;

export type EmailAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type TriItem = {
  id: string;
  threadId: string;
  sender: string; // raw From header
  subject: string;
  snippet: string;
  receivedAt: string; // ISO
  unread: boolean;
  inInbox?: boolean; // false after archiving; omitted/true means still in inbox
  triado?: boolean;
  clickupTaskId?: string;
  calendarEventId?: string;
  category: string;
  when: string; // already formatted ("14:05", "14 nov"), computed on the server so the time zone matches
  url: string; // opens the conversation in Gmail
  attachments?: EmailAttachment[];
};

// "Nome <a@b.com>" -> name, address and domain.
export function senderInfo(raw: string): { nome: string; email: string; dominio: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : raw.includes("@") ? raw : "").trim().toLowerCase();
  const nome = (m ? m[1].trim() : raw.trim()) || email || "(sem remetente)";
  return { nome, email, dominio: email.split("@")[1] ?? "" };
}

// "R$ 1.482,90" and "vence 25/11" extracted from subject/snippet without extra API calls.
export function extractFinance(text: string): { valor?: string; vencimento?: string } {
  const val = text.match(/R\$\s*([\d.]+,\d{2})/i);
  const dueDate = text.match(/venc(?:e|imento)?(?:\s+em|\s*[:\-])?\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  const dueWord = text.match(/vence\s+(hoje|amanh[aã])/i);
  return {
    valor: val ? `R$ ${val[1]}` : undefined,
    vencimento: dueDate ? dueDate[1] : dueWord ? dueWord[1].toLowerCase() : undefined,
  };
}

export function financeDueDays(vencimento: string | undefined, now: Date): number | null {
  if (!vencimento) return null;
  if (vencimento === "hoje") return 0;
  if (vencimento.startsWith("amanh")) return 1;
  const m = vencimento.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : now.getFullYear();
  const target = Date.UTC(year, month, day);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

// Lower comes first: urgent Financeiro (<= 3 days) -> Ação -> Financeiro -> Agendamento -> Trabalho -> Pessoal.
const RANK: Record<string, number> = { acao: 0, financeiro: 1, agendamento: 2, trabalho: 3, pessoal: 4 };

const rankOf = (i: TriItem, now: Date) => {
  if (filaOf(i.category) === "financeiro") {
    const d = financeDueDays(extractFinance(`${i.subject} ${i.snippet}`).vencimento, now);
    if (d !== null && d <= 3 && d >= -7) return -1;
  }
  return RANK[filaOf(i.category)] ?? 9;
};

const byAge = (a: TriItem, b: TriItem) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt); // oldest waits longest
const isPending = (i: TriItem) => i.unread && i.inInbox !== false && !i.triado;

// Order of the card in focus. With a queue filter: that category still in inbox, unread first. Without: unread in inbox only,
// urgent financeiro & important categories first, then Trabalho and Pessoal. Informativo never enters the default queue.
export function buildQueue(items: TriItem[], filtro: Fila | null, now = new Date()): TriItem[] {
  if (filtro && filtro !== "aguardando") {
    return items
      .filter((i) => filaOf(i.category) === filtro && i.inInbox !== false && !i.triado)
      .sort((a, b) => Number(b.unread) - Number(a.unread) || rankOf(a, now) - rankOf(b, now) || byAge(a, b));
  }
  if (filtro === "aguardando") return [];
  return items
    .filter((i) => isPending(i) && filaOf(i.category) in RANK)
    .sort((a, b) => rankOf(a, now) - rankOf(b, now) || byAge(a, b));
}

export type Resumo = {
  total: number;
  porCategoria: Record<string, number>;
  importantes: number; // unread & inInbox in Ação + Financeiro + Agendamento
  importantesTotal: number;
  importantesTriados: number;
};

export function resumir(items: TriItem[]): Resumo {
  const porCategoria: Record<string, number> = {};
  for (const i of items) porCategoria[filaOf(i.category)] = (porCategoria[filaOf(i.category)] ?? 0) + 1; // counted by queue
  const imp = items.filter((i) => IMPORTANTES.includes(filaOf(i.category)));
  const pendentes = imp.filter(isPending).length;
  return { total: items.length, porCategoria, importantes: pendentes, importantesTotal: imp.length, importantesTriados: imp.length - pendentes };
}

export type GrupoInformativo = { email: string; nome: string; qtd: number; ultimo: string; linha: string; assuntos: string[]; url: string };

// Informativos grouped by sender address, noisiest first.
export function agruparInformativos(items: TriItem[]): GrupoInformativo[] {
  const map = new Map<string, TriItem[]>();
  for (const i of items) {
    if (filaOf(i.category) !== "informativo" || i.inInbox === false) continue;
    const key = senderInfo(i.sender).email || i.sender;
    map.set(key, [...(map.get(key) ?? []), i]);
  }
  return [...map.entries()]
    .map(([email, list]) => {
      const sorted = [...list].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
      return {
        email,
        nome: senderInfo(sorted[0].sender).nome,
        qtd: sorted.length,
        ultimo: sorted[0].when,
        linha: sorted[0].subject,
        assuntos: sorted.slice(0, 3).map((x) => x.subject),
        url: sorted[0].url,
      };
    })
    .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome));
}

// The noisiest sender only counts from MIN_BARULHENTO e-mails on.
export function maisBarulhento(grupos: GrupoInformativo[]): GrupoInformativo | null {
  return grupos[0] && grupos[0].qtd >= MIN_BARULHENTO ? grupos[0] : null;
}

export function tituloResumo(r: Resumo): { total: string; destaque: string } {
  const n = (x: number, um: string, varios: string) => `${x} ${x === 1 ? um : varios}`;
  return {
    total: `${n(r.total, "e-mail", "e-mails")}.`,
    destaque: r.importantes === 0 ? "Tudo em dia." : `Só ${r.importantes} ${r.importantes === 1 ? "precisa" : "precisam"} de você.`,
  };
}
