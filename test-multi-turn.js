// test-multi-turn.js
/**
 * Multi-Turn Conversation Test Suite
 * Tests agent behavior evolution through conversation phases
 */

const API_URL = "http://localhost:3000/api/v1/messages";
const API_KEY = "honeypot_secret_key_2026";

// Test scenarios for multi-turn conversations
const multiTurnScenarios = [
    {
        name: "Banking Scam - Phase Evolution",
        turns: [
            { msg: "Your account will be blocked due to pending KYC", expectedPhase: "early" },
            { msg: "Verify immediately to avoid suspension", expectedPhase: "early" },
            { msg: "Click this link to update KYC details", expectedPhase: "mid" },
            { msg: "Do it now before account closes", expectedPhase: "mid" },
            { msg: "Send your OTP to verify", expectedPhase: "mid" },
            { msg: "Urgent! Last chance to verify", expectedPhase: "late" },
            { msg: "Your account will be permanently blocked", expectedPhase: "late" },
            { msg: "Send the OTP code immediately", expectedPhase: "late" },
            { msg: "Why are you not responding?", expectedPhase: "final" },
            { msg: "This is your final warning", expectedPhase: "final" }
        ]
    },
    {
        name: "Prize Scam - Intelligence Extraction",
        turns: [
            { msg: "Congratulations! You won ₹50,000", expectedPhase: "early" },
            { msg: "To claim prize, pay ₹100 processing fee", expectedPhase: "early" },
            { msg: "Send to winner@paytm", expectedPhase: "mid" },
            { msg: "Hurry, offer expires today", expectedPhase: "mid" },
            { msg: "Just send ₹100 now", expectedPhase: "mid" },
            { msg: "Your prize will be cancelled", expectedPhase: "late" }
        ]
    },
    {
        name: "Wrap-Up After 10 Turns",
        turns: Array(12).fill({ msg: "Send OTP now", expectedPhase: null })
    },
    {
        name: "Intelligent Wrap-Up with Intel",
        turns: [
            { msg: "Your UPI is blocked", expectedPhase: "early" },
            { msg: "Send money to verify@paytm", expectedPhase: "early" },
            { msg: "Call 9876543210 for help", expectedPhase: "mid" },
            { msg: "Visit http://fake-bank.com", expectedPhase: "mid" },
            { msg: "Send OTP to confirm", expectedPhase: "mid" },
            { msg: "Do it now", expectedPhase: "late" }
        ]
    }
];

