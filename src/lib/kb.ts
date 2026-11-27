import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  IMPACTOS,
  TIPOS,
  type BaseConhecimento,
  type Entrada,
  type Impacto,
  type Licao,
  type Projeto,
  type Semana,
  type Tipo,
} from "./kb-model";

export * from "./kb-model";

export type Envelope = {
  v: 1;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
  sha: string;
};

export type EntradaInput = Omit<Entrada, "projeto" | "semana" | "registradoEm"> & {
  projeto?: string;
  semana?: string;
  registradoEm?: string;
};

export type Lote = {
  projeto?: Projeto;
  semana: {
    projeto: string;
    semana: string;
    status?: "publicado" | "sem-eventos";
    resumo?: string;
    janela?: { de: string; ate: string };
  };
  entradas: EntradaInput[];
  top3?: Licao[];
};

const ID_RE = /^[a-z0-9][a-z0-9-]{2,120}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function vazia(): BaseConhecimento {
  return {
    versao: 1,
    atualizadoEm: new Date(0).toISOString(),
    projetos: [],
    entradas: [],
    semanas: [],
    top3: {},
  };
}

function parseKey(rawKey: string): Buffer {
  const trimmed = (rawKey ?? "").trim();
  if (!trimmed) {
    throw new Error("KB_KEY inválida: chave vazia.");
  }
  const buf = Buffer.from(trimmed, "base64");
  if (buf.length !== 32) {
    throw new Error("KB_KEY inválida: esperado base64 de 32 bytes (gere com openssl rand -base64 32).");
  }
  return buf;
}

export function cifrar(base: BaseConhecimento, rawKey: string): Envelope {
  const key = parseKey(rawKey);
  const plain = JSON.stringify(base);
  const sha = createHash("sha256").update(plain, "utf8").digest("hex").slice(0, 16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
    sha,
  };
}

