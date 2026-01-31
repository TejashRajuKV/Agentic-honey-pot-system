# Level 5 Bait Strategy - Implementation Guide

## 🎣 **What is Bait Strategy?**

Instead of immediately acting like a victim, the agent uses **strategic confusion and questioning** to:
1. Test if the scammer is legitimate
2. Trigger faster reveals (UPI IDs, phone numbers, urgency)
3. Detect evasive behavior
4. Build stronger evidence

---

## 🎯 **5 Bait Types**

### 1. **Confusion Play**
```
Scammer: "Your account will be blocked due to KYC"
Agent: "I'm not sure I understand. Which account are you referring to?"
```
**Triggers:** Banking/KYC messages  
**Purpose:** Make scammer explain details

### 2. **Verification Request**
```
Scammer: "You won ₹50,000 lottery!"
Agent: "That's interesting! Can you send official documentation about this?"
```
**Triggers:** Prize/lottery messages  
**Purpose:** Test legitimacy, scammers won't provide proof

### 3. **Hesitation Express**
```
Scammer: "Send your OTP to verify"
Agent: "I'm not comfortable sharing that. Why do you need it exactly?"
```
**Triggers:** Requests for sensitive info  
**Purpose:** Force scammer to reveal true intent

### 4. **Urgency Questioning**
```
Scammer: "Do this immediately or account blocked!"
Agent: "Why is this so urgent? What happens if I wait?"
```
**Triggers:** Urgency language  
**Purpose:** Expose pressure tactics

### 5. **Alternative Channel Request**
```
Scammer: "Share your details here"
Agent: "Can I visit the office instead? I prefer doing this in person."
```
**Triggers:** Contact requests  
**Purpose:** Legitimate services have official methods

---

## 🧠 **How It Works**

### **Decision Flow:**
```
Message arrives
↓
Scam detection (30-70% confidence)
↓
Use bait? → YES if:
  - Medium/Low risk
  - Early/mid phase
  - < 5 turns
↓
Generate bait response
↓
Analyze next scammer message
↓
Detect:
  - Evasion
  - Urgency escalation
  - Info reveal (UPI/phone/link)
```

### **Evasion Detection:**
After asking for proof, if scammer:
- Doesn't provide proof → Evasion +30%
- Gives vague answer → Evasion +25%
- Claims authority → Evasion +20%
- Deflects ("don't worry", "trust me") → Evasion +30%

### **Triggered Reveal Detection:**
Scammer reveals:
- UPI ID, phone number, or link → +50% reveal score
- Escalates urgency (2+ urgency words) → +40% urgency push

---

## 📊 **Tracking & Scoring**

**Session fields added:**
- `lastBaitType` - Which bait was used last
- `baitUsedCount` - How many baits deployed
- `evasionScore` - Cumulative evasion (0-1.0)
- `triggeredReveal` - Did bait force a reveal?

**Example progression:**
```
Turn 1: "Your account blocked due to KYC"
→ Bait: "Which account are you referring to?"
→ baitType: confusion_play

Turn 2: "Your main savings account! Update immediately!"
→ Analysis: evasionScore +0.25 (vague), urgency +0.4
→ New confidence: 75% (was 50%)
→ Bait: "Why such urgency? Let me verify with bank."

Turn 3: "Sir just send to verify@paytm quickly!"
→ Analysis: revealed UPI (+0.5), deflection (+0.3)
→ triggeredReveal: true
→ Confidence: 95%
→ Switch to full engagement
```

---

## 🎮 **Adaptive Strategy**

**Bait stops when:**
- Turn count > 5
- Confidence > 70% (switch to full engagement)
- Scammer triggered reveal (mission accomplished)

**Follow-up baits:**
- High evasion → Press harder for proof
- High urgency push → Express more suspicion
- Authority claims → Ask for credentials

---

## 🧪 **Testing Bait Strategy**

```bash
node interactive-test.js
```

**Test scenarios:**

**Scenario 1: Confusion Bait**
```
You: Your KYC is pending
Agent: 🎣 "Which account are you referring to?"
You: Main account! Do fast!
→ Evasion detected, urgency escalated
```

**Scenario 2: Verification Bait**
```
You: You won iPhone!
Agent: 🎣 "Can you send official documentation?"
You: No need sir, just pay fee
→ Evasion + payment request = High confidence
```

**Scenario 3: Triggered Reveal**
```
You: Account blocked
Agent: 🎣 "Is this really from the bank?"
You: Yes! Send OTP to verify@paytm now!
→ 🎯 Bait successful! Revealed UPI ID
```

---

## 📈 **Impact on Detection**

**Before Bait:**
- Scammer message: "Account issue"
- Detection: 40% confidence
- Agent: Acts like victim

**With Bait:**
- Scammer message: "Account issue"  
- Agent: 🎣 "Which account? Can you prove it?"
- Scammer: "Just send to verify@upi quickly!"
- Detection: 85% confidence (revealed UPI + urgency)
- Agent: Full engagement

**Result:** Faster, stronger detection with less ambiguity

---

## 🏆 **Hackathon Edge**

**Why this wins:**
1. **Novel approach** - Not just keyword matching
2. **Active defense** - Honeypot tests the scammer
3. **Faster intelligence** - Scammers reveal info sooner
4. **Behavioral analysis** - Tracks evasion patterns
5. **Adaptive** - Changes strategy based on responses

**Demo-ready features:**
- Real-time bait logging: `🎣 Using bait strategy: confusion_play`
- Success detection: `🎯 Bait successful! Revealed: UPI ID`
- Evasion tracking visible in dashboard

---

**Your honeypot now has the intelligence of a skilled investigator!** 🕵️
