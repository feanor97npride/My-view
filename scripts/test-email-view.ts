// Run: node --experimental-strip-types --no-warnings scripts/test-email-view.ts
import assert from "node:assert/strict";
import { decodeEntities, filterEmails, parseSender, pickAwaiting, shortDate } from "../src/lib/email-view.ts";

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

// pickAwaiting: last message mine, 2+ days old, not only to myself
const T = (days: number, now: Date) => String(now.getTime() - days * 86_400_000);
const msg = (internalDate: string, labelIds: string[], to = "Ana <ana@x.com>", subject = "Proposta") => ({
  internalDate,
  labelIds,
  payload: { headers: [{ name: "To", value: to }, { name: "Subject", value: subject }] },
});
const threads = [
  { id: "ok", messages: [msg(T(5, now), ["INBOX"]), msg(T(3, now), ["SENT"])] }, // I wrote last, 3 days ago
  { id: "replied", messages: [msg(T(5, now), ["SENT"]), msg(T(1, now), ["INBOX"])] }, // they answered
  { id: "recent", messages: [msg(T(1, now), ["SENT"])] }, // only 1 day
  { id: "self", messages: [msg(T(4, now), ["SENT"], "Eu <me@x.com>")] }, // only to myself
  { id: "draft", messages: [msg(T(4, now), ["SENT", "DRAFT"])] },
  { id: "unordered", messages: [msg(T(2, now), ["SENT"], "Bia <bia@x.com>, Caio <caio@x.com>", "Reunião"), msg(T(6, now), ["INBOX"])] },
  { id: "nobody", messages: [msg(T(9, now), ["SENT"], "")] }, // bcc only: no visible To
];
const got = pickAwaiting(threads, "ME@x.com", now);
assert.deepEqual(got.map((a) => a.threadId), ["unordered", "ok", "nobody"]); // newest sent first
assert.equal(got[0].to, "Bia, Caio");
assert.equal(got[0].dias, 2);
assert.equal(got[1].subject, "Proposta");
assert.equal(got[1].dias, 3);
assert.equal(got[2].to, "(sem destinatário visível)");
assert.deepEqual(pickAwaiting([], "me@x.com", now), []);

console.log("email-view: ok");
