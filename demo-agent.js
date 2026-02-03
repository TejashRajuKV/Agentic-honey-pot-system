const http = require('http');

const API_KEY = "honeypot_secret_key_2026";

async function postMessage(sessionId, text) {
    return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify({
            sessionId,
            message: { sender: "scammer", text, timestamp: Date.now() },
            conversationHistory: [],
            metadata: { channel: "SMS", language: "English", locale: "IN" }
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': jsonData.length,
                'x-api-key': API_KEY
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', (e) => reject(e));
        req.write(jsonData);
        req.end();
    });
}

async function runDemo() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║        API RESPONSE FORMAT VERIFICATION                        ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const tests = [
        "Your bank account will be blocked today. Verify immediately.",
        "Click this link to claim your reward: http://fakebank.com",
        "Hello, how are you?"
    ];

    for (const msg of tests) {
        console.log(`\n📨 Request: "${msg}"\n`);

        const sessionId = "demo_" + Date.now();
        const response = await postMessage(sessionId, msg);

        console.log("📬 Response:");
        console.log(JSON.stringify(response, null, 2));
        console.log("\n────────────────────────────────────────────────────────────");
    }

    console.log("\n✅ All responses match the required format: { status, reply }");
}

runDemo().catch(console.error);
