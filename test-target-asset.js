const { detectScamIntent } = require('./detection/scamDetector');

async function testTargetAsset() {
    console.log("🧪 Testing Target Asset Identification...");

    const testCases = [
        {
            text: "Please share the OTP sent to your mobile.",
            expected: "OTP"
        },
        {
            text: "Send money to this UPI ID: example@upi",
            expected: "UPI_PAYMENT"
        },
        {
            text: "I need your bank account number for the transfer.",
            expected: "BANK_ACCOUNT"
        },
        {
            text: "Kindly download the AnyDesk app for support.",
            expected: "DEVICE_ACCESS"
        },
        {
            text: "Hello, how are you?",
            expected: null
        }
    ];

    let passed = 0;

    for (const test of testCases) {
        const result = await detectScamIntent(test.text);

        console.log(`\n📝 Message: "${test.text}"`);
        console.log(`Expected: ${test.expected}`);
        console.log(`Actual:   ${result.targetAsset}`);

        if (result.targetAsset === test.expected) {
            console.log("✅ PASS");
            passed++;
        } else {
            console.log("❌ FAIL");
        }
    }

    console.log(`\nSummary: ${passed}/${testCases.length} Passed`);
}

testTargetAsset();
