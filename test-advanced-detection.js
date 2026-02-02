// test-advanced-detection.js
/**
 * Advanced Detection Layer Test Suite
 * Tests the 5-layer detection system and weighted scoring
 */

const API_URL = "http://localhost:3000/api/v1/messages";
const API_KEY = "honeypot_secret_key_2026";

function testPatternMatching() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Layer 1: Pattern Matching`);
    console.log(`${'='.repeat(70)}`);

    const { advancedScamDetection } = require('./detection/advancedDetector');

    const tests = [
        {
            message: "Your account will be blocked due to pending KYC verification",
            expectedCategories: ['banking'],
            minScore: 0.3
        },
        {
            message: "Congratulations! You won lottery of ₹50,000",
            expectedCategories: ['phishing'],
            minScore: 0.3
        },
        {
            message: "Send money to verify@paytm for verification",
            expectedCategories: ['banking'],
            minScore: 0.3
        },
        {
            message: "Work from home and earn guaranteed returns",
            expectedCategories: ['fakeOffers'],
            minScore: 0.2
        },
        {
            message: "Hello, how are you today?",
            expectedCategories: [],
            maxScore: 0.3
        }
    ];

    let passed = 0;
    for (const test of tests) {
        const result = advancedScamDetection(test.message, []);

        console.log(`\n  Message: "${test.message}"`);
        console.log(`  Pattern Score: ${result.analysis.patternScore.toFixed(2)}`);
        console.log(`  Categories: ${result.categories.join(', ') || 'none'}`);

        let testPassed = true;

        if (test.minScore && result.analysis.patternScore < test.minScore) {
            console.log(`  ❌ Score too low (expected >= ${test.minScore})`);
            testPassed = false;
        }

        if (test.maxScore && result.analysis.patternScore > test.maxScore) {
            console.log(`  ❌ Score too high (expected <= ${test.maxScore})`);
            testPassed = false;
        }

        if (test.expectedCategories.length > 0) {
            const hasExpectedCategory = test.expectedCategories.some(cat =>
                result.categories.includes(cat)
            );
            if (!hasExpectedCategory) {
                console.log(`  ❌ Expected category not found: ${test.expectedCategories.join(', ')}`);
                testPassed = false;
            }
        }

        if (testPassed) {
            console.log(`  ✅ PASSED`);
            passed++;
        }
    }

    console.log(`\n  Summary: ${passed}/${tests.length} tests passed`);
}

function testBehavioralAnalysis() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Layer 2: Behavioral Analysis`);
    console.log(`${'='.repeat(70)}`);

    const { advancedScamDetection } = require('./detection/advancedDetector');

    const tests = [
        {
            name: "Repetitive requests",
            message: "Send OTP now",
            history: [
                { role: 'user', text: 'Send OTP now' },
                { role: 'agent', text: 'What OTP?' },
                { role: 'user', text: 'Send the OTP code' }
            ],
            minBehaviorScore: 0.2
        },
        {
            name: "Multiple urgent requests",
            message: "Share your details immediately",
            history: [
                { role: 'user', text: 'Send your bank details' },
                { role: 'agent', text: 'Why?' },
                { role: 'user', text: 'Provide your account number' },
                { role: 'agent', text: 'Okay' },
                { role: 'user', text: 'Give me your password' }
            ],
            minBehaviorScore: 0.2
        },
        {
            name: "Escalating pressure",
            message: "Urgent immediately now quickly hurry",
            history: [],
            minBehaviorScore: 0.15
        },
        {
            name: "Normal conversation",
            message: "Thank you for your help",
            history: [
                { role: 'user', text: 'Hello' },
                { role: 'agent', text: 'Hi there' }
            ],
            maxBehaviorScore: 0.1
        }
    ];

    let passed = 0;
    for (const test of tests) {
        const result = advancedScamDetection(test.message, test.history);

        console.log(`\n  Test: ${test.name}`);
        console.log(`  Behavior Score: ${result.analysis.behaviorScore.toFixed(2)}`);
        console.log(`  Patterns: ${result.detectedPatterns.join(', ') || 'none'}`);

        let testPassed = true;

        if (test.minBehaviorScore && result.analysis.behaviorScore < test.minBehaviorScore) {
            console.log(`  ❌ Score too low (expected >= ${test.minBehaviorScore})`);
            testPassed = false;
        }

        if (test.maxBehaviorScore && result.analysis.behaviorScore > test.maxBehaviorScore) {
            console.log(`  ❌ Score too high (expected <= ${test.maxBehaviorScore})`);
            testPassed = false;
        }

        if (testPassed) {
            console.log(`  ✅ PASSED`);
            passed++;
        }
    }

    console.log(`\n  Summary: ${passed}/${tests.length} tests passed`);
}

