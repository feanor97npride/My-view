// Run: node --experimental-strip-types --no-warnings scripts/test-clickup.ts
import assert from "node:assert/strict";
import { bucketOf, canonicalStatus, countByDay } from "../src/lib/clickup.ts";

const now = new Date(2026, 10, 16, 10, 0, 0); // 16 Nov 2026, 10:00 local
const at = (d: number, h = 12) => new Date(2026, 10, d, h, 0, 0);

assert.equal(bucketOf(null, now), "nodate");
assert.equal(bucketOf(at(15), now), "overdue");
assert.equal(bucketOf(at(16, 23), now), "today");
assert.equal(bucketOf(at(18), now), "week");
assert.equal(bucketOf(at(30), now), "later");

// countByDay: 3 days ending 16 Nov in Sao Paulo (UTC-3), zero-filled, oldest first
const days = countByDay(
  [new Date("2026-11-16T12:00:00Z"), new Date("2026-11-16T14:00:00Z"), new Date("2026-11-15T03:30:00Z"), new Date("2026-11-15T01:00:00Z"), new Date("2026-10-01T00:00:00Z")],
  3,
  "America/Sao_Paulo",
  new Date("2026-11-16T15:00:00Z"),
);
assert.deepEqual(days, [{ day: "2026-11-14", n: 1 }, { day: "2026-11-15", n: 1 }, { day: "2026-11-16", n: 2 }]);

assert.equal(canonicalStatus("In Progress"), "Em andamento");
assert.equal(canonicalStatus("em progresso"), "Em andamento");
assert.equal(canonicalStatus(" pendente "), "A fazer");
assert.equal(canonicalStatus("to do"), "A fazer");
assert.equal(canonicalStatus("eu - pendente"), "A fazer");
assert.equal(canonicalStatus("on hold"), "on hold");

console.log("clickup: ok");
