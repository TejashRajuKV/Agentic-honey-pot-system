// test-bait-strategy.js
/**
 * Bait Strategy Test Suite
 * Tests Level 5 intelligence extraction through strategic baiting
 */

const API_URL = "http://localhost:3000/api/v1/messages";
const API_KEY = "honeypot_secret_key_2026";

// Unit tests for bait strategy functions
function testBaitTriggerLogic() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Bait Trigger Logic`);
    console.log(`${'='.repeat(70)}`);

    const { shouldUseBait } = require('./agent/baitStrategy');

    const tests = [
        {
            name: "MEDIUM risk, early phase, turn 2",
            scamContext: { confidence: 0.5, riskLevel: 'MEDIUM' },
            phase: 'early',
            turnCount: 2,
            expected: true
        },
        {
            name: "MEDIUM risk, late phase, turn 7",
            scamContext: { confidence: 0.5, riskLevel: 'MEDIUM' },
            phase: 'late',
            turnCount: 7,
            expected: false
        },
        {
            name: "LOW risk, early phase, turn 3",
            scamContext: { confidence: 0.3, riskLevel: 'LOW' },
            phase: 'early',
            turnCount: 3,
            expected: true
        },
        {
            name: "HIGH risk, mid phase, turn 4",
            scamContext: { confidence: 0.8, riskLevel: 'HIGH' },
            phase: 'mid',
            turnCount: 4,
            expected: false
        },
        {
            name: "Medium confidence (0.5), early phase, turn 2",
            scamContext: { confidence: 0.5, riskLevel: 'MEDIUM' },
            phase: 'early',
            turnCount: 2,
            expected: true
        },
        {
            name: "Turn 6 - should not bait",
            scamContext: { confidence: 0.5, riskLevel: 'MEDIUM' },
            phase: 'mid',
            turnCount: 6,
            expected: false
        }
    ];

    let passed = 0;
    for (const test of tests) {
        const result = shouldUseBait(test.scamContext, test.phase, test.turnCount);
        const isPass = result === test.expected;
        console.log(`  ${test.name}: ${result ? 'USE BAIT' : 'NO BAIT'} ${isPass ? '✅' : '❌'}`);
        if (isPass) passed++;
    }

    console.log(`\n  Summary: ${passed}/${tests.length} tests passed`);
}

function testBaitResponseGeneration() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Bait Response Generation`);
    console.log(`${'='.repeat(70)}`);

    const { generateBaitResponse } = require('./agent/baitStrategy');

    const scenarios = [
        {
            name: "Banking KYC message",
            message: "Your account will be blocked. Verify KYC now!",
            categories: ['banking'],
            expectedBaitType: 'confusion_play'
        },
        {
            name: "Prize/Lottery message",
            message: "You won ₹50,000! Claim your prize now!",
            categories: ['phishing'],
            expectedBaitType: 'verification_request'
        },
        {
            name: "OTP request",
            message: "Send your OTP to verify account",
            categories: [],
            expectedBaitType: 'hesitation_express'
        },
        {
            name: "Urgency tactics",
            message: "Urgent! Act now or account will expire!",
            categories: [],
            expectedBaitType: 'urgency_question'
        },
        {
            name: "Contact request",
            message: "Share your phone number for verification",
            categories: ['contactRequests'],
            expectedBaitType: 'alternative_channel'
        }
    ];

    for (const scenario of scenarios) {
        const scamContext = { categories: scenario.categories };
        const result = generateBaitResponse(scenario.message, scamContext, 'early');

        console.log(`\n  Scenario: ${scenario.name}`);
        console.log(`  Message: "${scenario.message}"`);
        console.log(`  Bait Type: ${result.baitType}`);
        console.log(`  Response: "${result.response}"`);

        const isExpected = result.baitType === scenario.expectedBaitType;
        console.log(`  Expected Type: ${scenario.expectedBaitType} ${isExpected ? '✅' : '⚠️'}`);
    }
}

