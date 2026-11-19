// Run: node --experimental-strip-types --no-warnings scripts/test-triage.ts
import assert from "node:assert/strict";
import { agruparInformativos, buildQueue, extractFinance, financeDueDays, maisBarulhento, resumir, senderInfo, tituloResumo, type TriItem } from "../src/lib/triage.ts";

let n = 0;
const mk = (category: string, unread: boolean, receivedAt: string, sender = `P${n} <p${n}@x.com>`, subject = `s${n}`): TriItem => ({
  id: `m${n++}`, threadId: `t${n}`, sender, subject, snippet: "", receivedAt, unread, category, when: "agora", url: "u",
});

// senderInfo
assert.deepEqual(senderInfo('"Ana Souza" <Ana@Gmail.com>'), { nome: "Ana Souza", email: "ana@gmail.com", dominio: "gmail.com" });
assert.deepEqual(senderInfo("a@b.com"), { nome: "a@b.com", email: "a@b.com", dominio: "b.com" });
assert.equal(senderInfo("").nome, "(sem remetente)");

// default queue: unread only, Ação > Financeiro > Agendamento > Trabalho > Pessoal, oldest first, never Informativo
const fin = mk("financeiro", true, "2026-11-17T10:00:00Z");
const acaoNew = mk("acao", true, "2026-11-18T10:00:00Z");
const acaoOld = mk("acao", true, "2026-11-16T10:00:00Z");
const age = mk("agendamento", true, "2026-11-15T10:00:00Z");
const trab = mk("trabalho", true, "2026-11-14T10:00:00Z");
const lida = mk("acao", false, "2026-11-10T10:00:00Z");
const info = mk("informativo", true, "2026-11-01T10:00:00Z");
const all = [info, lida, trab, age, acaoNew, fin, acaoOld];
assert.deepEqual(buildQueue(all, null).map((i) => i.id), [acaoOld.id, acaoNew.id, fin.id, age.id, trab.id]);
assert.deepEqual(buildQueue([info, lida], null), []);

// filtered queue: that category only, unread first, then oldest
assert.deepEqual(buildQueue(all, "acao").map((i) => i.id), [acaoOld.id, acaoNew.id, lida.id]);
assert.deepEqual(buildQueue(all, "informativo").map((i) => i.id), [info.id]);
assert.deepEqual(buildQueue(all, "aguardando"), []);

// resumir + title
const r = resumir(all);
assert.equal(r.total, 7);
assert.equal(r.importantes, 4); // acaoNew, fin, acaoOld, age unread
assert.equal(r.importantesTotal, 5);
assert.equal(r.importantesTriados, 1);
assert.equal(r.porCategoria.acao, 3);
assert.deepEqual(tituloResumo(r), { total: "7 e-mails.", destaque: "Só 4 precisam de você." });
assert.deepEqual(tituloResumo(resumir([mk("acao", true, "2026-11-18T10:00:00Z")])), { total: "1 e-mail.", destaque: "Só 1 precisa de você." });
assert.deepEqual(tituloResumo(resumir([lida])), { total: "1 e-mail.", destaque: "Tudo em dia." });
assert.deepEqual(tituloResumo(resumir([])), { total: "0 e-mails.", destaque: "Tudo em dia." });

// informativo groups: by address, noisiest first; noisiest needs 3+
const nl = (t: string, subject: string) => mk("informativo", false, t, "News <n@news.com>", subject);
const grupos = agruparInformativos([nl("2026-11-16T10:00:00Z", "a"), nl("2026-11-18T10:00:00Z", "c"), nl("2026-11-17T10:00:00Z", "b"), mk("informativo", false, "2026-11-18T09:00:00Z", "Solo <s@x.com>", "z"), trab]);
assert.equal(grupos.length, 2);
assert.equal(grupos[0].qtd, 3);
assert.equal(grupos[0].linha, "c"); // most recent subject
assert.deepEqual(grupos[0].assuntos, ["c", "b", "a"]);
assert.equal(maisBarulhento(grupos)?.email, "n@news.com");
assert.equal(maisBarulhento(grupos.slice(1)), null); // only 1 e-mail
assert.equal(maisBarulhento([]), null);

// archived (inInbox: false) counts as triado and leaves the queue
const arquivado: TriItem = { ...mk("acao", true, "2026-11-18T11:00:00Z"), inInbox: false };
assert.deepEqual(buildQueue([arquivado], null), []);
assert.deepEqual(buildQueue([arquivado], "acao"), []);
assert.equal(resumir([arquivado]).importantes, 0);
assert.equal(resumir([arquivado]).importantesTriados, 1);

const triado: TriItem = { ...mk("agendamento", true, "2026-11-18T11:00:00Z"), triado: true, calendarEventId: "ev1" };
assert.deepEqual(buildQueue([triado], null), []);
assert.equal(resumir([triado]).importantes, 0);

// extractFinance + urgent financeiro (<= 3 days) beats acao
assert.deepEqual(extractFinance("Fatura fechou: R$ 1.482,90 com vencimento em 20/11"), {
  valor: "R$ 1.482,90",
  vencimento: "20/11",
});
assert.deepEqual(extractFinance("Boleto vence amanhã no valor R$ 99,00"), {
  valor: "R$ 99,00",
  vencimento: "amanhã",
});
const refNow = new Date("2026-11-18T12:00:00Z");
assert.equal(financeDueDays("20/11", refNow), 2);
assert.equal(financeDueDays("hoje", refNow), 0);
const finUrgente = mk("financeiro", true, "2026-11-18T10:00:00Z", "Banco <b@x.com>", "Fatura R$ 500,00 vence 20/11");
assert.equal(buildQueue([acaoOld, finUrgente], null, refNow)[0].id, finUrgente.id);

console.log("triage: ok");
