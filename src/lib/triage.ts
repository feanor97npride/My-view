// Pure logic for the e-mail triage screen (no imports, testable in plain Node).
// Phase 1 is read-only: an e-mail counts as "triado" once it has been read, because nothing can be archived from here yet.

export const FILAS = ["acao", "financeiro", "agendamento", "trabalho", "aguardando", "pessoal", "informativo"] as const;
export type Fila = (typeof FILAS)[number];

export const IMPORTANTES = ["acao", "financeiro", "agendamento"];
export const MIN_BARULHENTO = 3;

export type TriItem = {
  id: string;
  threadId: string;
  sender: string; // raw From header
  subject: string;
  snippet: string;
  receivedAt: string; // ISO
  unread: boolean;
  category: string;
  when: string; // already formatted ("14:05", "14 nov"), computed on the server so the time zone matches
  url: string; // opens the conversation in Gmail
};

// "Nome <a@b.com>" -> name, address and domain.
export function senderInfo(raw: string): { nome: string; email: string; dominio: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : raw.includes("@") ? raw : "").trim().toLowerCase();
  const nome = (m ? m[1].trim() : raw.trim()) || email || "(sem remetente)";
  return { nome, email, dominio: email.split("@")[1] ?? "" };
}

// Lower comes first. Phase 1 has no due dates yet, so the order is Ação, Financeiro, Agendamento, then Trabalho, Pessoal.
const RANK: Record<string, number> = { acao: 0, financeiro: 1, agendamento: 2, trabalho: 3, pessoal: 4 };

const byAge = (a: TriItem, b: TriItem) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt); // oldest waits longest

// Order of the card in focus. With a queue filter: that category, unread first. Without: unread only,
// important categories first, then Trabalho and Pessoal. Informativo never enters the default queue.
export function buildQueue(items: TriItem[], filtro: Fila | null): TriItem[] {
  if (filtro && filtro !== "aguardando") {
    return items
      .filter((i) => i.category === filtro)
      .sort((a, b) => Number(b.unread) - Number(a.unread) || (RANK[a.category] ?? 9) - (RANK[b.category] ?? 9) || byAge(a, b));
  }
  if (filtro === "aguardando") return [];
  return items
    .filter((i) => i.unread && i.category in RANK)
    .sort((a, b) => RANK[a.category] - RANK[b.category] || byAge(a, b));
}

export type Resumo = {
  total: number;
  porCategoria: Record<string, number>;
  importantes: number; // unread in Ação + Financeiro + Agendamento
  importantesTotal: number;
  importantesTriados: number;
};

export function resumir(items: TriItem[]): Resumo {
  const porCategoria: Record<string, number> = {};
  for (const i of items) porCategoria[i.category] = (porCategoria[i.category] ?? 0) + 1;
  const imp = items.filter((i) => IMPORTANTES.includes(i.category));
  const pendentes = imp.filter((i) => i.unread).length;
  return { total: items.length, porCategoria, importantes: pendentes, importantesTotal: imp.length, importantesTriados: imp.length - pendentes };
}

export type GrupoInformativo = { email: string; nome: string; qtd: number; ultimo: string; linha: string; assuntos: string[]; url: string };

// Informativos grouped by sender address, noisiest first.
export function agruparInformativos(items: TriItem[]): GrupoInformativo[] {
  const map = new Map<string, TriItem[]>();
  for (const i of items) {
    if (i.category !== "informativo") continue;
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
