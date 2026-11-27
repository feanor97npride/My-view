export const TIPOS = {
  decisao: "Decisão",
  "mudanca-rota": "Mudança de rota",
  retrabalho: "Retrabalho",
  erro: "Erro",
  risco: "Risco",
  "boa-pratica": "Boa prática",
} as const;

export type Tipo = keyof typeof TIPOS;

export const IMPACTOS = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
} as const;

export type Impacto = keyof typeof IMPACTOS;

export const TEMAS_SUGERIDOS = [
  "Contratos e comercial",
  "Escopo e planejamento",
  "Governança e papéis",
  "Comunicação com o cliente",
  "Pessoas e contratação",
  "Ferramentas e portal",
  "Operação e serviços",
  "Documentação e padrões",
] as const;

export const FASES_SUGERIDAS = [
  "Pré-venda e proposta",
  "Mobilização",
  "Diagnóstico",
  "Estruturação",
  "Execução",
  "Encerramento",
] as const;

export type Projeto = {
  id: string;
  nome: string;
  cliente?: string;
  descricao?: string;
  inicio?: string;
};

export type Entrada = {
  id: string;
  projeto: string;
  semana: string;
  data: string;
  tipo: Tipo;
  titulo: string;
  acontecimento: string;
  contexto: string;
  acao: string;
  antecipacao: string;
  aprendizado: string;
  contorno: string;
  tema: string;
  fase: string;
  impacto: Impacto;
  fonte?: string;
  registradoEm: string;
};

export type Semana = {
  projeto: string;
  semana: string;
  status: "publicado" | "sem-eventos";
  resumo: string;
  entradas: string[];
  executadoEm: string;
  janela?: { de: string; ate: string };
};

export type Licao = {
  licao: string;
  baseadoEm: string[];
};

export type BaseConhecimento = {
  versao: 1;
  atualizadoEm: string;
  projetos: Projeto[];
  entradas: Entrada[];
  semanas: Semana[];
  top3: Record<string, { atualizadoEm: string; licoes: Licao[] }>;
};
