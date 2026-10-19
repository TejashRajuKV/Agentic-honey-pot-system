#!/usr/bin/env node
const assert = require("node:assert/strict");
const { isPublicAddress, validateWebhookUrl } = require("../src/utils/webhookUrlPolicy");

async function main() {
    for (const ip of [
        "0.0.0.0", "10.1.2.3", "100.64.1.1", "127.0.0.1", "169.254.10.20",
        "172.16.0.1", "172.31.255.254", "192.168.1.1", "198.18.0.1", "224.0.0.1",
        "::", "::1", "fc00::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1"
    ]) assert.equal(isPublicAddress(ip), false, `${ip} must not be treated as public`);

    assert.equal(isPublicAddress("8.8.8.8"), true);
    assert.equal(isPublicAddress("1.1.1.1"), true);
    assert.equal(isPublicAddress("2606:4700:4700::1111"), true);

    await assert.rejects(validateWebhookUrl("http://example.com"), /HTTPS/);
    await assert.rejects(validateWebhookUrl("file:///etc/passwd"), /HTTPS/);
    await assert.rejects(validateWebhookUrl("https://user:pass@example.com"), /credentials/);
    await assert.rejects(validateWebhookUrl("https://localhost/hook"), /public hostname/);
    await assert.rejects(validateWebhookUrl("https://127.0.0.1/hook"), /non-public/);
    await assert.rejects(validateWebhookUrl("https://192.168.1.10/hook"), /non-public/);

    await assert.rejects(validateWebhookUrl("https://attacker.example/hook", {
        lookup: async () => [{ address: "10.0.0.5", family: 4 }]
    }), /non-public/);

    const accepted = await validateWebhookUrl("https://hooks.example/hook", {
        lookup: async () => [{ address: "203.0.114.10", family: 4 }]
    });
    assert.equal(accepted.hostname, "hooks.example");

    const allowedHttp = await validateWebhookUrl("http://hooks.example/hook", {
        allowHttp: true,
        lookup: async () => [{ address: "203.0.114.10", family: 4 }]
    });
    assert.equal(allowedHttp.protocol, "http:");

    console.log("PASS webhook URL policy: protocols, credentials, local/private IPs, DNS answers resolving to private addresses");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
