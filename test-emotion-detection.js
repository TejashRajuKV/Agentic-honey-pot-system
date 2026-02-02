// test-emotion-detection.js
// Test suite for Emotion Handling Layer

const API_URL = 'http://localhost:3000/api/v1/messages';
const API_KEY = 'test_secret_key_12345';

const EMOTION_TEST_SCENARIOS = [
    {
        name: 'Angry Emotion',
        messages: [
            { text: 'Useless person!', expectedEmotion: 'angry' },
            { text: 'You are wasting my time!', expectedEmotion: 'angry' },
            { text: 'This is nonsense!', expectedEmotion: 'angry' }
        ]
    },
    {
        name: 'Confused Emotion',
        messages: [
            { text: 'I don\'t understand what you mean', expectedEmotion: 'confused' },
            { text: 'What is this about?', expectedEmotion: 'confused' },
            { text: 'Can you explain that again?', expectedEmotion: 'confused' }
        ]
    },
    {
        name: 'Fear Emotion',
        messages: [
            { text: 'Your account will be blocked!', expectedEmotion: 'fear' },
            { text: 'Legal action will be taken against you', expectedEmotion: 'fear' },
            { text: 'Police complaint has been filed', expectedEmotion: 'fear' }
        ]
    },
    {
        name: 'Urgent Emotion',
        messages: [
            { text: 'Do this immediately!', expectedEmotion: 'urgent' },
            { text: 'Last chance to save your account', expectedEmotion: 'urgent' },
            { text: 'Act now or lose everything', expectedEmotion: 'urgent' }
        ]
    },
    {
        name: 'Excited Emotion',
        messages: [
            { text: 'Congratulations! You won a prize!', expectedEmotion: 'excited' },
            { text: 'You have been selected for a reward', expectedEmotion: 'excited' },
            { text: 'Claim your free gift now', expectedEmotion: 'excited' }
        ]
    },
    {
        name: 'Trusting Emotion',
        messages: [
            { text: 'Yes sir, I will do as you say', expectedEmotion: 'trusting' },
            { text: 'Thank you for helping me', expectedEmotion: 'trusting' },
            { text: 'Please guide me, I trust you', expectedEmotion: 'trusting' }
        ]
    },
    {
        name: 'Hesitant Emotion',
        messages: [
            { text: 'I\'m not sure about this', expectedEmotion: 'hesitant' },
            { text: 'This seems suspicious to me', expectedEmotion: 'hesitant' },
            { text: 'Wait, something doesn\'t feel right', expectedEmotion: 'hesitant' }
        ]
    },
    {
        name: 'Neutral Emotion',
        messages: [
            { text: 'Hello', expectedEmotion: 'neutral' },
            { text: 'How are you?', expectedEmotion: 'neutral' },
            { text: 'Good morning', expectedEmotion: 'neutral' }
        ]
    }
];

/**
 * Send message to API
 */
async function sendMessage(sessionId, message) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        },
        body: JSON.stringify({
            sessionId,
            message,
            platform: 'test',
            sender: 'emotion-tester'
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

/**
 * Test a single scenario
 */
async function testScenario(scenario) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Testing: ${scenario.name}`);
    console.log(`${'='.repeat(80)}\n`);

    const sessionId = `emotion-test-${scenario.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    let passed = 0;
    let failed = 0;

    for (const messageTest of scenario.messages) {
        const { text, expectedEmotion } = messageTest;

        try {
            console.log(`  Message: "${text}"`);
            const data = await sendMessage(sessionId, text);

            // Check emotion in debug data
            const detectedEmotion = data.debug?.emotion?.detected || 'unknown';
            const intensity = data.debug?.emotion?.intensity || 0;
            const agentReply = data.reply;

            console.log(`  Expected Emotion: ${expectedEmotion}`);
            console.log(`  Detected Emotion: ${detectedEmotion} (intensity: ${intensity.toFixed(2)})`);
            console.log(`  Agent Reply: "${agentReply}"`);

            if (detectedEmotion === expectedEmotion) {
                console.log(`  ✅ PASSED\n`);
                passed++;
            } else {
                console.log(`  ❌ FAILED - Expected '${expectedEmotion}', got '${detectedEmotion}'\n`);
                failed++;
            }

        } catch (error) {
            console.log(`  ❌ ERROR: ${error.message}\n`);
            failed++;
        }

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n  📊 Scenario Results:`);
    console.log(`    Passed: ${passed}/${scenario.messages.length}`);
    console.log(`    Failed: ${failed}/${scenario.messages.length}`);
    console.log(`    Success Rate: ${((passed / scenario.messages.length) * 100).toFixed(1)}%\n`);

    return { passed, failed };
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('\n');
    console.log('='.repeat(80));
    console.log('🎯 EMOTION HANDLING LAYER - TEST SUITE');
    console.log('='.repeat(80));
    console.log(`\nAPI Endpoint: ${API_URL}`);
    console.log(`Testing ${EMOTION_TEST_SCENARIOS.length} emotion categories\n`);

    let totalPassed = 0;
    let totalFailed = 0;

    for (const scenario of EMOTION_TEST_SCENARIOS) {
        const result = await testScenario(scenario);
        totalPassed += result.passed;
        totalFailed += result.failed;

        // Delay between scenarios
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Final summary
    console.log('\n');
    console.log('='.repeat(80));
    console.log('📊 FINAL TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n  Total Tests: ${totalPassed + totalFailed}`);
    console.log(`  ✅ Passed: ${totalPassed}`);
    console.log(`  ❌ Failed: ${totalFailed}`);
    console.log(`  Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%\n`);

    const allPassed = totalFailed === 0;
    if (allPassed) {
        console.log('  🎉 ALL TESTS PASSED! Emotion layer is working correctly.\n');
    } else {
        console.log('  ⚠️  Some tests failed. Review the results above.\n');
    }

    console.log('='.repeat(80));
    console.log('✅ EMOTION LAYER TESTS COMPLETED');
    console.log('='.repeat(80));
}

// Run tests
runAllTests().catch(error => {
    console.error('\n❌ Test runner error:', error);
    process.exit(1);
});
