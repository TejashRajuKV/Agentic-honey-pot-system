// test-comprehensive.js - Tests ALL critical features working together

async function testAPI(sessionId, msg) {
    const res = await fetch('http://localhost:3000/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'honeypot_secret_key_2026' },
        body: JSON.stringify({ sessionId, message: msg })
    });
    return res.json();
}

async function main() {
    console.log('═════════════════════════════════════════════════════════════════════');
    console.log('🧪 COMPREHENSIVE FEATURE VERIFICATION TEST');
    console.log('═════════════════════════════════════════════════════════════════════\n');

    let allPassed = true;

    // ═══════════════════════════════════════════════════════════════════
    // TEST 1: JSON Response Format
    // ═══════════════════════════════════════════════════════════════════
    console.log('📋 TEST 1: JSON Response Format');
    const t1 = await testAPI('format_test_' + Date.now(), 'Hello');
    const hasAllFields =
        typeof t1.reply === 'string' &&
        typeof t1.scamDetected === 'boolean' &&
        typeof t1.scamProbability === 'number' &&
        typeof t1.phase === 'string' &&
        Array.isArray(t1.patterns);
    console.log(`   reply: ${typeof t1.reply} ${typeof t1.reply === 'string' ? '✅' : '❌'}`);
    console.log(`   scamDetected: ${typeof t1.scamDetected} ${typeof t1.scamDetected === 'boolean' ? '✅' : '❌'}`);
    console.log(`   scamProbability: ${typeof t1.scamProbability} ${typeof t1.scamProbability === 'number' && !isNaN(t1.scamProbability) ? '✅' : '❌'}`);
    console.log(`   phase: ${t1.phase} ${['early', 'mid', 'late', 'final'].includes(t1.phase) ? '✅' : '❌'}`);
    console.log(`   patterns: ${Array.isArray(t1.patterns) ? '✅ array' : '❌ not array'}`);
    if (!hasAllFields) allPassed = false;

    // ═══════════════════════════════════════════════════════════════════
    // TEST 2: Risk Accumulation (scam stays true)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 TEST 2: Risk Accumulation - scam never resets');
    const sessionA = 'accum_test_' + Date.now();
    const a1 = await testAPI(sessionA, 'Send me your OTP now');  // Scam
    const a2 = await testAPI(sessionA, 'Thank you');            // Normal
    const a3 = await testAPI(sessionA, 'Have a nice day');      // Normal
    console.log(`   Turn 1 (scam msg): scamDetected=${a1.scamDetected}, prob=${a1.scamProbability}%`);
    console.log(`   Turn 2 (normal msg): scamDetected=${a2.scamDetected}, prob=${a2.scamProbability}%`);
    console.log(`   Turn 3 (normal msg): scamDetected=${a3.scamDetected}, prob=${a3.scamProbability}%`);
    if (a1.scamDetected && a2.scamDetected && a3.scamDetected) {
        console.log('   ✅ scamDetected stays TRUE');
    } else {
        console.log('   ❌ scamDetected flipped to false!');
        allPassed = false;
    }
    if (a2.scamProbability >= a1.scamProbability && a3.scamProbability >= a2.scamProbability) {
        console.log('   ✅ probability never decreased');
    } else {
        console.log('   ❌ probability decreased!');
        allPassed = false;
    }

    // ═══════════════════════════════════════════════════════════════════
    // TEST 3: Phase progression (never regresses)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 TEST 3: Phase Progression - never regresses');
    const PHASE_ORDER = { 'early': 0, 'mid': 1, 'late': 2, 'final': 3 };
    const sessionB = 'phase_test_' + Date.now();
    const b1 = await testAPI(sessionB, 'Your account will be blocked today');  // mid
    const b2 = await testAPI(sessionB, 'Send OTP immediately or else!');       // late
    const b3 = await testAPI(sessionB, 'OK thank you');                         // should stay late
    console.log(`   Turn 1: phase=${b1.phase}`);
    console.log(`   Turn 2: phase=${b2.phase}`);
    console.log(`   Turn 3: phase=${b3.phase}`);
    if (PHASE_ORDER[b2.phase] >= PHASE_ORDER[b1.phase] && PHASE_ORDER[b3.phase] >= PHASE_ORDER[b2.phase]) {
        console.log('   ✅ phase never regressed');
    } else {
        console.log('   ❌ phase regressed!');
        allPassed = false;
    }

    // ═══════════════════════════════════════════════════════════════════
    // TEST 4: Critical Pattern Detection
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 TEST 4: Critical Pattern Detection');

    // OTP Request
    const otp = await testAPI('otp_' + Date.now(), 'Send me your OTP code');
    console.log(`   OTP request: scamDetected=${otp.scamDetected} ${otp.scamDetected ? '✅' : '❌'}`);
    if (!otp.scamDetected) allPassed = false;

    // Money transfer
    const money = await testAPI('money_' + Date.now(), 'Transfer 5000 rupees to my account');
    console.log(`   Money request: scamDetected=${money.scamDetected} ${money.scamDetected ? '✅' : '❌'}`);
    if (!money.scamDetected) allPassed = false;

    // Lottery scam
    const lottery = await testAPI('lottery_' + Date.now(), 'Congratulations! You won a lottery prize');
    console.log(`   Lottery scam: scamDetected=${lottery.scamDetected} ${lottery.scamDetected ? '✅' : '❌'}`);
    if (!lottery.scamDetected) allPassed = false;

    // Emotional manipulation
    const emotion = await testAPI('emotion_' + Date.now(), 'Please help me, I will lose my job');
    console.log(`   Emotional manipulation: scamDetected=${emotion.scamDetected} ${emotion.scamDetected ? '✅' : '❌'}`);
    if (!emotion.scamDetected) allPassed = false;

    // Normal greeting (should NOT be scam)
    const greeting = await testAPI('greeting_' + Date.now(), 'Hello, good morning!');
    console.log(`   Normal greeting: scamDetected=${greeting.scamDetected} ${!greeting.scamDetected ? '✅' : '❌'}`);
    if (greeting.scamDetected) allPassed = false;

    // ═══════════════════════════════════════════════════════════════════
    // FINAL RESULT
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n═════════════════════════════════════════════════════════════════════');
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED - System is HACKATHON READY!');
    } else {
        console.log('❌ SOME TESTS FAILED - Review the output above');
    }
    console.log('═════════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
