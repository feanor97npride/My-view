// Run: node --experimental-strip-types scripts/test-allowed-email.ts
import assert from "node:assert/strict";
import { isAllowedEmail } from "../src/lib/allowed-email.ts";

const me = "owner@example.com";
assert.equal(isAllowedEmail({ email: me, email_verified: true }, me), true);
assert.equal(isAllowedEmail({ email: "OWNER@example.com", email_verified: true }, me), true);
assert.equal(isAllowedEmail({ email: me, email_verified: false }, me), false);
assert.equal(isAllowedEmail({ email: "other@example.com", email_verified: true }, me), false);
assert.equal(isAllowedEmail({ email: me, email_verified: true }, undefined), false);
assert.equal(isAllowedEmail(undefined, me), false);
console.log("allowed-email: ok");
