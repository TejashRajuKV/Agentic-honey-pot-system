const { AGENT_STATES, updateAgentState } = require('./agent/agentStateMachine');
const { governResponse } = require('./agent/responseGovernor');

const userMessage = "click on the link to get reward upto 5000 rupees";
const scamContext = { confidence: 0.9, riskLevel: 'HIGH_RISK', categories: ['phishing'] };
const currentState = AGENT_STATES.SAFE;

console.log("Testing with message:", userMessage);
const { state: nextState, scenario: fsmScenario } = updateAgentState(userMessage, scamContext, currentState);
console.log("Next State:", nextState);
console.log("Scenario:", fsmScenario);

const governed = governResponse(0.9, "I'll do it later", {
    fsmState: nextState,
    fsmScenario,
    userMessage
});

console.log("Governed Response:", governed.response);
console.log("Metadata:", JSON.stringify(governed.governorMetadata, null, 2));
