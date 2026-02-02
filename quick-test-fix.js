// Quick test to verify the fix
const API_URL = 'http://localhost:3000/api/v1/messages';
const API_KEY = 'honeypot_secret_key_2026';

async function testFix() {
    console.log('\n🧪 Testing Fixed Scam Detection Threshold\n');
    console.log('='.repeat(60));

    const testMessages = [
        "Your account will be blocked due to pending KYC",
        "You won ₹50,000 in lottery!",
        "Send your OTP to verify account",
        "Urgent! Pay ₹100 to claim prize"
    ];

    for (const msg of testMessages) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                },
                body: JSON.stringify({
                    sessionId: `fix_test_${Date.now()}`,
                    message: msg,
                    platform: 'test'
                })
            });

            const data = await response.json();

            console.log(`\nMessage: "${msg}"`);
            console.log(`  Is Scam: ${data.isScam ? '✅ YES' : '❌ NO'}`);
            console.log(`  Confidence: ${(data.confidence * 100).toFixed(0)}%`);
            console.log(`  Agent Reply: "${data.reply}"`);
            console.log(`  Reply Type: ${data.reply === 'Thank you for your message.' ? '❌ GENERIC' : '✅ INTELLIGENT'}`);

        } catch (error) {
            console.error(`Error: ${error.message}`);
        }

        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n' + '='.repeat(60));
}

testFix();
