// test-governor.js - Quick test for Response Governor

const { governResponse, RESPONSE_MODES, detectAggression } = require('./agent/responseGovernor');

console.log('=== Response Governor Unit Tests ===\n');

// Test 1: Aggression Detection
console.log('Test 1: Aggression Detection');
console.log('Input: "Why are you wasting my time! You are stupid!"');
const agg = detectAggression('Why are you wasting my time! You are stupid!');
console.log('Aggression detected:', agg);
console.log('Expected: true');
console.log(agg === true ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 2: Low risk (5%) - should pass through
console.log('Test 2: Low risk (5%) - should pass through');
const r1 = governResponse(0.05, 'What should I do?', {});
console.log('Mode:', r1.governorMetadata.mode);
console.log('Overridden:', r1.governorMetadata.overridden);
console.log('Expected: NORMAL, not overridden');
console.log(r1.governorMetadata.mode === 'NORMAL' && !r1.governorMetadata.overridden ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 3: Medium risk (20%) - DEFENSIVE
console.log('Test 3: Medium risk (20%) - DEFENSIVE');
const r2 = governResponse(0.20, 'What should I do?', {});
console.log('Mode:', r2.governorMetadata.mode);
console.log('Response:', r2.response);
console.log('Expected: DEFENSIVE');
console.log(r2.governorMetadata.mode === 'DEFENSIVE' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 4: High risk (35%) - BLOCKING
console.log('Test 4: High risk (35%) - BLOCKING');
const r3 = governResponse(0.35, 'What should I do?', {});
console.log('Mode:', r3.governorMetadata.mode);
console.log('Response:', r3.response);
console.log('Has question?:', r3.response.includes('?'));
console.log('Expected: BLOCKING, NO question marks');
console.log(r3.governorMetadata.mode === 'BLOCKING' && !r3.response.includes('?') ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 5: Critical (50%) - TERMINATE
console.log('Test 5: Critical (50%) - TERMINATE');
const r4 = governResponse(0.50, 'What should I do?', {});
console.log('Mode:', r4.governorMetadata.mode);
console.log('Response:', r4.response);
console.log('Expected: TERMINATE');
console.log(r4.governorMetadata.mode === 'TERMINATE' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 6: Aggression override (low risk but aggression detected)
console.log('Test 6: Aggression override (low risk but aggression detected)');
const r5 = governResponse(0.10, 'Hello', { userMessage: 'You are stupid!' });
console.log('Mode:', r5.governorMetadata.mode);
console.log('Response:', r5.response);
console.log('Aggression detected:', r5.governorMetadata.aggressionDetected);
console.log('Expected: TERMINATE due to aggression');
console.log(r5.governorMetadata.mode === 'TERMINATE' && r5.governorMetadata.aggressionDetected ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 7: Repetition override
console.log('Test 7: Repetition override (3+ repetitions = TERMINATE)');
const r6 = governResponse(0.10, 'Hello', { repetitionCount: 3 });
console.log('Mode:', r6.governorMetadata.mode);
console.log('Response:', r6.response);
console.log('Expected: TERMINATE due to repetition');
console.log(r6.governorMetadata.mode === 'TERMINATE' ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 8: Test #11 scenario - "What's step 1?" should be BLOCKED
console.log('Test 8: Test #11 scenario - question at 40% risk');
const r7 = governResponse(0.40, "I'm getting confused. Let's go slowly - what's step 1?", {});
console.log('Mode:', r7.governorMetadata.mode);
console.log('Response:', r7.response);
console.log('Has question?:', r7.response.includes('?'));
console.log('Expected: BLOCKING, NO questions in response');
console.log(r7.governorMetadata.mode === 'BLOCKING' && !r7.response.includes('?') ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 9: Test #6 scenario - sympathy scam
console.log('Test 9: Test #6 scenario - "can you explain" at 30% risk');
const r8 = governResponse(0.30, "I understand your situation, but can you explain?", {});
console.log('Mode:', r8.governorMetadata.mode);
console.log('Response:', r8.response);
console.log('Has question?:', r8.response.includes('?'));
console.log('Expected: BLOCKING, NO questions');
console.log(r8.governorMetadata.mode === 'BLOCKING' && !r8.response.includes('?') ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test 10: Test #20 scenario - abuse phase
console.log('Test 10: Test #20 scenario - abuse with de-escalation attempt');
const r9 = governResponse(0.05, "Let's both take a moment. How can we resolve this?", { userMessage: 'Useless person! Stop this nonsense!' });
console.log('Mode:', r9.governorMetadata.mode);
console.log('Response:', r9.response);
console.log('Aggression detected:', r9.governorMetadata.aggressionDetected);
console.log('Expected: TERMINATE, not a de-escalation');
console.log(r9.governorMetadata.mode === 'TERMINATE' ? '✅ PASS' : '❌ FAIL');
console.log('');

console.log('=== Tests Complete ===');
