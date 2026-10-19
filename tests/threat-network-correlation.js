#!/usr/bin/env node
const assert = require("node:assert/strict");
const threatIntel = require("../src/services/threatIntelService");

const profile = (identifiers = {}) => ({ identifiers });
const a = profile({
    upiIds: ["fraud@upi", "shared@upi"],
    phoneNumbers: ["+919876543210"],
    urls: ["https://fake-bank.example/login", "https://shared.example"]
});
const b = profile({
    upiIds: ["shared@upi"],
    phoneNumbers: ["+919876543210", "+911234567890"],
    urls: ["https://shared.example", "https://other.example"]
});

assert.deepEqual(threatIntel._findSharedIdentifiers(a, b), [
    { type: "upi", value: "shared@upi" },
    { type: "phone", value: "+919876543210" },
    { type: "url", value: "https://shared.example" }
], "should return shared UPI, phone, and URL indicators");

assert.deepEqual(threatIntel._findSharedIdentifiers(profile(), profile()), [],
    "profiles with missing identifier fields should safely produce no links");

assert.deepEqual(threatIntel._findSharedIdentifiers(
    profile({ urls: ["https://one.example"] }),
    profile({ urls: ["https://two.example"] })
), [], "unshared URLs should not create a relationship");

console.log("PASS threat-network correlation: UPI, phone, URL, and missing-field cases");