export function decifrar(envelope: Partial<Envelope> | Record<string, unknown> | null | undefined, rawKey: string): BaseConhecimento {
  const key = parseKey(rawKey);
  if (!envelope || typeof envelope !== "object" || Object.keys(envelope).length === 0) {
    return vazia();
  }
  const env = envelope as Partial<Envelope>;
  if (env.v !== 1 || env.alg !== "aes-256-gcm" || !env.iv || !env.tag || !env.data) {
    throw new Error("Envelope cifrado inválido.");
  }
  const iv = Buffer.from(env.iv, "base64");
  const tag = Buffer.from(env.tag, "base64");
  const data = Buffer.from(env.data, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(plain) as BaseConhecimento;
  if (!parsed || parsed.versao !== 1 || !Array.isArray(parsed.entradas)) {
    throw new Error("Conteúdo decifrado inválido.");
  }
  return parsed;
}

export function validarEntrada(e: Partial<Entrada>): string[] {
  const erros: string[] = [];
  if (typeof e.id !== "string" || !ID_RE.test(e.id)) {
    erros.push(`id inválido (${String(e.id ?? "")}): use apenas letras minúsculas, números e hífens (3-121 chars).`);
  }
  if (typeof e.projeto !== "string" || !ID_RE.test(e.projeto)) {
    erros.push(`projeto inválido (${String(e.projeto ?? "")}).`);
  }
  if (typeof e.semana !== "string" || !DATE_RE.test(e.semana)) {
    erros.push(`semana inválida (${String(e.semana ?? "")}): esperado AAAA-MM-DD.`);
  }
  if (typeof e.data !== "string" || !DATE_RE.test(e.data)) {
    erros.push(`data inválida (${String(e.data ?? "")}): esperado AAAA-MM-DD.`);
  }
  if (typeof e.tipo !== "string" || !(e.tipo in TIPOS)) {
    erros.push(`tipo inválido (${String(e.tipo ?? "")}).`);
  }
  if (typeof e.impacto !== "string" || !(e.impacto in IMPACTOS)) {
    erros.push(`impacto inválido (${String(e.impacto ?? "")}).`);
  }
  const requiredText: (keyof Entrada)[] = [
    "titulo",
    "acontecimento",
    "contexto",
    "acao",
    "antecipacao",
    "aprendizado",
    "contorno",
    "tema",
    "fase",
  ];
  for (const field of requiredText) {
    const val = e[field];
    if (typeof val !== "string" || val.trim().length === 0) {
      erros.push(`campo obrigatório vazio: ${field}.`);
    }
  }
  return erros;
}

export function chaveDuplicidade(e: { projeto: string; titulo: string }): string {
  const norm = e.titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${e.projeto.trim().toLowerCase()}:${norm}`;
}

function cleanProjeto(p: Projeto): Projeto {
  const out: Projeto = { id: p.id.trim(), nome: p.nome.trim() };
  if (p.cliente?.trim()) out.cliente = p.cliente.trim();
  if (p.descricao?.trim()) out.descricao = p.descricao.trim();
  if (p.inicio?.trim()) out.inicio = p.inicio.trim();
  return out;
}

export function acrescentar(
  base: BaseConhecimento,
  lote: Lote,
  agora = new Date().toISOString(),
): {
  base: BaseConhecimento;
  adicionadas: string[];
  ignoradas: string[];
  erros: string[];
} {
  const erros: string[] = [];
  if (!lote || typeof lote !== "object" || !lote.semana) {
    return { base, adicionadas: [], ignoradas: [], erros: ["Lote inválido: bloco semana ausente."] };
  }
  const projetoId = lote.semana.projeto?.trim() ?? "";
  const semanaData = lote.semana.semana?.trim() ?? "";
  if (!ID_RE.test(projetoId)) erros.push(`semana.projeto inválido (${projetoId}).`);
  if (!DATE_RE.test(semanaData)) erros.push(`semana.semana inválida (${semanaData}): esperado AAAA-MM-DD.`);
  if (!Array.isArray(lote.entradas)) erros.push("lote.entradas deve ser um array.");

  if (erros.length > 0) {
    return { base, adicionadas: [], ignoradas: [], erros };
  }

  const normalizadas: Entrada[] = [];
  for (let i = 0; i < lote.entradas.length; i++) {
    const raw = lote.entradas[i];
    const candidato: Entrada = {
      id: typeof raw.id === "string" ? raw.id.trim() : "",
      projeto: typeof raw.projeto === "string" && raw.projeto.trim() ? raw.projeto.trim() : projetoId,
      semana: typeof raw.semana === "string" && raw.semana.trim() ? raw.semana.trim() : semanaData,
      data: typeof raw.data === "string" ? raw.data.trim() : "",
      tipo: raw.tipo as Tipo,
      titulo: typeof raw.titulo === "string" ? raw.titulo.trim() : "",
      acontecimento: typeof raw.acontecimento === "string" ? raw.acontecimento.trim() : "",
      contexto: typeof raw.contexto === "string" ? raw.contexto.trim() : "",
      acao: typeof raw.acao === "string" ? raw.acao.trim() : "",
      antecipacao: typeof raw.antecipacao === "string" ? raw.antecipacao.trim() : "",
      aprendizado: typeof raw.aprendizado === "string" ? raw.aprendizado.trim() : "",
      contorno: typeof raw.contorno === "string" ? raw.contorno.trim() : "",
      tema: typeof raw.tema === "string" ? raw.tema.trim() : "",
      fase: typeof raw.fase === "string" ? raw.fase.trim() : "",
      impacto: raw.impacto as Impacto,
      registradoEm: typeof raw.registradoEm === "string" && raw.registradoEm.trim() ? raw.registradoEm.trim() : agora,
    };
    if (typeof raw.fonte === "string" && raw.fonte.trim()) {
      candidato.fonte = raw.fonte.trim();
    }
    const entryErrors = validarEntrada(candidato);
    if (entryErrors.length > 0) {
      erros.push(...entryErrors.map((msg) => `entrada[${i}]: ${msg}`));
    } else {
      normalizadas.push(candidato);
    }
  }

  if (erros.length > 0) {
    return { base, adicionadas: [], ignoradas: [], erros };
  }

  const existingIds = new Set(base.entradas.map((e) => e.id));
  const existingKeys = new Set(base.entradas.map((e) => chaveDuplicidade(e)));

  const novasEntradas: Entrada[] = [];
  const adicionadas: string[] = [];
  const ignoradas: string[] = [];

  for (const e of normalizadas) {
    const dupKey = chaveDuplicidade(e);
    if (existingIds.has(e.id) || existingKeys.has(dupKey)) {
      ignoradas.push(e.id);
      continue;
    }
    existingIds.add(e.id);
    existingKeys.add(dupKey);
    novasEntradas.push(e);
    adicionadas.push(e.id);
  }

  const projetos = [...base.projetos];
  if (!projetos.some((p) => p.id === projetoId)) {
    if (lote.projeto && lote.projeto.id === projetoId) {
      projetos.push(cleanProjeto(lote.projeto));
    } else {
      projetos.push({ id: projetoId, nome: projetoId.toUpperCase() });
    }
  }

  const semanas = base.semanas.map((s) => ({ ...s, entradas: [...s.entradas] }));
  const weekIdx = semanas.findIndex((s) => s.projeto === projetoId && s.semana === semanaData);
  if (weekIdx >= 0) {
    const existingWeek = semanas[weekIdx];
    const setIds = new Set(existingWeek.entradas);
    for (const id of adicionadas) {
      if (!setIds.has(id)) {
        existingWeek.entradas.push(id);
        setIds.add(id);
      }
    }
    if (adicionadas.length > 0 && existingWeek.status === "sem-eventos") {
      existingWeek.status = "publicado";
    }
  } else {
    const hasNew = adicionadas.length > 0;
    const rawResumo = lote.semana.resumo?.trim() ?? "";
    const status: Semana["status"] = hasNew ? "publicado" : "sem-eventos";
    const resumo = hasNew ? (rawResumo || "Consolidação semanal") : (rawResumo || "Sem eventos relevantes");
    const novaSemana: Semana = {
      projeto: projetoId,
      semana: semanaData,
      status,
      resumo,
      entradas: [...adicionadas],
      executadoEm: agora,
    };
    if (lote.semana.janela?.de && lote.semana.janela?.ate) {
      novaSemana.janela = { de: lote.semana.janela.de, ate: lote.semana.janela.ate };
    }
    semanas.push(novaSemana);
  }

  const todasEntradas = [...base.entradas, ...novasEntradas];
  const allIdSet = new Set(todasEntradas.map((e) => e.id));

  const top3 = { ...base.top3 };
  if (Array.isArray(lote.top3)) {
    const licoes = lote.top3
      .filter((x): x is Licao => !!x && typeof x.licao === "string" && x.licao.trim().length > 0)
      .slice(0, 3)
      .map((x) => ({
        licao: x.licao.trim(),
        baseadoEm: Array.isArray(x.baseadoEm) ? x.baseadoEm.filter((id) => typeof id === "string" && allIdSet.has(id)) : [],
      }));
    top3[projetoId] = { atualizadoEm: agora, licoes };
  }

  const novaBase: BaseConhecimento = {
    versao: 1,
    atualizadoEm: agora,
    projetos,
    entradas: todasEntradas,
    semanas,
    top3,
  };

  return { base: novaBase, adicionadas, ignoradas, erros: [] };
}

export function ultimaSemana(base: BaseConhecimento, projeto: string): string | null {
  const list = base.semanas
    .filter((s) => s.projeto === projeto)
    .map((s) => s.semana)
    .sort();
  return list.length > 0 ? list[list.length - 1] : null;
}

export function ultimoRegistro(base: BaseConhecimento, projeto: string): string | null {
  const timestamps: string[] = [];
  for (const e of base.entradas) {
    if (e.projeto === projeto && e.registradoEm) timestamps.push(e.registradoEm);
  }
  for (const s of base.semanas) {
    if (s.projeto === projeto && s.executadoEm) timestamps.push(s.executadoEm);
  }
  timestamps.sort();
  return timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;
}
