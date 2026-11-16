// Run: node --experimental-strip-types --no-warnings scripts/test-calendar.ts
import assert from "node:assert/strict";
import { busyHours, dayWindow, toEvent } from "../src/lib/calendar.ts";

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

// busyHours counts overlaps once: 10-12 + 11-13 + 14-15 = 3h + 1h = 4h
const ev = (s: string, e: string, allDay = false) => ({ id: s, title: "x", calendar: "c", start: new Date(s), end: new Date(e), allDay });
assert.equal(busyHours([ev("2026-11-16T10:00:00Z", "2026-11-16T12:00:00Z"), ev("2026-11-16T11:00:00Z", "2026-11-16T13:00:00Z"), ev("2026-11-16T14:00:00Z", "2026-11-16T15:00:00Z")]), 4);
assert.equal(busyHours([ev("2026-11-16T00:00:00Z", "2026-11-17T00:00:00Z", true)]), 0); // all-day does not count
assert.equal(busyHours([]), 0);

console.log("calendar: ok");
