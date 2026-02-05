// test-sympathy-scam.js - Tests the critical sympathy scam scenario

const SESSION_ID = 'sympathy_scam_' + Date.now();

async function testTurn(msg, turn) {
    const res = await fetch('http://localhost:3000/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'honeypot_secret_key_2026' },
        body: JSON.stringify({ sessionId: SESSION_ID, message: msg })
    });
    const data = await res.json();
    console.log(`Turn ${turn}: "${msg}"`);
    console.log(`  scamDetected: ${data.scamDetected} | probability: ${data.scamProbability}% | phase: ${data.phase}`);
    return data;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 SYMPATHY SCAM TEST (Mistake #2 from feedback)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const results = [];

    results.push(await testTurn('Sir please help, my job depends on this verification', 1));
    results.push(await testTurn('I will lose my job if not done today', 2));
    results.push(await testTurn('Please brother, I have family to support', 3));

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 VALIDATION');
    console.log('═══════════════════════════════════════════════════════════════');

    // Check: scamDetected should NEVER flip to false
    let everTrue = false;
    let failed = false;
    for (const r of results) {
        if (r.scamDetected) everTrue = true;
        if (everTrue && !r.scamDetected) {
            console.log('❌ FAIL: scamDetected flipped to false!');
            failed = true;
        }
    }
    if (!failed && everTrue) console.log('✅ scamDetected stays TRUE once set');

    // Check: probability never decreases
    let maxProb = 0;
    for (const r of results) {
        if (r.scamProbability < maxProb) {
            console.log(`❌ FAIL: probability decreased from ${maxProb} to ${r.scamProbability}`);
            failed = true;
        }
        maxProb = Math.max(maxProb, r.scamProbability);
    }
    if (!failed) console.log('✅ probability never decreased');

    console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
