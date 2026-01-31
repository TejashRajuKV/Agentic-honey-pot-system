# Agent Module

## Overview
This module handles AI-powered agent behavior, conversation management, and callback integration.

## Files

### `agentService.js`
- **Purpose**: Main agent orchestration service
- **Main Functions**:
  - `generateAgentResponse(userMessage, history, scamContext)` - Generates AI response

### `personaPrompts.js`
- **Purpose**: LLM prompt templates and persona configuration
- **Main Functions**:
  - `buildSystemPrompt(phase, categories)` - Creates system prompt for LLM
  - `buildAgentPrompt(userMessage, history, phase, categories)` - Builds full prompt with context
  - `getPhaseGuidelines(phase)` - Returns phase-specific behavioral guidelines

### `agentStateMachine.js`
- **Purpose**: Manages conversation state and phase transitions
- **Main Functions**:
  - `getConversationPhase(turnCount)` - Determines current phase (early/mid/late/final)
  - `shouldWrapUp(turnCount, intel)` - Decides if conversation should end
  - `getEngagementStrategy(phase, categories)` - Determines response strategy

### `conversationHandler.js`
- **Purpose**: Rule-based response generation (fallback)
- **Main Functions**:
  - `generateRuleBasedResponse(message, phase, categories)` - Generates contextual responses

### `callbackService.js`
- **Purpose**: Sends intelligence reports to evaluation platform
- **Main Functions**:
  - `sendFinalCallback(sessionId, intel, metadata)` - Sends final report
  - `formatIntelligenceReport(sessionId, intel)` - Formats report for logging

## Conversation Phases

1. **Early** (0-2 turns): Show interest, ask clarifying questions
2. **Mid** (3-5 turns): Build trust, request more details
3. **Late** (6-8 turns): Show compliance, ask for procedures
4. **Final** (9+ turns): Extract final details, prepare for wrap-up

## Usage Example

```javascript
const { generateAgentResponse } = require('./agentService');
const { shouldWrapUp } = require('./agentStateMachine');

// Generate response
const reply = await generateAgentResponse(
  "Your account will be blocked",
  conversationHistory,
  { categories: ['banking'], confidence: 0.85 }
);

// Check if should wrap up
const wrapUp = shouldWrapUp(turnCount, extractedIntel);
```