function testBaitAnalysis() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Bait Response Analysis`);
    console.log(`${'='.repeat(70)}`);

    const { analyzeBaitResponse } = require('./agent/baitStrategy');

    const tests = [
        {
            name: "Evasive response to verification request",
            scammerResponse: "Just trust me, no need for verification",
            previousBaitType: 'verification_request',
            expectedPatterns: ['avoided_verification', 'deflection']
        },
        {
            name: "Vague explanation to confusion",
            scammerResponse: "Just do it sir please",
            previousBaitType: 'confusion_play',
            expectedPatterns: ['vague_explanation']
        },
        {
            name: "Escalated urgency",
            scammerResponse: "Urgent! Do it now immediately today quickly!",
            previousBaitType: 'urgency_question',
            expectedPatterns: ['escalated_urgency']
        },
        {
            name: "Revealed contact info",
            scammerResponse: "Call 9876543210 or send to scam@paytm",
            previousBaitType: 'hesitation_express',
            expectedPatterns: ['revealed_contact_info']
        },
        {
            name: "Authority claim",
            scammerResponse: "I am from bank manager office government authorized",
            previousBaitType: 'confusion_play',
            expectedPatterns: ['authority_claim']
        }
    ];

    for (const test of tests) {
        const analysis = analyzeBaitResponse(test.scammerResponse, test.previousBaitType);

        console.log(`\n  Test: ${test.name}`);
        console.log(`  Response: "${test.scammerResponse}"`);
        console.log(`  Previous Bait: ${test.previousBaitType}`);
        console.log(`  Analysis:`);
        console.log(`    - Evasion Score: ${analysis.evasionScore.toFixed(2)}`);
        console.log(`    - Urgency Push Score: ${analysis.urgencyPushScore.toFixed(2)}`);
        console.log(`    - Reveal Score: ${analysis.revealScore.toFixed(2)}`);
        console.log(`    - Total Suspicion Increase: ${analysis.totalSuspicionIncrease.toFixed(2)}`);
        console.log(`    - Patterns: ${analysis.patterns.join(', ') || 'none'}`);
        console.log(`    - Triggered Reveal: ${analysis.triggeredReveal ? 'YES ✅' : 'NO'}`);

        // Check if expected patterns are found
        const foundExpected = test.expectedPatterns.some(p => analysis.patterns.includes(p));
        console.log(`  Expected Patterns Found: ${foundExpected ? '✅' : '⚠️'}`);
    }
}

function testAdaptiveFollowUp() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Adaptive Follow-Up Logic`);
    console.log(`${'='.repeat(70)}`);

    const { getAdaptiveFollowUp } = require('./agent/baitStrategy');

    const tests = [
        {
            name: "High evasion - press harder",
            baitAnalysis: {
                evasionScore: 0.5,
                urgencyPushScore: 0.1,
                patterns: ['avoided_verification', 'deflection']
            },
            turnCount: 3,
            expectFollowUp: true
        },
        {
            name: "High urgency push - express hesitation",
            baitAnalysis: {
                evasionScore: 0.1,
                urgencyPushScore: 0.4,
                patterns: ['escalated_urgency']
            },
            turnCount: 3,
            expectFollowUp: true
        },
        {
            name: "Authority claim - ask for credentials",
            baitAnalysis: {
                evasionScore: 0.2,
                urgencyPushScore: 0.1,
                patterns: ['authority_claim']
            },
            turnCount: 2,
            expectFollowUp: true
        },
        {
            name: "Turn 5 - stop baiting",
            baitAnalysis: {
                evasionScore: 0.2,
                urgencyPushScore: 0.1,
                patterns: []
            },
            turnCount: 5,
            expectFollowUp: false
        },
        {
            name: "Deflection pattern - question them",
            baitAnalysis: {
                evasionScore: 0.3,
                urgencyPushScore: 0.1,
                patterns: ['deflection']
            },
            turnCount: 2,
            expectFollowUp: true
        }
    ];

    for (const test of tests) {
        const followUp = getAdaptiveFollowUp(test.baitAnalysis, test.turnCount);
        const hasFollowUp = followUp !== null;

        console.log(`\n  Test: ${test.name}`);
        console.log(`  Patterns: ${test.baitAnalysis.patterns.join(', ') || 'none'}`);
        console.log(`  Follow-Up: ${hasFollowUp ? `"${followUp}"` : 'NONE'}`);

        const isExpected = hasFollowUp === test.expectFollowUp;
        console.log(`  Expected: ${test.expectFollowUp ? 'Follow-up' : 'No follow-up'} ${isExpected ? '✅' : '❌'}`);
    }
}

async function testBaitStrategyIntegration() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎯 Testing Bait Strategy Integration (Live API)`);
    console.log(`${'='.repeat(70)}`);

    const scenarios = [
        {
            name: "Banking Scam - Bait with Confusion",
            sessionId: "bait_test_banking",
            turns: [
                "Your account will be blocked due to KYC",
                "Yes, verify immediately",
                "Send OTP to confirm"
            ]
        },
        {
            name: "Prize Scam - Request Verification",
            sessionId: "bait_test_prize",
            turns: [
                "You won ₹50,000 in lottery!",
                "Pay ₹100 to claim prize",
                "Send to winner@paytm now"
            ]
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n  Scenario: ${scenario.name}`);
        console.log(`  ${'─'.repeat(68)}`);

        for (let i = 0; i < scenario.turns.length; i++) {
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': API_KEY
                    },
                    body: JSON.stringify({
                        sessionId: scenario.sessionId,
                        message: scenario.turns[i],
                        platform: 'test'
                    })
                });

                const data = await response.json();

                console.log(`\n  Turn ${i + 1}:`);
                console.log(`    User: "${scenario.turns[i]}"`);
                console.log(`    Agent: "${data.reply}"`);
                console.log(`    Confidence: ${(data.confidence * 100).toFixed(0)}%`);

                // Check if response shows bait characteristics
                const looksLikeBait =
                    /confused|don't understand|clarify|why|how|sure|proof|verify|official/i.test(data.reply);

                if (looksLikeBait && i < 3) {
                    console.log(`    Bait Detected: ✅ (shows confusion/questioning)`);
                } else if (i >= 3) {
                    console.log(`    Post-Bait Phase: ✅ (moving to compliance)`);
                }

                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`    ❌ Error: ${error.message}`);
            }
        }
    }
}

async function runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('🎣 BAIT STRATEGY TEST SUITE');
    console.log('='.repeat(70));

    // Unit tests
    testBaitTriggerLogic();
    testBaitResponseGeneration();
    testBaitAnalysis();
    testAdaptiveFollowUp();

    // Integration test (requires server)
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📡 Integration Tests (requires server running)`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\nAPI Endpoint: ${API_URL}`);
    console.log('Make sure server is running: npm run dev\n');

    try {
        await testBaitStrategyIntegration();
    } catch (error) {
        console.log(`\n⚠️  Integration tests skipped (server not running)`);
        console.log(`   Error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL BAIT STRATEGY TESTS COMPLETED');
    console.log('='.repeat(70) + '\n');
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    console.error('❌ Error: fetch is not available.');
    console.error('Please use Node.js 18+ or install node-fetch.');
    process.exit(1);
}

runAllTests().catch(console.error);
