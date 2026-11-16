// Run: node --experimental-strip-types --no-warnings scripts/test-gmail.ts
import assert from "node:assert/strict";
import { parseCategory, ruleCategory } from "../src/lib/gmail.ts";

assert.equal(ruleCategory("Banco X <a@banco.com>", "Sua fatura venceu"), "financeiro");
assert.equal(ruleCategory("Maria <m@x.com>", "Convite: reunião de projeto"), "agendamento");
assert.equal(ruleCategory("RH <rh@x.com>", "Ação necessária: assinar termo"), "acao");
assert.equal(ruleCategory("news@loja.com", "Oferta da semana"), null); // left to the AI

assert.equal(parseCategory("trabalho"), "trabalho");
assert.equal(parseCategory(" Aguardando.\n"), "aguardando");
assert.equal(parseCategory("Ação."), "acao");
assert.equal(parseCategory("Categoria: Financeiro"), "financeiro");
assert.equal(parseCategory("não sei"), null);

console.log("gmail: ok");
