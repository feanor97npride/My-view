import assert from "node:assert/strict";
import { decryptSecret, encryptSecret } from "../src/lib/crypto.ts";

process.env.AUTH_SECRET = "test-secret-for-unit-tests-only";

const plain = "pk_live_1234567890_secret";
const encrypted = encryptSecret(plain);
assert.ok(encrypted.startsWith("enc:v1:"), "encrypted value should use enc:v1 prefix");
assert.notEqual(encrypted, plain);
assert.equal(decryptSecret(encrypted), plain);

// Backward compatibility with legacy plaintext tokens
assert.equal(decryptSecret("legacy-plaintext-token"), "legacy-plaintext-token");
assert.equal(encryptSecret("   "), "");
assert.equal(decryptSecret(""), "");

console.log("crypto: ok");
