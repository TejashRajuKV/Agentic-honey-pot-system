"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { parseBaseUrl, runSmoke } = require("./smoke-deploy");

async function main() {
    assert.equal(parseBaseUrl("https://example.com"), "https://example.com");
    assert.equal(parseBaseUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
    assert.throws(() => parseBaseUrl("http://example.com"), /require HTTPS/);
    assert.throws(() => parseBaseUrl("https://user:pass@example.com"), /embedded credentials/);
    assert.throws(() => parseBaseUrl("https://example.com/path"), /only the deployment origin/);

    const server = http.createServer((req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.url === "/api/v1/health" && req.method === "GET") {
            res.end(JSON.stringify({ status: "ok", service: "agentic-honeypot", db: "connected" }));
        } else if (req.url === "/" && req.method === "GET") {
            res.end(JSON.stringify({ status: "ok" }));
        } else if (req.url === "/api/v1/messages" && req.method === "GET") {
            res.end(JSON.stringify({ status: "success" }));
        } else if (req.url === "/api/v1/messages" && req.method === "POST") {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Missing API key" }));
        } else if (req.url === "/ping") {
            res.end(JSON.stringify({ status: "ok" }));
        } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ status: "error" }));
        }
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const base = `http://127.0.0.1:${server.address().port}`;
        const result = await runSmoke(base);
        assert.equal(result.failed, 0, JSON.stringify(result.checks));
        assert.equal(result.passed, 6);

        const broken = await runSmoke(base, {
            fetchImpl: async (url, options) => {
                const response = await fetch(url, options);
                if (String(url).endsWith("/api/v1/health")) {
                    return new Response(JSON.stringify({ status: "ok", service: "agentic-honeypot", db: "disconnected" }), {
                        status: 200, headers: { "Content-Type": "application/json" },
                    });
                }
                return response;
            },
        });
        assert.equal(broken.failed, 1, "disconnected database must fail readiness smoke check");
        assert.equal(broken.checks.find((item) => item.name === "MongoDB connectivity").passed, false);
    } finally {
        await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
    console.log("PASS deployment smoke-check tests (URL validation, five endpoint checks, database readiness)");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
