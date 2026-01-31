# Detection Module

## Overview
This module handles scam detection and intelligence extraction from incoming messages.

## Files

### `scamDetector.js`
- **Purpose**: Analyzes messages for scam patterns
- **Main Functions**:
  - `detectScamIntent(message)` - Returns scam detection result with confidence score
  - `analyzeConversationHistory(history)` - Analyzes entire conversation for scam patterns

### `intelligenceExtractor.js`
- **Purpose**: Extracts actionable intelligence from messages
- **Main Functions**:
  - `extractUpiIds(text)` - Extracts UPI payment IDs
  - `extractPhoneNumbers(text)` - Extracts phone numbers
  - `extractUrls(text)` - Extracts URLs and phishing links
  - `extractScamPhrases(text)` - Identifies scam-related phrases
  - `identifyBehavioralPatterns(text)` - Detects behavioral tactics
  - `extractIntelligence(text)` - Extracts all intelligence at once

### `keywordRules.js`
- **Purpose**: Defines scam patterns and phrases
- **Exports**:
  - `SCAM_PATTERNS` - Regex patterns for different scam types
  - `SCAM_PHRASES` - Common scam phrases

### `regex.js`
- **Purpose**: Regular expression patterns for data extraction
- **Exports**:
  - `UPI_PATTERN` - UPI ID pattern
  - `PHONE_PATTERNS` - Various phone number formats
  - `URL_PATTERN` - URL matching pattern

### `constants.js`
- **Purpose**: Detection-related constants
- **Exports**:
  - `VALID_UPI_HANDLES` - Known UPI payment handles
  - `DETECTION_THRESHOLDS` - Confidence score thresholds
  - `SCAM_CATEGORIES` - Scam type categories

## Usage Example

```javascript
const { detectScamIntent } = require('./scamDetector');
const { extractIntelligence } = require('./intelligenceExtractor');

const message = "Your account will be blocked. Send OTP to verify@paytm";

// Detect scam
const detection = await detectScamIntent(message);
console.log(detection.isScam); // true
console.log(detection.confidence); // 0.85

// Extract intelligence
const intel = extractIntelligence(message);
console.log(intel.upiIds); // ['verify@paytm']
console.log(intel.scamPhrases); // ['account will be blocked', 'send otp']
```
