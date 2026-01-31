// comprehensive-test.js
/**
 * Comprehensive scam detection test suite
 * Tests all scam categories and edge cases
 */

const API_URL = "http://localhost:3000/api/v1/messages";
const API_KEY = "honeypot_secret_key_2026";

const testScenarios = [
    {
        category: "Banking Fraud - KYC",
        messages: [
            "Your account will be blocked due to pending KYC verification",
            "Urgent: Update your KYC details immediately",
            "Your UPI has been suspended. Verify now",
            "Account freeze notice - verify your identity"
        ]
    },
    {
        category: "Banking Fraud - OTP",
        messages: [
            "Send OTP to verify your account",
            "Confirm the OTP code to unlock",
            "Enter your ATM PIN to complete verification",
            "Share the CVV for security check"
        ]
    },
    {
        category: "UPI Fraud",
        messages: [
            "Send money to verify@paytm to unlock account",
            "Payment of ₹1 required to activate your UPI",
            "Transfer to scammer@phonepe for verification",
            "Pay ₹100 processing fee to fraud@gpay"
        ]
    },
    {
        category: "Lottery/Prize Scams",
        messages: [
            "Congratulations! You won lottery of ₹50,000",
            "You have won a brand new car!",
            "Lucky winner! You won an iPhone 15 Pro",
            "You have been selected for ₹1 lakh cash prize",
            "Claim your prize now - you won ₹25,000"
        ]
    },
    {
        category: "Phishing Links",
        messages: [
            "Click this link to claim: http://fake-lottery.com",
            "Verify your account here: http://scam-bank.xyz",
            "Update KYC: http://fake-kyc-verify.com",
            "Claim reward at: http://prize-claim.scam"
        ]
    },
    {
        category: "Fake Offers",
        messages: [
            "Work from home and earn ₹10,000 daily",
            "Guaranteed returns! Double your money in 7 days",
            "Limited offer: Free iPhone for first 100 people",
            "Instant loan approved - ₹50,000 in 10 minutes"
        ]
    },
    {
        category: "Urgency Tactics",
        messages: [
            "Urgent action required! Account expires in 1 hour",
            "Last chance to claim your prize - expires today",
            "Act now or lose access to your account",
            "Immediate verification needed - account at risk"
        ]
    },
    {
        category: "Contact Requests",
        messages: [
            "Send your bank details for verification",
            "Share your phone number to claim prize",
            "Call back on 9876543210 immediately",
            "WhatsApp us your details for processing"
        ]
    },
    {
        category: "Normal Messages (Should NOT Detect)",
        messages: [
            "Hello, how are you today?",
            "Thank you for your help",
            "What's the weather like?",
            "Good morning, have a nice day"
        ]
    }
];

async function runTest(message, category, index) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify({
                sessionId: `test_${category.replace(/[^a-z0-9]/gi, '_')}_${index}`,
                message: message,
                platform: 'test-suite'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        const isScam = data.isScam;
        const confidence = (data.confidence * 100).toFixed(0);
        const status = isScam ? '🚨 SCAM' : '✅ SAFE';
        const icon = isScam ? '⚠️' : '✓';

        console.log(`\n${icon} Message: "${message}"`);
        console.log(`   Detection: ${status} (${confidence}% confidence)`);
        console.log(`   Agent: "${data.reply}"`);

        if (data.debug && data.debug.detectedCategories.length > 0) {
            console.log(`   Categories: ${data.debug.detectedCategories.join(', ')}`);
        }

        return { isScam, confidence: parseFloat(confidence) };
    } catch (error) {
        console.error(`\n❌ Error testing: ${error.message}`);
        return { isScam: false, confidence: 0 };
    }
}

async function runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('🐝 COMPREHENSIVE HONEYPOT DETECTION TEST SUITE');
    console.log('='.repeat(70));
    console.log(`\nAPI Endpoint: ${API_URL}`);
    console.log('Make sure server is running: npm run dev\n');

    let totalTests = 0;
    let scamsDetected = 0;
    let normalMessagesCorrect = 0;

    for (const scenario of testScenarios) {
        console.log('\n' + '='.repeat(70));
        console.log(`📋 Testing: ${scenario.category}`);
        console.log('='.repeat(70));

        for (let i = 0; i < scenario.messages.length; i++) {
            const msg = scenario.messages[i];
            const result = await runTest(msg, scenario.category, i);

            totalTests++;

            if (scenario.category.includes("Normal")) {
                if (!result.isScam) normalMessagesCorrect++;
            } else {
                if (result.isScam) scamsDetected++;
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Scams Detected: ${scamsDetected}/${totalTests - 4}`);
    console.log(`Normal Messages Handled Correctly: ${normalMessagesCorrect}/4`);
    console.log(`\nDetection Rate: ${((scamsDetected / (totalTests - 4)) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    console.error('❌ Error: fetch is not available.');
    console.error('Please use Node.js 18+ or install node-fetch.');
    process.exit(1);
}

runAllTests().catch(console.error);
