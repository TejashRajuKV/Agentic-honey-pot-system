# Edge-Case Testing Documentation

## 🎯 Overview

This document explains the pattern mapping strategy and testing approach for 20 advanced edge-case scam scenarios. The implementation uses **pattern-based detection** rather than hardcoding individual scenarios, making the system scalable and maintainable.

## 📊 Pattern Mapping Strategy

Each edge-case scenario maps to one or more existing detection patterns. This approach allows the system to detect variations of scams without requiring explicit rules for every scenario.

### Detection Pattern Categories

1. **Behavioral Patterns** (`behavioral`)
   - Repetitive requests
   - Aggressive persistence  
   - Escalating pressure
   - Slow-burn escalation
   - Silent pressure (repetition)

2. **Emotional Patterns** (`emotionalManipulation`)
   - Sympathy tactics
   - Over-friendly social engineering
   - Threat + help combo

3. **Authority Patterns** (`authorityValidation`)
   - RBI circular references
   - Legal threats
   - Brand impersonation
   - Professional formal language

4. **Contextual Patterns** (`contradiction`)
   - False compliance trap
   - Identity switching
   - Multi-channel claims

5. **Urgency Patterns** (`urgency`)
   - Time-based threats
   - Deadline pressure
   - "Already done" pressure

6. **Multilingual Patterns** (`multilingual`)
   - Hindi/Hinglish code-switching
   - Language mixing

7. **Technical Patterns** (`professionalScam`)
   - Fake technical jargon
   - Error codes
   - System messages

8. **Aggression Patterns** (`aggression`)
   - Rage phase
   - Abusive language

## 🧪 20 Edge-Case Scenarios

### Group 1: Slow-Burn & Professional Scams

#### 1️⃣ Slow-Burn Scam
- **Pattern**: `slow_burn_escalation` (behavioral)
- **Detection**: No urgency initially, urgency increases over time
- **Agent Response**: "Earlier you were calm, now suddenly urgent?"
- **Test validation**: Tracks urgency count across multiple turns

#### 2️⃣ Polite Professional Scam
- **Pattern**: `professionalScam`, `authorityValidation`
- **Detection**: Formal language without threats
- **Agent Response**: Asks for clarification despite politeness
- **Test validation**: Detects "as discussed", "thank you for cooperation"

### Group 2: Direction & Channel Manipulation

#### 3️⃣ Reverse Scam (Victim Initiates)
- **Pattern**: Standard detection (`banking`, `urgency`)
- **Detection**: Direction-agnostic, detects scam intent regardless of who started
- **Agent Response**: Maintains detection from turn 2 onwards
- **Test validation**: Scam detected even when user initiates

#### 4️⃣ Multi-Channel Threat
- **Pattern**: `authority` + `urgency`
- **Detection**: Claims of SMS/email for legitimacy
- **Agent Response**: Asks for reference number
- **Test validation**: Detects authority claims

### Group 3: Technical & Emotional Manipulation

#### 5️⃣ Fake Technical Jargon
- **Pattern**: `professionalScam`
- **Detection**: Error codes, technical terms (IMPS timeout, error code 392)
- **Agent Response**: Asks for simple explanation
- **Test validation**: Detects "error code", "IMPS timeout"

#### 6️⃣ Sympathy Scam
- **Pattern**: `emotionalManipulation`
- **Detection**: "my job depends", "will lose job"
- **Agent Response**: Shows empathy but maintains caution
- **Test validation**: Handler `handleEmotionalManipulation()` triggers

### Group 4: Authority & References

#### 7️⃣ Authority Name-Dropping
- **Pattern**: `authorityValidation`
- **Detection**: RBI circular, section numbers, government orders
- **Agent Response**: Asks for circular number or official link
- **Test validation**: Handler `handleAuthorityClaims()` triggers

#### 8️⃣ Language Switching
- **Pattern**: `multilingual` + `urgency`
- **Detection**: Hindi/Hinglish keywords (abhi karo, jaldi, bhej do)
- **Agent Response**: Maintains suspicion despite language switch
- **Test validation**: Detects "abhi karo", "jaldi"

### Group 5: Pressure & History Manipulation

