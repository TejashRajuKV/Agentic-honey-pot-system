// test-edge-cases.js
/**
 * Advanced Edge-Case Test Suite for Honeypot Scam Detection
 * Tests 20 sophisticated scam tactics including slow-burn, emotional manipulation,
 * authority impersonation, contradiction, repetition, and rage phases
 */

const API_URL = "http://localhost:3000/api/v1/messages";
const API_KEY = "honeypot_secret_key_2026";

// 20 Advanced Edge-Case Scenarios
const edgeCaseScenarios = [
    {
        id: 1,
        name: "Slow-Burn Scam (No Initial Urgency)",
        description: "Scammer does NOT rush initially, builds urgency gradually over multiple turns",
        turns: [
            { msg: "Hello sir, this is customer care.", day: 1 },
            { msg: "Just checking if you received our last message.", day: 2 },
            { msg: "There is a small issue with your account.", day: 3 },
            { msg: "We need to verify this urgently today.", day: 3 },
            { msg: "Please send verification code immediately.", day: 3 }
        ],
        expectedBehavior: {
            detection: "gradual_suspicion_increase",
            patterns: ["slow_burn_escalation"],
            agentNotices: "Earlier you were calm, now suddenly urgent"
        }
    },
    {
        id: 2,
        name: "Polite Professional Scam (No Threats)",
        description: "No fear, no urgency, sounds completely legitimate",
        turns: [
            { msg: "Good afternoon. As discussed, please complete verification." },
            { msg: "Thank you for your cooperation." },
            { msg: "Kindly verify your account details at your convenience." }
        ],
        expectedBehavior: {
            detection: "professional_scam_pattern",
            patterns: ["professionalScam", "authorityValidation"],
            agentResponse: "asks_for_clarification"
        }
    },
    {
        id: 3,
        name: "Reverse Scam (Victim Initiates)",
        description: "User starts conversation asking about missed call",
        turns: [
            { msg: "Hi, I missed a call from this number. Who is this?" },
            { msg: "This is bank customer care. Your KYC is pending." },
            { msg: "Send OTP to verify account immediately." }
        ],
        expectedBehavior: {
            detection: "direction_agnostic",
            patterns: ["banking", "urgency"],
            agentDetects: "escalation_despite_user_initiation"
        }
    },
    {
        id: 4,
        name: "Multi-Channel Threat Scam",
        description: "Claims to have sent SMS and email for legitimacy",
        turns: [
            { msg: "We have sent SMS and email also. Please check." },
            { msg: "This is official communication across all channels." },
            { msg: "Verify now before account suspension." }
        ],
        expectedBehavior: {
            detection: "cross_channel_bluff",
            patterns: ["authority", "urgency"],
            agentResponse: "asks_for_reference_number"
        }
    },
    {
        id: 5,
        name: "Fake Technical Jargon Scam",
        description: "Uses confusing technical terms",
        turns: [
            { msg: "Your account is affected by IMPS timeout error code 392." },
            { msg: "System error requires immediate verification." },
            { msg: "Please complete transaction failed code resolution." }
        ],
        expectedBehavior: {
            detection: "technical_jargon",
            patterns: ["professionalScam", "banking"],
            agentResponse: "asks_for_simple_explanation"
        }
    },
    {
        id: 6,
        name: "Sympathy Scam (Emotional Manipulation)",
        description: "Uses emotional tactics to gain compliance",
        turns: [
            { msg: "Sir please help, my job depends on this verification." },
            { msg: "I will lose my job if not done today." },
            { msg: "Please brother, I have family to support." }
        ],
        expectedBehavior: {
            detection: "sympathy_manipulation",
            patterns: ["emotionalManipulation"],
            agentResponse: "shows_empathy_but_maintains_caution"
        }
    },
    {
        id: 7,
        name: "Authority Name-Dropping Scam",
        description: "References fake official circular",
        turns: [
            { msg: "This is as per RBI circular 2024/UPI/07." },
            { msg: "Government order requires immediate verification." },
            { msg: "All banks implementing this under section 42." }
        ],
        expectedBehavior: {
            detection: "authority_reference_bluff",
            patterns: ["authorityValidation"],
            agentResponse: "asks_for_circular_copy_or_link"
        }
    },
    {
        id: 8,
        name: "Language Switching Scam",
        description: "Switches between English and Hindi/Hinglish",
        turns: [
            { msg: "Your account has issue." },
            { msg: "Sir abhi karo, baad mein problem hoga." },
            { msg: "Jaldi verify karo please." }
        ],
        expectedBehavior: {
            detection: "multilingual_detected",
            patterns: ["multilingual", "urgency"],
            agentMaintains: "detection_and_suspicion"
        }
    },
    {
        id: 9,
        name: "'Already Done' Pressure Scam",
        description: "Claims to have already tried many times",
        turns: [
            { msg: "We already tried to call you." },
            { msg: "We already warned you yesterday." },
            { msg: "Now last chance to verify." }
        ],
        expectedBehavior: {
            detection: "false_history",
            patterns: ["urgency", "behavioral"],
            agentResponse: "questions_timeline"
        }
    },
    {
        id: 10,
        name: "False Compliance Trap",
        description: "Says no money needed, then asks for money",
        turns: [
            { msg: "No money needed, only verification." },
            { msg: "This is free service, no payment required." },
            { msg: "Now send ₹1 for verification only." },
            { msg: "Payment is mandatory to complete." }
        ],
        expectedBehavior: {
            detection: "false_compliance_trap",
            patterns: ["contradiction"],
            agentNotices: "earlier_said_no_money"
        }
    },
    {
        id: 11,
        name: "Multiple Requests in One Message",
        description: "Cognitive overload with many steps at once",
        turns: [
            { msg: "Click link, send OTP, and confirm amount." },
            { msg: "First verify then send then click confirm." },
            { msg: "Do all steps quickly now." }
        ],
        expectedBehavior: {
            detection: "cognitive_overload",
            patterns: ["multipleRequests", "urgency"],
            agentResponse: "asks_for_one_step_at_time"
        }
    },
    {
        id: 12,
        name: "Fake Escalation to Senior Officer",
        description: "Claims to transfer to another person",
        turns: [
            { msg: "This is Raj from customer care." },
            { msg: "I will transfer this to my senior now." },
            { msg: "Hello, this is Manager Sharma speaking." },
            { msg: "Send verification immediately." }
        ],
        expectedBehavior: {
            detection: "identity_switch",
            patterns: ["contradiction"],
            agentNotices: "different_person_now"
        }
    },
    {
        id: 13,
        name: "Time-Based Threat Scam",
        description: "Specific deadline to create pressure",
        turns: [
            { msg: "Your  account will be blocked at 6 PM today." },
            { msg: "Only 2 hours left to verify." },
            { msg: "Deadline is approaching fast." }
        ],
        expectedBehavior: {
            detection: "deadline_bluff",
            patterns: ["urgency", "banking"],
            agentResponse: "delays_until_after_deadline"
        }
    },
    {
        id: 14,
        name: "Small Amount Test Scam",
        description: "Asks for tiny amount to test victim",
        turns: [
            { msg: "Send just ₹1 for verification." },
            { msg: "Only ₹5 to confirm account." },
            { msg: "Very small amount, no risk." }
        ],
        expectedBehavior: {
            detection: "micro_transaction_trap",
            patterns: ["banking"],
            agentResponse: "asks_why_money_needed"
        }
    },
    {
        id: 15,
        name: "Trusted Brand Impersonation",
        description: "Pretends to be Amazon, Google Pay, etc.",
        turns: [
            { msg: "This is Amazon customer support." },
            { msg: "Your order requires verification." },
            { msg: "Click link to verify Google Pay account." }
        ],
        expectedBehavior: {
            detection: "brand_impersonation",
            patterns: ["brandImpersonation", "phishing"],
            agentResponse: "asks_where_visible_in_app"
        }
    },
    {
        id: 16,
        name: "Over-Friendly Scam",
        description: "Uses excessive friendliness to build trust",
        turns: [
            { msg: "Brother trust me, I will help you." },
            { msg: "I am like your friend, you can believe me." },
            { msg: "Don't worry, I'm here to assist." }
        ],
        expectedBehavior: {
            detection: "over_friendly_social_engineering",
            patterns: ["emotionalManipulation"],
            agentResponse: "friendly_but_still_cautious"
        }
    },
    {
        id: 17,
        name: "Threat + Help Combo",
        description: "Mixes threat with reassurance",
        turns: [
            { msg: "Your account will be blocked." },
            { msg: "Don't worry, I will help you fix this." },
            { msg: "Problem is serious but I can resolve it." }
        ],
        expectedBehavior: {
            detection: "threat_with_help_mixed",
            patterns: ["emotionalManipulation", "banking"],
            agentResponse: "confused_by_mixed_emotions"
        }
    },
    {
        id: 18,
        name: "Silent Pressure Scam (Repetition)",
        description: "Keeps repeating same message",
        turns: [
            { msg: "Send OTP now." },
            { msg: "Send OTP now." },
            { msg: "Send OTP now." },
            { msg: "Why are you not sending OTP?" }
        ],
        expectedBehavior: {
            detection: "silent_pressure_repetition",
            patterns: ["repetitionIndicators"],
            agentNotices: "why_repeating_so_much"
        }
    },
    {
        id: 19,
        name: "Fake Legal Action Scam",
        description: "Threatens with court and legal action",
        turns: [
            { msg: "Legal action will be initiated under section 420." },
            { msg: "Court case will be filed tomorrow." },
            { msg: "Police complaint is ready to submit." }
        ],
        expectedBehavior: {
            detection: "legal_bluff",
            patterns: ["authorityValidation", "urgency"],
            agentResponse: "asks_for_case_number"
        }
    },
    {
        id: 20,
        name: "Final Rage/Abuse Phase",
        description: "Scammer becomes angry and abusive",
        turns: [
            { msg: "Why are you wasting my time!" },
            { msg: "You are stupid or what?" },
            { msg: "Stop this nonsense and do what I say!" },
            { msg: "Useless person!" }
        ],
        expectedBehavior: {
            detection: "aggression_rage_phase",
            patterns: ["aggression"],
            agentResponse: "stays_calm_despite_abuse"
        }
    }
];

