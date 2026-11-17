// Run: node --experimental-strip-types --no-warnings scripts/test-email-view.ts
import assert from "node:assert/strict";
import { decodeEntities, filterEmails, parseSender, shortDate } from "../src/lib/email-view.ts";

// parseSender
assert.deepEqual(parseSender("Vercel <notifications@vercel.com>"), { name: "Vercel", address: "notifications@vercel.com" });
assert.deepEqual(parseSender('"Maria Silva" <m@x.com>'), { name: "Maria Silva", address: "m@x.com" });
assert.deepEqual(parseSender("<solo@x.com>"), { name: "solo@x.com", address: "solo@x.com" });
assert.deepEqual(parseSender("a@b.com"), { name: "a@b.com", address: "a@b.com" });
assert.deepEqual(parseSender(""), { name: "", address: "" });

// decodeEntities: named, decimal, hex, unknown stays, no double decoding
assert.equal(decodeEntities("Tom &amp; Jerry&#39;s &quot;show&quot;"), 'Tom & Jerry\'s "show"');
assert.equal(decodeEntities("caf&#xE9; &#233;"), "café é");
assert.equal(decodeEntities("&unknown; &#0; &#99999999;"), "&unknown; &#0; &#99999999;");
assert.equal(decodeEntities("&amp;lt;"), "&lt;");

// filterEmails
const mk = (id: string, category: string, unread: boolean, sender: string, subject: string) => ({ id, category, unread, sender, subject });
const list = [
  mk("1", "acao", true, "Vercel <n@vercel.com>", "Production deployment failed"),
  mk("2", "financeiro", false, "Banco <b@banco.com>", "Sua fatura está disponível"),
  mk("3", "acao", false, "RH <rh@x.com>", "Ação necessária: assinar"),
];
assert.deepEqual(filterEmails(list, {}).map((e) => e.id), ["1", "2", "3"]);
assert.deepEqual(filterEmails(list, { categoria: "acao" }).map((e) => e.id), ["1", "3"]);
assert.deepEqual(filterEmails(list, { naolidos: true }).map((e) => e.id), ["1"]);
assert.deepEqual(filterEmails(list, { q: "FATURA" }).map((e) => e.id), ["2"]);
assert.deepEqual(filterEmails(list, { q: "acao necessaria" }).map((e) => e.id), ["3"]); // accent-insensitive
assert.deepEqual(filterEmails(list, { categoria: "acao", naolidos: true, q: "vercel" }).map((e) => e.id), ["1"]);
assert.deepEqual(filterEmails(list, { q: "inexistente" }), []);

// shortDate in Sao Paulo (UTC-3)
const now = new Date("2026-11-16T18:00:00Z");
assert.equal(shortDate(new Date("2026-11-16T17:05:00Z"), now, "America/Sao_Paulo"), "14:05");
assert.equal(shortDate(new Date("2026-11-14T15:00:00Z"), now, "America/Sao_Paulo"), "14 nov");

console.log("email-view: ok");
