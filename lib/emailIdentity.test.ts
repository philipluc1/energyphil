// Run: npx tsx lib/emailIdentity.test.ts
import assert from "node:assert/strict";
import { canonicalEmail, normalEmail } from "./emailIdentity";
assert.equal(normalEmail("  Phil@Example.COM "), "phil@example.com");
assert.equal(canonicalEmail("P.H.I.L+utilo@gmail.com"), "phil@gmail.com");
assert.equal(canonicalEmail("phil@googlemail.com"), "phil@gmail.com");
assert.equal(canonicalEmail("first.last+x@outlook.com"), "first.last@outlook.com"); // dots matter outside Gmail
assert.equal(canonicalEmail("not-an-email"), "not-an-email");
console.log("email identity ok");
