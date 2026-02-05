#!/usr/bin/env node

/**
 * Comprehensive Test Suite for 8 New Features (v2.1)
 * 
 * Tests all 8 new hackathon features:
 * 1️⃣ Risk Explanation Layer
 * 2️⃣ User Safety Guidance
 * 3️⃣ Conversation Freeze Mode
 * 4️⃣ Pressure Velocity Score
 * 5️⃣ User Vulnerability Detection
 * 6️⃣ Scam Archetype Label
 * 7️⃣ Confidence Decay Protection
 * 8️⃣ User Override / Feedback
 */

const {
    generateReasoningLayer,
    generateSafetyAdvice,
    calculatePressureVelocity,
    detectUserVulnerability,
    classifyScamArchetype,
    applyConfidenceDecayProtection,
    handleUserLegitimacyClaim,
    getPhaseBasedBehavior
} = require('./detection/scamAnalysisEngine');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(color, ...args) {
    console.log(`${colors[color] || colors.reset}${args.join(' ')}${colors.reset}`);
}

function heading(text) {
    console.log('');
    log('bright', text);
    console.log('');
}

function subheading(text) {
    log('cyan', `\n>>> ${text}`);
}

// Test Case 1: Risk Explanation Layer
function testReasoningLayer() {
    heading('1️⃣ TEST: Risk Explanation Layer (WHY it\'s a scam)');

    const testCases = [
        {
            message: 'Please send me your OTP code. This is urgent!',
            patterns: ['otp_request', 'urgency_escalation'],
            categories: ['authority', 'urgency'],
            desc: 'OTP Fraud'
        },
        {
            message: 'Your bank account has been locked. Verify immediately at this link.',
            patterns: ['account_issue', 'phishing', 'escalating_pressure'],
            categories: ['authority', 'financial'],
            desc: 'Bank Impersonation'
        },
        {
            message: 'Congratulations! You won 50,000 rupees in our lottery!',
            patterns: ['prize_scam', 'lottery_claim'],
            categories: ['reward'],
            desc: 'Prize Scam'
        }
    ];

    testCases.forEach((test, idx) => {
        log('yellow', `\nTest Case ${idx + 1}: ${test.desc}`);
        log('blue', `Message: "${test.message}"`);

        const reasoning = generateReasoningLayer(test.message, [], test.patterns, test.categories);

        log('green', 'Generated Reasoning:');
        reasoning.forEach((reason, i) => {
            console.log(`  ${i + 1}. ${reason}`);
        });
    });
}

// Test Case 2: User Safety Guidance
function testSafetyAdvice() {
    heading('2️⃣ TEST: User Safety Guidance (Actionable Advice)');

    const testCases = [
        {
            message: 'Send me your OTP code immediately',
            probability: 75,
            patterns: ['otp_request'],
            desc: 'High probability OTP scam'
        },
        {
            message: 'Click this link to verify your bank',
            probability: 68,
            patterns: ['phishing'],
            desc: 'Phishing attempt'
        },
        {
            message: 'Transfer 5000 rupees for your refund',
            probability: 80,
            patterns: ['payment_request'],
            desc: 'Payment fraud'
        },
        {
            message: 'Hello there',
            probability: 10,
            patterns: [],
            desc: 'Legitimate message (low probability)'
        }
    ];

    testCases.forEach((test, idx) => {
        log('yellow', `\nTest Case ${idx + 1}: ${test.desc}`);
        log('blue', `Message: "${test.message}"`);
        log('blue', `Probability: ${test.probability}%`);

        const advice = generateSafetyAdvice(test.message, test.probability, test.patterns);

        if (advice.length > 0) {
            log('green', 'Safety Advice:');
            advice.forEach((item, i) => {
                console.log(`  ${i + 1}. ${item}`);
            });
        } else {
            log('yellow', '(No safety advice generated - probability too low)');
        }
    });
}