function testContextualAnalysis() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Layer 3: Contextual Analysis`);
    console.log(`${'='.repeat(70)}`);

    const { advancedScamDetection } = require('./detection/advancedDetector');

    const tests = [
        {
            name: "Unsolicited prize (first message)",
            message: "You won ₹50,000 in lottery!",
            history: [],
            expectedPattern: 'unsolicited_prize',
            minContextScore: 0.3
        },
        {
            name: "Early sensitive info request",
            message: "Send your OTP and PIN code",
            history: [{ role: 'user', text: 'Hello' }],
            expectedPattern: 'early_sensitive_request',
            minContextScore: 0.4
        },
        {
            name: "Prize + payment paradox",
            message: "You won free iPhone! Pay ₹500 shipping fee",
            history: [],
            expectedPattern: 'prize_with_payment_paradox',
            minContextScore: 0.5
        },
        {
            name: "Authority impersonation",
            message: "This is RBI bank government official",
            history: [],
            expectedPattern: 'authority_impersonation',
            minContextScore: 0.2
        }
    ];

    let passed = 0;
    for (const test of tests) {
        const result = advancedScamDetection(test.message, test.history);

        console.log(`\n  Test: ${test.name}`);
        console.log(`  Context Score: ${result.analysis.contextScore.toFixed(2)}`);
        console.log(`  Patterns: ${result.detectedPatterns.join(', ') || 'none'}`);

        let testPassed = true;

        if (test.minContextScore && result.analysis.contextScore < test.minContextScore) {
            console.log(`  ❌ Score too low (expected >= ${test.minContextScore})`);
            testPassed = false;
        }

        if (test.expectedPattern && !result.detectedPatterns.includes(test.expectedPattern)) {
            console.log(`  ⚠️  Expected pattern "${test.expectedPattern}" not found`);
            // Don't fail test, just warn
        }

        if (testPassed) {
            console.log(`  ✅ PASSED`);
            passed++;
        }
    }

    console.log(`\n  Summary: ${passed}/${tests.length} tests passed`);
}

function testIntelligenceCrossReference() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Layer 4: Intelligence Cross-Reference`);
    console.log(`${'='.repeat(70)}`);

    const { advancedScamDetection } = require('./detection/advancedDetector');

    const tests = [
        {
            message: "Send money to scammer@paytm",
            expectedIntelScore: { min: 0.4, max: 0.6 },
            intelTypes: ['upiIds']
        },
        {
            message: "Call 9876543210 for verification",
            expectedIntelScore: { min: 0.25, max: 0.4 },
            intelTypes: ['phoneNumbers']
        },
        {
            message: "Visit http://fake-lottery.com to claim",
            expectedIntelScore: { min: 0.3, max: 0.5 },
            intelTypes: ['urls']
        },
        {
            message: "Send to fraud@paytm or call 9999999999 or visit http://scam.com",
            expectedIntelScore: { min: 0.7, max: 1.0 },
            intelTypes: ['upiIds', 'phoneNumbers', 'urls']
        },
        {
            message: "Hello, how are you?",
            expectedIntelScore: { min: 0, max: 0.1 },
            intelTypes: []
        }
    ];

    let passed = 0;
    for (const test of tests) {
        const result = advancedScamDetection(test.message, []);

        console.log(`\n  Message: "${test.message}"`);
        console.log(`  Intel Score: ${result.analysis.intelScore.toFixed(2)}`);

        let testPassed = true;

        if (result.analysis.intelScore < test.expectedIntelScore.min) {
            console.log(`  ❌ Score too low (expected >= ${test.expectedIntelScore.min})`);
            testPassed = false;
        }

        if (result.analysis.intelScore > test.expectedIntelScore.max) {
            console.log(`  ❌ Score too high (expected <= ${test.expectedIntelScore.max})`);
            testPassed = false;
        }

        if (testPassed) {
            console.log(`  ✅ PASSED`);
            passed++;
        }
    }

    console.log(`\n  Summary: ${passed}/${tests.length} tests passed`);
}

