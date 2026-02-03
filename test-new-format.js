const http = require('http');

const API_KEY = "honeypot_secret_key_2026";

async function postMessage(data) {
    return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify(data);

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

async function testNewFormat() {
    console.log("Testing NEW evaluation platform format...\n");

    // First message (new format)
    const firstRequest = {
        sessionId: "test-new-format-" + Date.now(),
        message: {
            sender: "scammer",
            text: "Your bank account will be blocked today. Verify immediately.",
            timestamp: Date.now()
        },
        conversationHistory: [],
        metadata: {
            channel: "SMS",
            language: "English",
            locale: "IN"
        }
    };

    console.log("Request 1 (First Message):");
    console.log(JSON.stringify(firstRequest, null, 2));

    const response1 = await postMessage(firstRequest);
    console.log("\nResponse 1:");
    console.log(JSON.stringify(response1, null, 2));

    // Second message (with conversation history)
    const secondRequest = {
        sessionId: firstRequest.sessionId,
        message: {
            sender: "scammer",
            text: "Share your UPI ID to avoid account suspension.",
            timestamp: Date.now()
        },
        conversationHistory: [
            {
                sender: "scammer",
                text: "Your bank account will be blocked today. Verify immediately.",
                timestamp: firstRequest.message.timestamp
            },
            {
                sender: "user",
                text: response1.reply,
                timestamp: Date.now() - 1000
            }
        ],
        metadata: {
            channel: "SMS",
            language: "English",
            locale: "IN"
        }
    };

    console.log("\n\nRequest 2 (Follow-up Message):");
    console.log(JSON.stringify(secondRequest, null, 2));

    const response2 = await postMessage(secondRequest);
    console.log("\nResponse 2:");
    console.log(JSON.stringify(response2, null, 2));

    console.log("\n✅ New format test complete!");
}

testNewFormat().catch(console.error);
