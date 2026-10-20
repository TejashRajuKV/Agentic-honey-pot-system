const assert = require("node:assert/strict");
const { fingerprint, compareFingerprints } = require("../src/services/behavioralSimilarityService");

const a = fingerprint(["Your account will be suspended immediately", "Verify your account now"]);
const b = fingerprint(["Your account is suspended immediately", "Verify account now"]);
const c = fingerprint(["Please share the delivery address"]);
assert.ok(a.terms.includes("account"));
assert.ok(a.phrases.includes("account suspended"));
const similar = compareFingerprints(a, b);
assert.ok(similar.score > 0);
assert.ok(similar.sharedTerms.includes("account"));
assert.equal(compareFingerprints(a, c).score < similar.score, true);
assert.equal(compareFingerprints(fingerprint([]), b).score, 0);
assert.equal(fingerprint(Array(200).fill("repeatable message")).terms.length <= 3, true);
console.log("Behavioral similarity checks passed (6 assertions).");