// Test Case 3: Pressure Velocity
function testPressureVelocity() {
    heading('4️⃣ TEST: Pressure Velocity Score (How fast escalated)');

    const testCases = [
        {
            history: [],
            message: 'Send OTP immediately',
            desc: 'First message with high urgency'
        },
        {
            history: [
                { role: 'user', text: 'Hi, can you help me?' },
                { role: 'agent', text: 'Sure, what do you need?' }
            ],
            message: 'I need your OTP code',
            desc: 'Quick escalation (2 messages)'
        },
        {
            history: [
                { role: 'user', text: 'Hi' },
                { role: 'agent', text: 'Hello' },
                { role: 'user', text: 'I have a problem' },
                { role: 'agent', text: 'Tell me' },
                { role: 'user', text: 'Account issue' },
                { role: 'agent', text: 'How can I help?' }
            ],
            message: 'Send your OTP please',
            desc: 'Slow-burn pattern (5-6 turns)'
        }
    ];

    testCases.forEach((test, idx) => {
        log('yellow', `\nTest Case ${idx + 1}: ${test.desc}`);

        const result = calculatePressureVelocity(test.history, test.message);
        log('green', `Velocity: ${result.velocity.toUpperCase()}`);
        log('green', `Score: ${result.score.toFixed(2)}`);
    });
}

// Test Case 4: User Vulnerability
function testUserVulnerability() {
    heading('5️⃣ TEST: User Vulnerability Detection');

    const testCases = [
        {
            message: 'I\'m scared, please help me. What should I do?',
            history: [],
            desc: 'Highly vulnerable user'
        },
        {
            message: 'I don\'t understand this. Can you explain?',
            history: [
                { role: 'user', text: 'Help me' },
                { role: 'agent', text: 'Sure' },
                { role: 'user', text: 'I\'m confused' }
            ],
            desc: 'Moderately vulnerable (confused, asking for help)'
        },
        {
            message: 'Ok, I understand',
            history: [],
            desc: 'Not vulnerable (confident user)'
        }
    ];

    testCases.forEach((test, idx) => {
        log('yellow', `\nTest Case ${idx + 1}: ${test.desc}`);
        log('blue', `Message: "${test.message}"`);

        const result = detectUserVulnerability(test.message, test.history);
        log('green', `Vulnerability: ${result.vulnerability.toUpperCase()}`);
        log('green', `Score: ${result.score.toFixed(2)}`);

        if (result.indicators.length > 0) {
            log('green', `Indicators: ${result.indicators.join(', ')}`);
        }
    });
}

// Test Case 5: Scam Archetype
function testScamArchetype() {
    heading('6️⃣ TEST: Scam Archetype Label Classification');

    const testCases = [
        {
            message: 'Your OTP is requested for verification. Reply with your code.',
            patterns: ['otp_request'],
            categories: [],
            desc: 'OTP Fraud'
        },
        {
            message: 'This is RBI calling. Your bank account has been compromised.',
            patterns: ['bank_impersonation'],
            categories: ['authority'],
            desc: 'Bank Impersonation'
        },
        {
            message: 'Click here to remove malware from your computer',
            patterns: ['tech_support_scam'],
            categories: [],
            desc: 'Tech Support Scam'
        },
        {
            message: 'Congratulations! You\'ve won Rs. 5 lakhs in our lottery draw!',
            patterns: ['prize_scam'],
            categories: ['reward'],
            desc: 'Prize Scam'
        },
        {
            message: 'Police case filed against you. Pay fine immediately or face arrest.',
            patterns: ['legal_threat'],
            categories: [],
            desc: 'Legal Threat Scam'
        },
        {
            message: 'Hi bro, I\'m stuck abroad. Can you send me 50,000 rupees?',
            patterns: [],
            categories: [],
            desc: 'Friend in Emergency'
        }
    ];

    testCases.forEach((test, idx) => {
        log('yellow', `\nTest Case ${idx + 1}: ${test.desc}`);
        log('blue', `Message: "${test.message}"`);

        const archetype = classifyScamArchetype(test.message, test.patterns, test.categories);
        log('green', `Classified As: ${archetype}`);
    });
}

