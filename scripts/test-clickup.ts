// Run: node --experimental-strip-types --no-warnings scripts/test-clickup.ts
import assert from "node:assert/strict";
import { bucketOf } from "../src/lib/clickup.ts";

const now = new Date(2026, 10, 16, 10, 0, 0); // 16 Nov 2026, 10:00 local
const at = (d: number, h = 12) => new Date(2026, 10, d, h, 0, 0);

assert.equal(bucketOf(null, now), "nodate");
assert.equal(bucketOf(at(15), now), "overdue");
assert.equal(bucketOf(at(16, 23), now), "today");
assert.equal(bucketOf(at(18), now), "week");
assert.equal(bucketOf(at(30), now), "later");

console.log("clickup: ok");
