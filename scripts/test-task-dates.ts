import assert from "node:assert/strict";
import { addDaysKey, dayKey, dueForKey, freeBlocks, isBusinessDay, isDayKey, nextBusinessKey, planOverdue, postponeKey, normalizePlanPrefs, DEFAULT_PLAN, scoreTask, suggestPlan, weekdayOf, zonedMs } from "../src/lib/task-dates.ts";

// 2026-11-18 is a Wednesday.
assert.equal(weekdayOf("2026-11-18"), 3);
assert.equal(addDaysKey("2026-11-30", 1), "2026-12-01");
assert.equal(addDaysKey("2026-03-01", -1), "2026-02-28");
assert.ok(isDayKey("2026-02-28"));
assert.ok(!isDayKey("2026-02-30"));
assert.ok(!isDayKey("amanha"));
assert.ok(!isDayKey(undefined));
assert.ok(isBusinessDay("2026-11-20")); // Friday
assert.ok(!isBusinessDay("2026-11-21")); // Saturday
assert.equal(nextBusinessKey("2026-11-20"), "2026-11-23"); // Friday -> Monday
assert.equal(nextBusinessKey("2026-11-18"), "2026-11-19");

const wed = new Date("2026-11-18T20:00:00Z");
assert.equal(postponeKey("tomorrow", wed, "America/Sao_Paulo"), "2026-11-19");
assert.equal(postponeKey("monday", wed, "America/Sao_Paulo"), "2026-11-23");
assert.equal(postponeKey("nextBusiness", wed, "America/Sao_Paulo"), "2026-11-19");

// Time zone matters near midnight: 02:00 UTC on the 19th is still the 18th in São Paulo.
const late = new Date("2026-11-19T02:00:00Z");
assert.equal(dayKey(late, "America/Sao_Paulo"), "2026-11-18");
assert.equal(postponeKey("tomorrow", late, "America/Sao_Paulo"), "2026-11-19");
assert.equal(postponeKey("tomorrow", late, "UTC"), "2026-11-20");

// Monday asked on a Monday goes to the following Monday.
assert.equal(postponeKey("monday", new Date("2026-11-23T12:00:00Z"), "UTC"), "2026-11-30");
// Friday + business day skips the weekend.
assert.equal(postponeKey("nextBusiness", new Date("2026-11-20T12:00:00Z"), "UTC"), "2026-11-23");

// Due is noon UTC of the target day.
assert.equal(new Date(dueForKey("2026-11-19")).toISOString(), "2026-11-19T12:00:00.000Z");

// planOverdue: most urgent and oldest first, `perDay` per business day, skipping the weekend.
const ov = [
  { id: "a", priority: null, dueMs: 1 },
  { id: "b", priority: "urgent", dueMs: 5 },
  { id: "c", priority: null, dueMs: 0 },
  { id: "d", priority: "high", dueMs: 9 },
];
assert.deepEqual(planOverdue(ov, "2026-11-20", 2), [
  { taskId: "b", date: "2026-11-20" },
  { taskId: "d", date: "2026-11-20" },
  { taskId: "c", date: "2026-11-23" },
  { taskId: "a", date: "2026-11-23" },
]);
// Saturday start goes to Monday; days already loaded take fewer.
assert.deepEqual(planOverdue([ov[0], ov[1]], "2026-11-21", 1, { "2026-11-23": 1 }), [
  { taskId: "b", date: "2026-11-24" },
  { taskId: "a", date: "2026-11-25" },
]);
assert.deepEqual(planOverdue([], "2026-11-18", 3), []);

// zonedMs: 09:00 in São Paulo (UTC-3) is 12:00 UTC.
assert.equal(new Date(zonedMs("2026-11-18", "09:00", "America/Sao_Paulo")).toISOString(), "2026-11-18T12:00:00.000Z");
assert.equal(new Date(zonedMs("2026-11-18", "18:00", "UTC")).toISOString(), "2026-11-18T18:00:00.000Z");

// freeBlocks
const H = 3_600_000;
const d0 = Date.UTC(2026, 10, 18, 9);
const d1 = Date.UTC(2026, 10, 18, 18);
assert.deepEqual(freeBlocks([], d0, d1, 30), [{ start: d0, end: d1 }]);
assert.deepEqual(freeBlocks([{ start: d0 + 2 * H, end: d0 + 3 * H }], d0, d1, 30), [
  { start: d0, end: d0 + 2 * H },
  { start: d0 + 3 * H, end: d1 },
]);
// overlapping events count once; a gap shorter than the minimum is dropped; events outside are ignored
assert.deepEqual(
  freeBlocks(
    [
      { start: d0, end: d0 + 2 * H },
      { start: d0 + H, end: d0 + 3 * H },
      { start: d0 + 3 * H + 10 * 60_000, end: d1 },
      { start: d1 + H, end: d1 + 2 * H },
    ],
    d0,
    d1,
    30,
  ),
  [],
);
// "now" in the middle of the day clips the first block
assert.deepEqual(freeBlocks([], d0 + 4 * H, d1, 30), [{ start: d0 + 4 * H, end: d1 }]);

// suggestPlan: score order, fits blocks, leaves a gap, reports what did not fit
const blocks = [{ start: d0, end: d0 + H }, { start: d0 + 4 * H, end: d0 + 5 * H }];
const cands = [
  { id: "low", kind: "task" as const, title: "baixa", minutes: 30, score: 40 },
  { id: "big", kind: "task" as const, title: "grande", minutes: 90, score: 95 },
  { id: "top", kind: "task" as const, title: "topo", minutes: 30, score: 90 },
  { id: "mail", kind: "email" as const, title: "emails", minutes: 15, score: 60 },
];
const plan = suggestPlan(blocks, cands, 5);
assert.deepEqual(plan.unplaced.map((c) => c.id), ["big"]);
assert.deepEqual(plan.items.map((c) => c.id), ["top", "mail", "low"]);
assert.equal(plan.items[0].startMs, d0);
assert.equal(plan.items[1].startMs, d0 + 35 * 60_000); // 30 min + 5 min gap
assert.equal(plan.items[2].startMs, d0 + 4 * H); // 'low' does not fit the 1h block anymore -> second block
assert.deepEqual(suggestPlan([], cands).items, []);

// scoreTask
assert.equal(scoreTask("overdue", 5, null), 75);
assert.equal(scoreTask("overdue", 99, "urgent"), 110);
assert.equal(scoreTask("today", 0, "high"), 80);
assert.ok(scoreTask("overdue", 12, null) > scoreTask("today", 0, null));

// normalizePlanPrefs
assert.deepEqual(normalizePlanPrefs(undefined), DEFAULT_PLAN);
assert.deepEqual(normalizePlanPrefs({ perDay: 5, start: "08:30", end: "17:00", taskMin: 45 }), { perDay: 5, start: "08:30", end: "17:00", taskMin: 45 });
assert.equal(normalizePlanPrefs({ perDay: 99 }).perDay, 3);
assert.equal(normalizePlanPrefs({ taskMin: 5 }).taskMin, 30);
assert.deepEqual(normalizePlanPrefs({ start: "19:00", end: "08:00" }).start, "09:00"); // end before start resets both
assert.equal(normalizePlanPrefs({ start: "25:00" }).start, "09:00");

console.log("task-dates: ok");
