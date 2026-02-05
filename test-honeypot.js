// test-honeypot.js
/**
 * Simple test script to verify the honeypot system
 * Run: node test-honeypot.js
 */

const API_URL = "http://localhost:3000/api/v1/messages";
const API_KEY = "honeypot_secret_key_2026";

// Test scenarios
const testScenarios = [
    {
        name: "Banking Fraud - KYC Scam",
        payload: {
            sessionId: "test_banking_001",
            message: "Your account will be blocked due to pending KYC verification. Verify immediately to avoid suspension.",
            platform: "sms"
        }
    },
    {
        name: "UPI Fraud",
        payload: {
            sessionId: "test_upi_001",
            message: "Your UPI will be blocked. Send OTP to verify. Contact: fraud@paytm",
            platform: "whatsapp"
        }
    },
    {
        name: "Phishing - Lottery",
        payload: {
            sessionId: "test_phishing_001",
            message: "Congratulations! You won ₹50,000 in our lottery. Click here to claim: http://fake-lottery.com",
            platform: "telegram"
        }
    },
    {
        name: "Fake Offer",
        payload: {
            sessionId: "test_offer_001",
            message: "Limited time offer! Earn ₹10,000 daily working from home. Guaranteed returns. Call 9876543210 now!",
            platform: "sms"
        }
    },
    {
        name: "Normal Message (Not a Scam)",
        payload: {
            sessionId: "test_normal_001",
            message: "Hello, I hope you are doing well today!",
            platform: "whatsapp"
        }
    }
];

async function testAPI(scenario) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify(scenario.payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        console.log(`\n${'='.repeat(70)}`);
        console.log(`TEST: ${scenario.name}`);
        console.log(`${'='.repeat(70)}`);
        console.log(`📨 User Message: "${scenario.payload.message}"`);
        console.log(`\n🤖 Agent Reply: "${data.reply}"`);
        console.log(`\n📊 Detection Results:`);
        console.log(`   - Scam Detected: ${data.scamDetected ? '🚨 YES' : '✅ NO'}`);
        console.log(`   - Probability: ${data.scamProbability}%`);
        console.log(`   - Phase: ${data.phase}`);
        console.log(`   - Patterns: ${data.patterns?.join(', ') || 'none'}`);
        console.log(`   - Status: ${data.status}`);

    } catch (error) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`❌ TEST FAILED: ${scenario.name}`);
        console.log(`${'='.repeat(70)}`);
        console.log(`Error: ${error.message}`);
    }
}

async function runTests() {
    console.log('\n🐝 HONEYPOT SYSTEM - TEST SUITE');
    console.log('================================\n');
    console.log('Testing API endpoint:', API_URL);
    console.log('Make sure the server is running with: npm run dev\n');

    // Add a small delay to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    for (const scenario of testScenarios) {
        await testAPI(scenario);
        // Wait between tests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ ALL TESTS COMPLETED');
    console.log(`${'='.repeat(70)}\n`);
}

// Check if fetch is available (Node.js 18+ or polyfill)
if (typeof fetch === 'undefined') {
    console.error('❌ Error: fetch is not available.');
    console.error('Please use Node.js 18+ or install node-fetch.');
    console.error('Run: npm install node-fetch');
    process.exit(1);
}

runTests().catch(console.error);