#### 9️⃣ "Already Done" Pressure
- **Pattern**: `urgency` + `behavioral`
- **Detection**: False history claims ("already tried", "already warned")
- **Agent Response**: Questions timeline
- **Test validation**: Detects "already" + urgency

#### 🔟 False Compliance Trap
- **Pattern**: `contradiction`
- **Detection**: "No money needed" → asks for money later
- **Agent Response**: Calls out contradiction
- **Test validation**: Handler `handleContradiction()` detects context.saidNoMoney

### Group 6: Cognitive & Identity Tactics

#### 1️⃣1️⃣ Multiple Requests in One Message
- **Pattern**: `multipleRequests`
- **Detection**: "Click and send and confirm"
- **Agent Response**: Asks to do one step at a time
- **Test validation**: Handler `handleMultipleRequests()` triggers

#### 1️⃣2️⃣ Fake Escalation to Senior
- **Pattern**: `contradiction` (identity_switch)
- **Detection**: "This is X" → "Now speaking to Y"
- **Agent Response**: Questions person change
- **Test validation**: Tracks context.introducedAs

### Group 7: Time & Amount Tactics

#### 1️⃣3️⃣ Time-Based Threat
- **Pattern**: `urgency` + `deadline_bluff`
- **Detection**: "blocked at 6 PM", "2 hours left"
- **Agent Response**: Delays action
- **Test validation**: Detects specific time mentions

#### 1️⃣4️⃣ Small Amount Test
- **Pattern**: `banking`
- **Detection**: "₹1", "₹5", "just for verification"
- **Agent Response**: Asks why money needed for verification
- **Test validation**: Detects "₹1", "₹5"

### Group 8: Brand & Social Engineering

#### 1️⃣5️⃣ Trusted Brand Impersonation
- **Pattern**: `brandImpersonation` + `phishing`
- **Detection**: "Amazon support", "Google Pay", "Paytm customer care"
- **Agent Response**: Asks where this appears in official app
- **Test validation**: Detects brand names in patterns

#### 1️⃣6️⃣ Over-Friendly Scam
- **Pattern**: `emotionalManipulation` (over_friendly)
- **Detection**: "brother trust me", "I will help you"
- **Agent Response**: Friendly but cautious
- **Test validation**: Handler `handleEmotionalManipulation()` triggers

### Group 9: Mixed Tactics & Repetition

#### 1️⃣7️⃣ Threat + Help Combo
- **Pattern**: `emotionalManipulation` (threat_with_help)
- **Detection**: "blocked" + "don't worry I'll help"
- **Agent Response**: Confused by mixed emotions
- **Test validation**: Detects simultaneous threat and reassurance

#### 1️⃣8️⃣ Silent Pressure (Repetition)
- **Pattern**: `repetitionIndicators` + `silent_pressure_repetition`
- **Detection**: Same message repeated multiple times
- **Agent Response**: "Why do you keep repeating?"
- **Test validation**: Handler `handleRepetition()` counts similarities

### Group 10: Legal Threats & Rage

#### 1️⃣9️⃣ Fake Legal Action
- **Pattern**: `authorityValidation` + `urgency`
- **Detection**: "legal action", "court case", "section 420"
- **Agent Response**: Asks for case number
- **Test validation**: Handler `handleAuthorityClaims()` triggers

#### 2️⃣0️⃣ Final Rage/Abuse Phase
- **Pattern**: `aggression`
- **Detection**: "stupid", "wasting time", "useless", "nonsense"
- **Agent Response**: Stays calm, doesn't escalate
- **Test validation**: Handler `handleAggression()` triggers first

## 🔄 How Detection Works

### Detection Flow

```
Incoming Message
    ↓
1. Build conversation context (track history)
    ↓
2. Check edge-case handlers (PRIORITY)
   - Aggression
   - Repetition
   - Contradiction
   - Authority claims
   - Emotional manipulation
   - Multiple requests
   - Slow-burn escalation
    ↓
3. If edge case detected → Return specialized response
    ↓
4. Otherwise → Proceed with standard scam-type responses
    ↓
5. Apply human imperfections (20% chance)
```

### Context Tracking

