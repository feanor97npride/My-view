import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  acrescentar,
  cifrar,
  decifrar,
  ultimaSemana,
  ultimoRegistro,
  vazia,
  type Lote,
} from "../src/lib/kb.ts";

const key1 = randomBytes(32).toString("base64");
const key2 = randomBytes(32).toString("base64");

const sampleEntry = {
  id: "kes-2026-11-19-renomeacao-do-projeto",
  data: "2026-11-19",
  tipo: "decisao" as const,
  titulo: "Renomeação do projeto de Governança",
  acontecimento: "Nome oficial ajustado com a diretoria.",
  contexto: "Alinhamento com o escopo aprovado.",
  acao: "Atualizado em todos os documentos.",
  antecipacao: "Validar nomenclatura na proposta.",
  aprendizado: "Confirmar nome oficial antes da mobilização.",
  contorno: "Incluir item no checklist de kickoff.",
  tema: "Governança e papéis",
  fase: "Mobilização",
  impacto: "alto" as const,
  fonte: "Kickoff KES",
};

// 1. Acréscimo normal
const lote1: Lote = {
  projeto: { id: "kes", nome: "KES", cliente: "Origem Energia", descricao: "Governança Digital", inicio: "2026-11-12" },
  semana: { projeto: "kes", semana: "2026-11-27", status: "publicado", resumo: "Primeira consolidação" },
  entradas: [sampleEntry],
  top3: [{ licao: "Confirmar nome oficial no kickoff.", baseadoEm: [sampleEntry.id, "id-inexistente"] }],
};

const r1 = acrescentar(vazia(), lote1, "2026-11-27T18:00:00.000Z");
assert.equal(r1.erros.length, 0);
assert.deepEqual(r1.adicionadas, [sampleEntry.id]);
assert.deepEqual(r1.ignoradas, []);
assert.equal(r1.base.entradas.length, 1);
assert.deepEqual(r1.base.top3.kes.licoes[0].baseadoEm, [sampleEntry.id]);
assert.equal(ultimaSemana(r1.base, "kes"), "2026-11-27");
assert.equal(ultimoRegistro(r1.base, "kes"), "2026-11-27T18:00:00.000Z");

// 2. Duplicata por título com id diferente é ignorada e não muda registradoEm da original
const loteDup: Lote = {
  semana: { projeto: "kes", semana: "2026-12-04", status: "publicado", resumo: "Segunda semana" },
  entradas: [
    {
      ...sampleEntry,
      id: "kes-2026-12-01-outro-id",
      titulo: "Renomeacao do projeto de governanca!", // mesmo título normalizado
    },
  ],
};
const rDup = acrescentar(r1.base, loteDup, "2026-12-04T18:00:00.000Z");
assert.equal(rDup.erros.length, 0);
assert.deepEqual(rDup.adicionadas, []);
assert.deepEqual(rDup.ignoradas, ["kes-2026-12-01-outro-id"]);
assert.equal(rDup.base.entradas.length, 1);
assert.equal(rDup.base.entradas[0].registradoEm, "2026-11-27T18:00:00.000Z");

// 3. Semana vazia vira "Sem eventos relevantes" e status "sem-eventos"
const loteVazio: Lote = {
  semana: { projeto: "kes", semana: "2026-12-11", resumo: "" },
  entradas: [],
};
const rVazio = acrescentar(r1.base, loteVazio, "2026-12-11T18:00:00.000Z");
assert.equal(rVazio.erros.length, 0);
const semVazia = rVazio.base.semanas.find((s) => s.semana === "2026-12-11");
assert.ok(semVazia);
assert.equal(semVazia.status, "sem-eventos");
assert.equal(semVazia.resumo, "Sem eventos relevantes");

// 4. Lote inválido não muda nada
const loteInvalido: Lote = {
  semana: { projeto: "kes", semana: "2026-12-18", resumo: "Teste" },
  entradas: [{ ...sampleEntry, id: "ID INVÁLIDO", aprendizado: "" }],
};
const rInv = acrescentar(r1.base, loteInvalido);
assert.ok(rInv.erros.length > 0);
assert.deepEqual(rInv.base, r1.base);

// 5. Cifra ida e volta, envelope sem texto legível, chave errada lança erro, envelope vazio devolve vazia()
const env = cifrar(r1.base, key1);
const envJson = JSON.stringify(env);
assert.equal(envJson.includes("Origem Energia"), false);
assert.equal(envJson.includes("Renomeação"), false);
assert.equal(env.sha.length, 16);

const dec = decifrar(env, key1);
assert.deepEqual(dec, r1.base);
assert.throws(() => decifrar(env, key2));
assert.equal(decifrar({}, key1).entradas.length, 0);

console.log("kb: ok");
