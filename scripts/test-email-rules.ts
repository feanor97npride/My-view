// Run: node --experimental-strip-types --no-warnings scripts/test-email-rules.ts
import assert from "node:assert/strict";
import { categorize, matchUserRule, normalizeRule, parseCategory, ruleCategory } from "../src/lib/email-rules.ts";

// keyword rules
assert.equal(ruleCategory("Banco X <a@banco.com>", "Sua fatura venceu"), "financeiro");
assert.equal(ruleCategory("Maria <m@x.com>", "Convite: reunião de projeto"), "agendamento");
assert.equal(ruleCategory("RH <rh@x.com>", "Ação necessária: assinar termo"), "acao");
assert.equal(ruleCategory("news@loja.com", "Oferta da semana"), null); // left to bulk/AI

// parseCategory: "aguardando" is no longer a classifiable category
assert.equal(parseCategory("trabalho"), "trabalho");
assert.equal(parseCategory("Ação."), "acao");
assert.equal(parseCategory("Categoria: Financeiro"), "financeiro");
assert.equal(parseCategory("Aguardando."), null);
assert.equal(parseCategory("não sei"), null);

// normalizeRule: domain or address, known category, size limit
assert.deepEqual(normalizeRule({ match: "  Empresa.COM ", category: "trabalho" }), { match: "empresa.com", category: "trabalho" });
assert.deepEqual(normalizeRule({ match: "Ana@Empresa.com", category: "pessoal" }), { match: "ana@empresa.com", category: "pessoal" });
assert.equal(normalizeRule({ match: "empresa", category: "trabalho" }), null); // no TLD
assert.equal(normalizeRule({ match: "http://empresa.com", category: "trabalho" }), null);
assert.equal(normalizeRule({ match: "a b@x.com", category: "trabalho" }), null);
assert.equal(normalizeRule({ match: "empresa.com", category: "aguardando" }), null); // not assignable
assert.equal(normalizeRule({ match: "empresa.com", category: "nada" }), null);
assert.equal(normalizeRule({ match: "", category: "trabalho" }), null);
assert.equal(normalizeRule({ match: `${"a".repeat(100)}.com`, category: "trabalho" }), null);

// matchUserRule: exact address, domain, subdomain, false suffix, order
const rules = [
  { match: "ana@gmail.com", category: "pessoal" as const },
  { match: "google.com", category: "trabalho" as const },
  { match: "gmail.com", category: "informativo" as const },
];
assert.equal(matchUserRule("Ana <ana@gmail.com>", rules), "pessoal"); // first match wins over the later gmail.com rule
assert.equal(matchUserRule("Outra <outra@gmail.com>", rules), "informativo");
assert.equal(matchUserRule("Meet <noreply@google.com>", rules), "trabalho");
assert.equal(matchUserRule("Notes <gemini-notes@mail.google.com>", rules), "trabalho"); // subdomain
assert.equal(matchUserRule("x@notgoogle.com", rules), null); // not a real subdomain
assert.equal(matchUserRule("x@google.com.evil.io", rules), null);
assert.equal(matchUserRule("anyone@x.com", []), null);

// categorize order: user rule > keyword > List-Unsubscribe > AI (null)
const userRules = [{ match: "banco.com", category: "informativo" as const }];
assert.deepEqual(categorize("Banco <n@banco.com>", "Sua fatura", true, userRules), { category: "informativo", by: "rule:user" });
assert.deepEqual(categorize("Loja <n@loja.com>", "Sua fatura chegou", true, []), { category: "financeiro", by: "rule" });
assert.deepEqual(categorize("News <n@news.com>", "Resumo semanal", true, []), { category: "informativo", by: "rule:bulk" });
assert.equal(categorize("Vercel <notifications@vercel.com>", "Production deployment failed", false, []), null); // transactional: AI decides

console.log("email-rules: ok");
