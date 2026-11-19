import assert from "node:assert/strict";
import { isAllowedEmail } from "../src/lib/allowed-email.ts";

assert.equal(isAllowedEmail({ email: "a@gmail.com", email_verified: true }, "a@gmail.com"), true);
assert.equal(isAllowedEmail({ email: "b@empresa.com", email_verified: true }, "a@gmail.com, b@empresa.com"), true);
assert.equal(isAllowedEmail({ email: "c@gmail.com", email_verified: true }, "a@gmail.com, b@empresa.com"), false);
assert.equal(isAllowedEmail({ email: "qualquer@gmail.com", email_verified: true }, "*"), true);
assert.equal(isAllowedEmail({ email: "a@gmail.com", email_verified: false }, "*"), false);
assert.equal(isAllowedEmail({ email: "a@gmail.com", email_verified: true }, undefined), false);

console.log("allowed-email: ok");