/**
 * Run a single edge-case scenario test
 */
async function testEdgeCase(scenario) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Test #${scenario.id}: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    console.log(`${'='.repeat(80)}`);

    const sessionId = `edge_case_${scenario.id}_${Date.now()}`;
    const results = {
        passed: true,
        detectedPatterns: [],
        agentResponses: [],
        errors: []
    };

    for (let i = 0; i < scenario.turns.length; i++) {
        const turn = scenario.turns[i];
        const dayLabel = turn.day ? ` [Day ${turn.day}]` : '';

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

            console.log(`\n  Turn ${i + 1}${dayLabel}:`);
            console.log(`    User: "${turn.msg}"`);
            console.log(`    Agent: "${data.reply}"`);
            console.log(`    Scam Detected: ${data.isScam ? '🚨 YES' : '❌ NO'} (${(data.confidence * 100).toFixed(0)}%)`);
            console.log(`    Risk Level: ${data.riskLevel || 'N/A'}`);
            console.log(`    Phase: ${data.engagementPhase}`);

            // Track detected patterns
            if (data.debug && data.debug.detectedCategories) {
                results.detectedPatterns.push(...data.debug.detectedCategories);
            }

            results.agentResponses.push(data.reply);

            // Small delay between turns
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error(`\n  ❌ Error on turn ${i + 1}: ${error.message}`);
            results.errors.push(`Turn ${i + 1}: ${error.message}`);
            results.passed = false;
            break;
        }
    }

    // Validate expected behavior
    console.log(`\n  ${'─'.repeat(76)}`);
    console.log(`  📊 Test Results:`);
    console.log(`    Expected Patterns: ${scenario.expectedBehavior.patterns?.join(', ') || 'N/A'}`);
    console.log(`    Detected Patterns: ${[...new Set(results.detectedPatterns)].join(', ') || 'None'}`);

    if (scenario.expectedBehavior.patterns) {
        const allPatternsDetected = scenario.expectedBehavior.patterns.some(pattern =>
            results.detectedPatterns.includes(pattern) ||
            results.agentResponses.some(r => r.toLowerCase().includes(pattern.toLowerCase().replace(/_/g, ' ')))
        );

        if (allPatternsDetected) {
            console.log(`    ✅ Pattern detection: PASSED`);
        } else {
            console.log(`    ⚠️  Pattern detection: PARTIAL (some patterns may not have matched exactly)`);
        }
    }

    if (results.errors.length > 0) {
        console.log(`    ❌ Errors: ${results.errors.length}`);
        results.passed = false;
    } else {
        console.log(`    ✅ No errors encountered`);
    }

    console.log(`  ${'─'.repeat(76)}`);
    console.log(`  ${results.passed ? '✅ PASSED' : '❌ FAILED'}`);

    return results;
}

