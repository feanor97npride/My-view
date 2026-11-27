import assert from "node:assert/strict";
import { DEFAULT_NEWSLETTER_RULES, matchesNewsletter } from "../src/lib/newsletter.ts";

assert.equal(
  matchesNewsletter({ sender: "Marcos Vinicius", subject: "Resumo Diário de Notícias de IA" }, DEFAULT_NEWSLETTER_RULES),
  true,
);
assert.equal(
  matchesNewsletter({ sender: "Marcos Vinicius", subject: "Resumo Geopolítico — 27/11" }, DEFAULT_NEWSLETTER_RULES),
  true,
);
assert.equal(
  matchesNewsletter({ sender: "Marcos Vinicius", subject: "Resumo Geo Político diário" }, DEFAULT_NEWSLETTER_RULES),
  true,
);
assert.equal(
  matchesNewsletter({ sender: "Udemy", subject: "Black Friday courses" }, DEFAULT_NEWSLETTER_RULES),
  false,
);

console.log("newsletter: ok");