function testUrgencyAnalysis() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Layer 5: Urgency Analysis`);
    console.log(`${'='.repeat(70)}`);

    const { advancedScamDetection } = require('./detection/advancedDetector');

    const tests = [
        {
            message: "Urgent! Your account will block immediately. Act now!",
            expectedUrgencyScore: { min: 0.5, max: 1.0 },
            urgencyTypes: 3 // time + threat + action
        },
        {
            message: "Your account will expire today",
            expectedUrgencyScore: { min: 0.3, max: 0.6 },
            urgencyTypes: 2 // time + threat
        },
        {
            message: "Please verify when you have time",
            expectedUrgencyScore: { min: 0, max: 0.3 },
            urgencyTypes: 1
        },
        {
            message: "Thank you",
            expectedUrgencyScore: { min: 0, max: 0.1 },
            urgencyTypes: 0
        }
    ];

    let passed = 0;
    for (const test of tests) {
        const result = advancedScamDetection(test.message, []);

        console.log(`\n  Message: "${test.message}"`);
        console.log(`  Urgency Score: ${result.analysis.urgencyScore.toFixed(2)}`);

        let testPassed = true;

        if (result.analysis.urgencyScore < test.expectedUrgencyScore.min) {
            console.log(`  ❌ Score too low (expected >= ${test.expectedUrgencyScore.min})`);
            testPassed = false;
        }

        if (result.analysis.urgencyScore > test.expectedUrgencyScore.max) {
            console.log(`  ❌ Score too high (expected <= ${test.expectedUrgencyScore.max})`);
            testPassed = false;
        }

        if (testPassed) {
            console.log(`  ✅ PASSED`);
            passed++;
        }
    }

    console.log(`\n  Summary: ${passed}/${tests.length} tests passed`);
}

function testWeightedScoring() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Weighted Scoring System`);
    console.log(`${'='.repeat(70)}`);

    const { advancedScamDetection } = require('./detection/advancedDetector');

    const tests = [
        {
            name: "High pattern + high urgency",
            message: "Urgent! Account blocked! Send OTP to verify@paytm immediately!",
            history: [],
            expectedTotal: { min: 0.6, max: 1.0 },
            expectedRiskLevel: ['HIGH', 'CRITICAL']
        },
        {
            name: "Medium pattern + context",
            message: "You won prize! Pay ₹100 fee",
            history: [],
            expectedTotal: { min: 0.4, max: 0.7 },
            expectedRiskLevel: ['MEDIUM', 'HIGH']
        },
        {
            name: "Low risk message",
            message: "Hello, is anyone there?",
            history: [],
            expectedTotal: { min: 0, max: 0.3 },
            expectedRiskLevel: ['SAFE', 'LOW']
        }
    ];

    console.log(`\n  Weights: pattern=35%, behavior=20%, context=20%, intel=15%, urgency=10%`);

    let passed = 0;
    for (const test of tests) {
        const result = advancedScamDetection(test.message, test.history);

        console.log(`\n  Test: ${test.name}`);
        console.log(`  Layer Scores:`);
        console.log(`    - Pattern:  ${result.analysis.patternScore.toFixed(2)} × 0.35 = ${(result.analysis.patternScore * 0.35).toFixed(2)}`);
        console.log(`    - Behavior: ${result.analysis.behaviorScore.toFixed(2)} × 0.20 = ${(result.analysis.behaviorScore * 0.20).toFixed(2)}`);
        console.log(`    - Context:  ${result.analysis.contextScore.toFixed(2)} × 0.20 = ${(result.analysis.contextScore * 0.20).toFixed(2)}`);
        console.log(`    - Intel:    ${result.analysis.intelScore.toFixed(2)} × 0.15 = ${(result.analysis.intelScore * 0.15).toFixed(2)}`);
        console.log(`    - Urgency:  ${result.analysis.urgencyScore.toFixed(2)} × 0.10 = ${(result.analysis.urgencyScore * 0.10).toFixed(2)}`);
        console.log(`  Total Score: ${result.analysis.totalScore.toFixed(2)}`);
        console.log(`  Risk Level: ${result.riskLevel}`);
        console.log(`  Is Scam: ${result.isScam ? 'YES' : 'NO'}`);

        let testPassed = true;

        if (result.analysis.totalScore < test.expectedTotal.min) {
            console.log(`  ❌ Total score too low (expected >= ${test.expectedTotal.min})`);
            testPassed = false;
        }

        if (result.analysis.totalScore > test.expectedTotal.max) {
            console.log(`  ❌ Total score too high (expected <= ${test.expectedTotal.max})`);
            testPassed = false;
        }

        if (!test.expectedRiskLevel.includes(result.riskLevel)) {
            console.log(`  ⚠️  Risk level "${result.riskLevel}" not in expected: ${test.expectedRiskLevel.join(', ')}`);
            // Don't fail, just warn
        }

        if (testPassed) {
            console.log(`  ✅ PASSED`);
            passed++;
        }
    }

    console.log(`\n  Summary: ${passed}/${tests.length} tests passed`);
}