async function testMultiTurnConversation(scenario) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎯 Testing: ${scenario.name}`);
    console.log(`${'='.repeat(70)}`);

    const sessionId = `multiturn_${scenario.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
    let previousPhase = null;
    let phaseTransitions = [];
    let wrappedUp = false;

    for (let i = 0; i < scenario.turns.length; i++) {
        const turn = scenario.turns[i];

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    message: turn.msg,
                    platform: 'test'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            console.log(`\nTurn ${i + 1}:`);
            console.log(`  User: "${turn.msg}"`);
            console.log(`  Agent: "${data.reply}"`);
            console.log(`  Phase: ${data.engagementPhase}`);
            console.log(`  Status: ${data.status}`);
            console.log(`  Scam Detected: ${data.isScam ? '🚨 YES' : '✅ NO'} (${(data.confidence * 100).toFixed(0)}%)`);

            // Track phase transitions
            if (previousPhase !== data.engagementPhase) {
                phaseTransitions.push({
                    turn: i + 1,
                    from: previousPhase,
                    to: data.engagementPhase
                });
                console.log(`  ⚡ Phase Transition: ${previousPhase || 'start'} → ${data.engagementPhase}`);
            }

            // Check if expected phase matches
            if (turn.expectedPhase && turn.expectedPhase !== data.engagementPhase) {
                console.log(`  ⚠️  Expected phase: ${turn.expectedPhase}, Got: ${data.engagementPhase}`);
            }

            // Check for wrap-up
            if (data.status === 'terminated') {
                wrappedUp = true;
                console.log(`  🏁 Conversation wrapped up after ${i + 1} turns`);
            }

            // Track extracted intelligence
            if (data.debug && data.debug.extractedIntel) {
                const intel = data.debug.extractedIntel;
                const hasIntel = intel.upiIds.length > 0 || intel.phoneNumbers.length > 0 || intel.urls.length > 0;
                if (hasIntel) {
                    console.log(`  📊 Intel Extracted:`);
                    if (intel.upiIds.length > 0) console.log(`     - UPI IDs: ${intel.upiIds.join(', ')}`);
                    if (intel.phoneNumbers.length > 0) console.log(`     - Phone Numbers: ${intel.phoneNumbers.join(', ')}`);
                    if (intel.urls.length > 0) console.log(`     - URLs: ${intel.urls.join(', ')}`);
                }
            }

            previousPhase = data.engagementPhase;

            // Stop if conversation terminated
            if (wrappedUp) {
                break;
            }

            // Small delay between turns
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error(`\n❌ Error on turn ${i + 1}: ${error.message}`);
            break;
        }
    }

    // Summary
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📊 Summary for ${scenario.name}:`);
    console.log(`  Total Turns: ${scenario.turns.length}`);
    console.log(`  Phase Transitions: ${phaseTransitions.length}`);
    phaseTransitions.forEach(t => {
        console.log(`    - Turn ${t.turn}: ${t.from || 'start'} → ${t.to}`);
    });
    console.log(`  Wrapped Up: ${wrappedUp ? '✅ YES' : '❌ NO'}`);
    console.log(`${'─'.repeat(70)}`);
}

async function testPhaseTransitionLogic() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Phase Transition Logic`);
    console.log(`${'='.repeat(70)}`);

    const { getConversationPhase } = require('./agent/agentStateMachine');

    const tests = [
        { turnCount: 1, expected: 'early' },
        { turnCount: 2, expected: 'early' },
        { turnCount: 3, expected: 'mid' },
        { turnCount: 5, expected: 'mid' },
        { turnCount: 6, expected: 'late' },
        { turnCount: 8, expected: 'late' },
        { turnCount: 9, expected: 'final' },
        { turnCount: 10, expected: 'final' }
    ];

    for (const test of tests) {
        const result = getConversationPhase(test.turnCount);
        const passed = result === test.expected;
        console.log(`  Turn ${test.turnCount}: ${result} ${passed ? '✅' : '❌ (expected: ' + test.expected + ')'}`);
    }
}

async function testWrapUpLogic() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Wrap-Up Logic`);
    console.log(`${'='.repeat(70)}`);

    const { shouldWrapUp } = require('./agent/agentStateMachine');

    const tests = [
        {
            name: "After 10 turns",
            turnCount: 10,
            extractedIntel: {},
            expected: true
        },
        {
            name: "Turn 5 with no intel",
            turnCount: 5,
            extractedIntel: {},
            expected: false
        },
        {
            name: "Turn 6 with UPI intel",
            turnCount: 6,
            extractedIntel: { upiIds: ['scam@paytm'], phoneNumbers: [], urls: [] },
            expected: true
        },
        {
            name: "Turn 7 with phone intel",
            turnCount: 7,
            extractedIntel: { upiIds: [], phoneNumbers: ['9876543210'], urls: [] },
            expected: true
        },
        {
            name: "Turn 5 with multiple URLs",
            turnCount: 5,
            extractedIntel: { upiIds: [], phoneNumbers: [], urls: ['http://fake1.com', 'http://fake2.com'] },
            expected: false // Needs >1 URL but turn count < 6
        }
    ];

    for (const test of tests) {
        const result = shouldWrapUp(test.turnCount, test.extractedIntel);
        const passed = result === test.expected;
        console.log(`  ${test.name}: ${result ? 'WRAP UP' : 'CONTINUE'} ${passed ? '✅' : '❌'}`);
    }
}

async function runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('🎯 MULTI-TURN CONVERSATION TEST SUITE');
    console.log('='.repeat(70));
    console.log(`\nAPI Endpoint: ${API_URL}`);
    console.log('Make sure server is running: npm run dev\n');

    // Test 1: Phase transition logic (unit test)
    await testPhaseTransitionLogic();

    // Test 2: Wrap-up logic (unit test)
    await testWrapUpLogic();

    // Test 3: Multi-turn conversations (integration test)
    for (const scenario of multiTurnScenarios) {
        await testMultiTurnConversation(scenario);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL MULTI-TURN TESTS COMPLETED');
    console.log('='.repeat(70) + '\n');
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    console.error('❌ Error: fetch is not available.');
    console.error('Please use Node.js 18+ or install node-fetch.');
    process.exit(1);
}

runAllTests().catch(console.error);