// Test Case 6: Confidence Decay Protection
function testConfidenceDecay() {
    heading('7️⃣ TEST: Confidence Decay Protection (Lock at 60%)');

    const testCases = [
        {
            current: 0.75,
            previous: 0.65,
            locked: false,
            desc: 'High confidence, first time (should lock)'
        },
        {
            current: 0.45,
            previous: 0.70,
            locked: true,
            desc: 'Locked confidence prevents decay'
        },
        {
            current: 0.85,
            previous: 0.75,
            locked: true,
            desc: 'Locked confidence can still increase'
        },
        {
            current: 0.30,
            previous: 0.30,
            locked: false,
            desc: 'Low confidence remains unlocked'
        }
    ];

    testCases.forEach((test, idx) => {
        log('yellow', `\nTest Case ${idx + 1}: ${test.desc}`);
        log('blue', `Current: ${(test.current * 100).toFixed(0)}%, Previous: ${(test.previous * 100).toFixed(0)}%, Locked: ${test.locked}`);

        const result = applyConfidenceDecayProtection(test.current, test.previous, test.locked);
        log('green', `Final Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        log('green', `Is Locked: ${result.isLocked}`);
        log('green', `Reason: ${result.reason}`);
    });
}

// Test Case 7: User Override
function testUserOverride() {
    heading('8️⃣ TEST: User Override / Feedback (Legitimacy Claims)');

    const testCases = [
        {
            message: 'This is my real bank calling',
            confidence: 0.75,
            desc: 'User claims legitimacy'
        },
        {
            message: 'I know this person, they are legitimate',
            confidence: 0.80,
            desc: 'User trusts the contact'
        },
        {
            message: 'Please continue',
            confidence: 0.70,
            desc: 'No legitimacy claim'
        },
        {
            message: 'This is genuine',
            confidence: 0.65,
            desc: 'User claims genuine contact'
        }
    ];

    testCases.forEach((test, idx) => {
        log('yellow', `\nTest Case ${idx + 1}: ${test.desc}`);
        log('blue', `Message: "${test.message}"`);
        log('blue', `Original Confidence: ${(test.confidence * 100).toFixed(0)}%`);

        const result = handleUserLegitimacyClaim(test.message, test.confidence);
        log('green', `User Claimed Legitimate: ${result.userClaimedLegitimate}`);
        log('green', `Adjusted Confidence: ${(result.adjustedConfidence * 100).toFixed(0)}%`);
        log('green', `Reason: ${result.reason}`);
    });
}

// Test Case 8: Phase-based Behavior
function testPhaseBehavior() {
    heading('3️⃣ TEST: Conversation Freeze Mode & Phase Behavior');

    const phases = ['early', 'mid', 'late', 'final'];

    phases.forEach(phase => {
        const behavior = getPhaseBasedBehavior(phase);
        log('yellow', `\nPhase: ${phase.toUpperCase()}`);
        log('green', `Allow Questions: ${behavior.allowQuestions}`);
        log('green', `Allow Engagement: ${behavior.allowEngagement}`);
        log('green', `Tone: ${behavior.tone}`);
        log('green', `Bait Allowed: ${behavior.baitAllowed}`);
        log('green', `Description: ${behavior.description}`);

        if (phase === 'late' || phase === 'final') {
            log('red', '⚠️  FREEZE MODE ACTIVE');
        }
    });
}

// Run all tests
function runAllTests() {
    console.clear();
    log('bright', '\n🎯 COMPREHENSIVE TEST SUITE: 8 NEW HACKATHON FEATURES (v2.1)\n');

    testReasoningLayer();
    testSafetyAdvice();
    testPressureVelocity();
    testUserVulnerability();
    testScamArchetype();
    testConfidenceDecay();
    testUserOverride();
    testPhaseBehavior();

    heading('✅ ALL TESTS COMPLETED');

    log('green', '\n📊 Summary of Features:');
    console.log('  1️⃣  Risk Explanation Layer - Explains WHY it\'s a scam');
    console.log('  2️⃣  User Safety Guidance - Provides actionable advice');
    console.log('  3️⃣  Conversation Freeze Mode - Stops questions in late phase');
    console.log('  4️⃣  Pressure Velocity Score - Tracks escalation speed');
    console.log('  5️⃣  User Vulnerability Detection - Identifies vulnerable victims');
    console.log('  6️⃣  Scam Archetype Label - Classifies scam type');
    console.log('  7️⃣  Confidence Decay Protection - Locks confidence at 60%');
    console.log('  8️⃣  User Override / Feedback - Handles legitimacy claims\n');
}

runAllTests();