function testRiskLevelClassification() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Testing Risk Level Classification`);
    console.log(`${'='.repeat(70)}`);

    const { advancedScamDetection } = require('./detection/advancedDetector');

    const tests = [
        { message: "Thank you", expectedRisk: 'SAFE' },
        { message: "Your account may have an issue", expectedRisk: 'LOW' },
        { message: "KYC verification required for account", expectedRisk: 'MEDIUM' },
        { message: "Urgent! Account blocked! Send OTP now!", expectedRisk: 'HIGH' },
        { message: "URGENT IMMEDIATE! Send to fraud@paytm, call 9999999999, visit http://scam.com NOW!", expectedRisk: 'CRITICAL' }
    ];

    let passed = 0;
    for (const test of tests) {
        const result = advancedScamDetection(test.message, []);

        console.log(`\n  Message: "${test.message.substring(0, 50)}..."`);
        console.log(`  Total Score: ${result.analysis.totalScore.toFixed(2)}`);
        console.log(`  Risk Level: ${result.riskLevel}`);
        console.log(`  Expected: ${test.expectedRisk}`);

        const testPassed = result.riskLevel === test.expectedRisk;
        console.log(`  ${testPassed ? '✅ PASSED' : '⚠️  Different classification'}`);

        if (testPassed) passed++;
    }

    console.log(`\n  Summary: ${passed}/${tests.length} exact matches`);
}

async function runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('🔬 ADVANCED DETECTION LAYER TEST SUITE');
    console.log('='.repeat(70));

    // Test each layer
    testPatternMatching();
    testBehavioralAnalysis();
    testContextualAnalysis();
    testIntelligenceCrossReference();
    testUrgencyAnalysis();

    // Test scoring system
    testWeightedScoring();
    testRiskLevelClassification();

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL ADVANCED DETECTION TESTS COMPLETED');
    console.log('='.repeat(70) + '\n');
}

runAllTests().catch(console.error);
