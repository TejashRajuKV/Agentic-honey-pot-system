// test-risk-accumulation.js
// Tests that scam state NEVER regresses across turns

const SESSION_ID = 'test_accumulation_' + Date.now();

async function testTurn(msg, turn) {
    const res = await fetch('http://localhost:3000/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'honeypot_secret_key_2026' },
        body: JSON.stringify({ sessionId: SESSION_ID, message: msg })
    });
    const data = await res.json();
    console.log(`Turn ${turn}: "${msg}"`);
    console.log(`  📦 JSON:`);
    console.log(JSON.stringify(data, null, 2).split('\n').map(l => '    ' + l).join('\n'));
    console.log('');
    return data;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 RISK ACCUMULATION ENGINE TEST');
    console.log('Verifying: scam never resets, probability never decreases, phase never regresses');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const results = [];

    // Turn 1: Normal greeting (no scam initially)
    results.push(await testTurn('Hello, how are you?', 1));

    // Turn 2: Technical jargon (should trigger scam)
    results.push(await testTurn('Your account has IMPS error code 392', 2));

    // Turn 3: Normal polite message (scam should STAY true!)
    results.push(await testTurn('Thank you for your cooperation', 3));

    // Turn 4: Another scam tactic (should increase probability)
    results.push(await testTurn('Send OTP now to fix your account', 4));

    // Validation
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 VALIDATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let allPassed = true;

    // Check: Once scamDetected is true, it should never become false
    let scamEverTrue = false;
    for (let i = 0; i < results.length; i++) {
        if (results[i].scamDetected) scamEverTrue = true;
        if (scamEverTrue && !results[i].scamDetected) {
            console.log(`❌ FAIL: Turn ${i + 1} - scamDetected flipped to false after being true!`);
            allPassed = false;
        }
    }
    if (!allPassed || scamEverTrue) {
        const scamStaysTrue = !results.slice(1).some((r, i) => results[i].scamDetected && !r.scamDetected);
        if (scamStaysTrue && scamEverTrue) {
            console.log('✅ PASS: Once scamDetected=true, it stays true');
        }
    }

    // Check: Probability never decreases
    let maxProb = 0;
    let probNeverDecreases = true;
    for (let i = 0; i < results.length; i++) {
        if (results[i].scamProbability < maxProb) {
            console.log(`❌ FAIL: Turn ${i + 1} - probability decreased from ${maxProb} to ${results[i].scamProbability}!`);
            probNeverDecreases = false;
            allPassed = false;
        }
        maxProb = Math.max(maxProb, results[i].scamProbability);
    }
    if (probNeverDecreases) {
        console.log('✅ PASS: Probability never decreased');
    }

    // Check: Phase never regresses
    const PHASE_ORDER = { 'early': 0, 'mid': 1, 'late': 2, 'final': 3 };
    let maxPhase = 0;
    let phaseNeverRegresses = true;
    for (let i = 0; i < results.length; i++) {
        const phaseNum = PHASE_ORDER[results[i].phase] || 0;
        if (phaseNum < maxPhase) {
            console.log(`❌ FAIL: Turn ${i + 1} - phase regressed!`);
            phaseNeverRegresses = false;
            allPassed = false;
        }
        maxPhase = Math.max(maxPhase, phaseNum);
    }
    if (phaseNeverRegresses) {
        console.log('✅ PASS: Phase never regressed');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED - Risk Accumulation Engine is working!');
    } else {
        console.log('❌ SOME TESTS FAILED - Check the output above');
    }
    console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