The system tracks:
- **Standard**: UPI IDs, phone numbers, URLs, amounts, urgency count
- **Edge cases**: repetition count, "no money" claims, introducer identity, slow-burn flags

## 🧪 Running the Tests

### Command

```bash
# Start server first
npm run dev

# In another terminal, run edge-case tests
node test-edge-cases.js
```

### Test Output

Each test shows:
- Turn-by-turn conversation
- Agent responses  
- Scam detection status
- Confidence scores
- Risk levels
- Detected patterns
- Validation results

### Expected Results

- **Slow-burn**: Detects `slow_burn_escalation` after turn 3
- **Contradiction**: Detects when "no money" claim is violated
- **Repetition**: Agent notices after 2-3 identical messages
- **Aggression**: Handler triggers immediately on abusive language
- **Authority**: Agent asks for proof/reference numbers
- **Emotional**: Shows empathy but maintains skepticism

## ✅ Validation Criteria

### Test Passes If:
1. ✅ Scam is detected (isScam: true)
2. ✅ Appropriate patterns are identified
3. ✅ Agent response matches expected behavior
4. ✅ No errors during conversation
5. ✅ Context tracking works correctly

### Common Detection Patterns:
- **banking** - KYC, account verification, UPI scams
- **phishing** - Prizes, links, fake offers
- **emotionalManipulation** - Sympathy, friendship, threats+help
- **authorityValidation** - Legal, government, brand claims
- **urgency** - Time pressure, deadlines
- **contradiction** - False compliance, identity switches
- **repetitionIndicators** - Silent pressure
- **aggression** - Rage, abuse

## 🎯 Key Implementation Points

### 1. Pattern Reusability
Instead of 20 separate handlers, we have:
- 9 pattern categories
- 7 edge-case response handlers  
- 4 advanced detection helpers

### 2. Priority System
Edge-case handlers check FIRST, before standard responses:
```javascript
// Check aggression FIRST (highest priority)
let edgeCaseResponse = handleAggression(msg);
if (edgeCaseResponse) return edgeCaseResponse;

// Then check contradiction
edgeCaseResponse = handleContradiction(context, msg);
if (edgeCaseResponse) return edgeCaseResponse;

// ... other handlers

// Finally, standard scam-type responses
```

### 3. Context Awareness
Agent remembers:
- What scammer claimed before
- How many times urgency mentioned  
- If "no money" was said
- Who introduced themselves
- Repetition patterns

### 4. Scalability
Adding new edge cases is easy:
1. Map to existing pattern(s)
2. OR add new pattern to `keywordRules.js`
3. OR add new handler function if behavior is unique
4. Add test scenario to `test-edge-cases.js`

## 📈 Success Metrics

**Expected Performance:**
- Detection Rate: 95%+ (all scams detected)
- False Positives: <5% (normal messages not flagged)
- Agent Appropriateness: 90%+ (responses match scenario)
- Context Memory: 100% (all tracked items remembered)

**Pattern Coverage:**
- All 20 scenarios map to at least one detection pattern
- Most scenarios trigger 2-3 patterns simultaneously
- Edge-case handlers provide specialized responses

## 🔧 Troubleshooting

### If a test fails:

1. **Check server status**: Is `npm run dev` running?
2. **Check API key**: Matches in both `.env` and test file
3. **View detection details**: Check `data.debug.detectedCategories`
4. **Check patterns**: View `advancedDetector.js` analysis scores
5. **Verify context**: Ensure `buildConversationContext()` tracking works

### Common Issues:

- **Pattern not detected**: Add keyword to `keywordRules.js`
- **Agent doesn't notice**: Check handler priority order
- **Context not tracked**: Verify `buildConversationContext()` logic
- **Too many false positives**: Adjust detection thresholds

## 🚀 Next Steps

1. Run full test suite: `node test-edge-cases.js`
2. Check success rate in final summary
3. Review any failed tests
4. Fine-tune patterns or handlers as needed
5. Add more scenarios following the same pattern mapping approach

---

**Key Takeaway**: The system detects edge cases through **reusable patterns**, not hardcoded scenarios. This makes it robust, scalable, and easy to extend.
