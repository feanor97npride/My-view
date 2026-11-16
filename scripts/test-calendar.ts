// Run: node --experimental-strip-types --no-warnings scripts/test-calendar.ts
import assert from "node:assert/strict";
import { dayWindow, toEvent } from "../src/lib/calendar.ts";

// Sao Paulo (UTC-3, no DST): 12:00 local on 16 Nov = 15:00Z
let w = dayWindow(new Date("2026-11-16T15:00:00Z"), "America/Sao_Paulo");
assert.equal(w.start.toISOString(), "2026-11-16T03:00:00.000Z");
assert.equal(w.end.toISOString(), "2026-11-17T03:00:00.000Z");

// Tokyo (UTC+9): 20:00Z on 16 Nov is already 05:00 on 17 Nov locally
w = dayWindow(new Date("2026-11-16T20:00:00Z"), "Asia/Tokyo");
assert.equal(w.start.toISOString(), "2026-11-16T15:00:00.000Z");
assert.equal(w.end.toISOString(), "2026-11-17T15:00:00.000Z");

const timed = toEvent({ id: "a", summary: "Reunião", start: { dateTime: "2026-11-16T10:00:00-03:00" }, end: { dateTime: "2026-11-16T11:00:00-03:00" } }, "Trabalho");
assert.equal(timed.allDay, false);
assert.equal(timed.title, "Reunião");

const allDay = toEvent({ id: "b", start: { date: "2026-11-16" }, end: { date: "2026-11-17" } }, "Pessoal");
assert.equal(allDay.allDay, true);
assert.equal(allDay.title, "(sem título)");

console.log("calendar: ok");
