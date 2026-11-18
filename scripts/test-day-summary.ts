// Run: node --experimental-strip-types --no-warnings scripts/test-day-summary.ts
import assert from "node:assert/strict";
import { meetingStatus, normalizeWindow, staticAlerts, summarize } from "../src/lib/day-summary.ts";

// summarize
assert.equal(
  summarize({ eventsCount: 5, busyHours: 7.9, nextEventTime: "16:50", overdue: 14, dueToday: 0, actionEmails: 3 }),
  "Hoje você tem 5 compromissos (7,9 h na agenda), o próximo às 16:50. 14 tarefas atrasadas, 0 vencem hoje. 3 e-mails de ação por ler.",
);
assert.equal(
  summarize({ eventsCount: 1, busyHours: 0, nextEventTime: null, overdue: 1, dueToday: 1, actionEmails: 1 }),
  "Hoje você tem 1 compromisso. 1 tarefa atrasada, 1 vence hoje. 1 e-mail de ação por ler.",
);
assert.equal(
  summarize({ eventsCount: 0, busyHours: 0, nextEventTime: null, overdue: 0, dueToday: 0, actionEmails: 0 }),
  "Hoje você não tem compromissos. 0 tarefas atrasadas, 0 vencem hoje. Nenhum e-mail de ação por ler.",
);
// a source that failed (null) is left out instead of showing a wrong zero
assert.equal(
  summarize({ eventsCount: 2, busyHours: 1.25, nextEventTime: "09:00", overdue: null, dueToday: null, actionEmails: null }),
  "Hoje você tem 2 compromissos (1,3 h na agenda), o próximo às 09:00.",
);
assert.equal(summarize({ eventsCount: null, busyHours: 0, nextEventTime: null, overdue: null, dueToday: null, actionEmails: null }), "");

// staticAlerts
assert.deepEqual(staticAlerts({ overdue: 0, oldestOverdueDays: 0, dueToday: 0, actionEmails: 0 }), []);
assert.deepEqual(staticAlerts({ overdue: null, oldestOverdueDays: 0, dueToday: null, actionEmails: null }), []);
const alerts = staticAlerts({ overdue: 14, oldestOverdueDays: 5, dueToday: 2, actionEmails: 1 });
assert.deepEqual(alerts.map((a) => [a.id, a.tone, a.href]), [
  ["overdue", "red", "/indicadores"],
  ["today", "amber", "/semana"],
  ["mail", "violet", "/emails?categoria=acao&naolidos=1"],
]);
assert.equal(alerts[0].text, "14 tarefas atrasadas, a mais antiga há 5 dias");
assert.equal(alerts[1].text, "2 tarefas vencem hoje");
assert.equal(alerts[2].text, "1 e-mail de ação por ler");
assert.equal(staticAlerts({ overdue: 1, oldestOverdueDays: 1, dueToday: 1, actionEmails: 0 })[0].text, "1 tarefa atrasada, a mais antiga há 1 dia");
assert.equal(staticAlerts({ overdue: 1, oldestOverdueDays: 0, dueToday: 0, actionEmails: 0 })[0].text, "1 tarefa atrasada");

// awaiting-reply alert
assert.deepEqual(staticAlerts({ overdue: 0, oldestOverdueDays: 0, dueToday: 0, actionEmails: 0, awaiting: 0 }), []);
assert.deepEqual(staticAlerts({ overdue: 0, oldestOverdueDays: 0, dueToday: 0, actionEmails: 0, awaiting: null }), []);
const aw = staticAlerts({ overdue: 0, oldestOverdueDays: 0, dueToday: 0, actionEmails: 0, awaiting: 3 });
assert.equal(aw[0].id, "awaiting");
assert.equal(aw[0].href, "/emails?categoria=aguardando");
assert.equal(aw[0].text, "3 conversas aguardando resposta há 2+ dias");
assert.equal(staticAlerts({ overdue: 0, oldestOverdueDays: 0, dueToday: 0, actionEmails: 0, awaiting: 1 })[0].text, "1 conversa aguardando resposta há 2+ dias");

// meetingStatus
const now = new Date("2026-11-17T15:00:00Z");
const at = (min: number) => new Date(now.getTime() + min * 60_000).toISOString();
const ev = (id: string, startMin: number, endMin: number) => ({ id, title: id, start: at(startMin), end: at(endMin) });

assert.equal(meetingStatus([], now), null);
assert.deepEqual(meetingStatus([ev("a", 10, 70)], now), { kind: "soon", event: ev("a", 10, 70), minutes: 10 });
assert.deepEqual(meetingStatus([ev("a", -20, 40)], now)?.kind, "now");
assert.equal(meetingStatus([ev("a", -20, 40)], now)?.minutes, 40); // time left
assert.equal(meetingStatus([ev("a", 30, 90)], now)?.kind, "soon"); // exactly at the window edge
assert.equal(meetingStatus([ev("a", 31, 90)], now), null); // just outside
assert.equal(meetingStatus([ev("a", 0, 60)], now)?.kind, "now"); // starts exactly now
assert.equal(meetingStatus([ev("a", -60, 0)], now), null); // ended exactly now
assert.equal(meetingStatus([ev("a", -120, -60)], now), null); // already over
assert.equal(meetingStatus([ev("late", 25, 80), ev("early", 5, 50)], now)?.event.id, "early"); // soonest first
assert.equal(meetingStatus([ev("next", 5, 60), ev("current", -30, 10)], now)?.event.id, "current"); // in progress wins
assert.equal(meetingStatus([ev("a", 45, 90)], now, 60)?.kind, "soon"); // custom window
assert.equal(meetingStatus([{ id: "bad", title: "bad", start: "nope", end: "nope" }], now), null); // invalid dates ignored

// normalizeWindow
assert.equal(normalizeWindow(15), 15);
assert.equal(normalizeWindow("10"), 10);
assert.equal(normalizeWindow(7), 30);
assert.equal(normalizeWindow(null), 30);
assert.equal(normalizeWindow("abc"), 30);
assert.equal(normalizeWindow(undefined), 30);

console.log("day-summary: ok");