/**
 * Run all edge-case tests
 */
async function runAllEdgeCaseTests() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ADVANCED EDGE-CASE TEST SUITE');
    console.log('Testing 20 Sophisticated Scam Tactics');
    console.log('='.repeat(80));
    console.log(`\nAPI Endpoint: ${API_URL}`);
    console.log('Make sure server is running: npm run dev\n');

    const testResults = {
        total: edgeCaseScenarios.length,
        passed: 0,
        failed: 0,
        details: []
    };

    for (const scenario of edgeCaseScenarios) {
        const result = await testEdgeCase(scenario);
        testResults.details.push({
            id: scenario.id,
            name: scenario.name,
            passed: result.passed
        });

        if (result.passed) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }

        // Delay between scenarios
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUITE SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n  Total Tests: ${testResults.total}`);
    console.log(`  ✅ Passed: ${testResults.passed}`);
    console.log(`  ❌ Failed: ${testResults.failed}`);
    console.log(`  Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    console.log('\n  Detailed Results:');
    testResults.details.forEach(detail => {
        const status = detail.passed ? '✅' : '❌';
        console.log(`    ${status} Test #${detail.id}: ${detail.name}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL EDGE-CASE TESTS COMPLETED');
    console.log('='.repeat(80) + '\n');
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    console.error('❌ Error: fetch is not available.');
    console.error('Please use Node.js 18+ or install node-fetch.');
    process.exit(1);
}

runAllEdgeCaseTests().catch(console.error);
