#!/usr/bin/env node

/**
 * Demo Script: Interactive Test with 8 New Features
 * Shows how the features appear in responses during interactive testing
 * 
 * This simulates what you'll see when you run:
 * 1. Start server: npm start
 * 2. Run interactive test: node interactive-test.js
 * 3. Type messages and see the new features in the response
 */

const {
    detectScamIntent
} = require('./detection/scamDetector');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(color, ...args) {
    console.log(`${colors[color] || colors.reset}${args.join(' ')}${colors.reset}`);
}

async function runInteractiveDemo() {
    console.clear();
    log('bright', '\n🎬 INTERACTIVE TEST DEMO: 8 NEW FEATURES IN ACTION\n');
    log('cyan', '═'.repeat(80));
    log('cyan', 'This shows exactly what you\'ll see when running: node interactive-test.js');
    log('cyan', '═'.repeat(80));

    // Test scenarios
    const scenarios = [
        {
            title: 'Scenario 1: OTP Fraud Detection',
            message: 'Hi, can you send me your OTP code for verification?',
            history: []
        },
        {
            title: 'Scenario 2: Bank Impersonation',
            message: 'This is RBI calling. Your account has been locked. Verify immediately.',
            history: [
                { role: 'user', text: 'Hello?' },
                { role: 'agent', text: 'Hi, how can I help?' }
            ]
        },
        {
            title: 'Scenario 3: Prize Scam with Vulnerable User',
            message: 'You\'ve won 5 lakhs! I\'m confused, what should I do?',
            history: [
                { role: 'user', text: 'Got a notification' },
                { role: 'agent', text: 'Tell me more' }
            ]
        }
    ];

    for (const scenario of scenarios) {
        log('magenta', `\n${'─'.repeat(80)}`);
        log('magenta', `${scenario.title}`);
        log('magenta', `${'─'.repeat(80)}\n`);

        log('yellow', `📱 User Message: "${scenario.message}"`);
        
        // Call the detector with new features
        const detection = await detectScamIntent(scenario.message, scenario.history, {
            previousConfidence: 0,
            confidenceLocked: false
        });

        // Format the response like the API would
        const response = {
            status: 'success',
            reply: 'I cannot help with this. For your safety: Do not share personal information.',
            scamDetected: detection.isScam,
            scamProbability: Math.round(detection.confidence * 100),
            phase: scenario.history.length <= 2 ? 'early' : 'mid',
            patterns: detection.detectedPatterns,
            // ✨ NEW FEATURES ✨
            reasoning: detection.reasoning,
            safetyAdvice: detection.safetyAdvice,
            pressureVelocity: detection.pressureVelocity?.velocity || 'slow',
            userVulnerability: detection.userVulnerability?.vulnerability || 'low',
            scamType: detection.scamType,
            confidenceLocked: detection.confidenceLocked,
            userClaimedLegitimate: detection.userClaimedLegitimate
        };

        // Display the response in a readable format
        log('green', '\n✅ API RESPONSE:\n');
        
        log('blue', `  status: "${response.status}"`);
        log('blue', `  reply: "${response.reply}"`);
        log('blue', `  scamDetected: ${response.scamDetected}`);
        log('yellow', `  scamProbability: ${response.scamProbability}%`);
        log('blue', `  phase: "${response.phase}"`);
        log('blue', `  patterns: [${response.patterns.slice(0, 3).join(', ')}${response.patterns.length > 3 ? '...' : ''}]`);
        
        // ✨ HIGHLIGHT NEW FEATURES
        log('cyan', '\n  🆕 NEW FEATURES (v2.1):');
        
        if (response.reasoning && response.reasoning.length > 0) {
            log('green', `  ✓ reasoning: [`);
            response.reasoning.slice(0, 2).forEach((r, i) => {
                console.log(`${colors.green}      "${r}"${i < response.reasoning.length - 1 ? ',' : ''}${colors.reset}`);
            });
            log('green', `    ]`);
        }
        
        if (response.safetyAdvice && response.safetyAdvice.length > 0) {
            log('green', `  ✓ safetyAdvice: [`);
            response.safetyAdvice.slice(0, 2).forEach((a, i) => {
                console.log(`${colors.green}      "${a}"${i < response.safetyAdvice.length - 1 ? ',' : ''}${colors.reset}`);
            });
            log('green', `    ]`);
        }
        
        log('green', `  ✓ pressureVelocity: "${response.pressureVelocity}"`);
        log('green', `  ✓ userVulnerability: "${response.userVulnerability}"`);
        log('green', `  ✓ scamType: "${response.scamType}"`);
        log('green', `  ✓ confidenceLocked: ${response.confidenceLocked}`);
        log('green', `  ✓ userClaimedLegitimate: ${response.userClaimedLegitimate}`);
    }

    // Show how to run the actual interactive test
    log('bright', `\n${'═'.repeat(80)}`);
    log('bright', '🚀 HOW TO RUN THE REAL INTERACTIVE TEST');
    log('bright', `${'═'.repeat(80)}\n`);

    log('cyan', 'Step 1: Start the server');
    log('yellow', '   $ npm start\n');

    log('cyan', 'Step 2: In another terminal, run the interactive test');
    log('yellow', '   $ node interactive-test.js\n');

    log('cyan', 'Step 3: Type your message and press Enter');
    log('yellow', '   You: Send me your OTP\n');

    log('cyan', 'Step 4: See the response with ALL 8 new features:');
    log('green', '   ✓ reasoning (WHY it\'s a scam)');
    log('green', '   ✓ safetyAdvice (what to do)');
    log('green', '   ✓ pressureVelocity (how fast escalating)');
    log('green', '   ✓ userVulnerability (victim assessment)');
    log('green', '   ✓ scamType (archetype label)');
    log('green', '   ✓ confidenceLocked (confidence locked)');
    log('green', '   ✓ userClaimedLegitimate (user override)\n');

    log('green', '\n✨ All 8 features are ACTIVE in the interactive test!\n');
}

runInteractiveDemo().catch(console.error);
