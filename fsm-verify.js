const http = require('http');

const API_URL = "http://localhost:3000/api/v1/messages";
const API_KEY = "honeypot_secret_key_2026";

async function postMessage(sessionId, message) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            sessionId,
            message,
            platform: 'test'
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'x-api-key': API_KEY
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function testFSMLocking() {
    const sessionId = "fsm_test_" + Date.now();
    const testCases = [
        { msg: "click on the link to get reward upto 5000 rupees" },
        { msg: "send me the OTP now" }
    ];

    for (const test of testCases) {
        console.log(`\nUser: ${test.msg}`);
        const data = await postMessage(sessionId, test.msg);
        console.log("Full JSON Response:", JSON.stringify(data, null, 2));
    }
}


testFSMLocking().catch(console.error);

