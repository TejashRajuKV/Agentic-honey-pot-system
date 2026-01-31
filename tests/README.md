# Honeypot Backend - Tests

This directory will contain test files for the honeypot system.

## Planned Tests

### Unit Tests
- Detection module tests
- Intelligence extraction tests
- Agent response generation tests
- Session management tests

### Integration Tests
- Full message flow tests
- Database integration tests
- Callback service tests

### Example Test Structure

```
tests/
├── unit/
│   ├── detection.test.js
│   ├── intelligence.test.js
│   └── agent.test.js
├── integration/
│   ├── messageFlow.test.js
│   └── database.test.js
└── fixtures/
    └── sampleMessages.js
```

## Running Tests

```bash
# Install testing framework
npm install --save-dev jest

# Run tests
npm test
```

## Test Coverage

Currently using manual testing with `test-honeypot.js` in the root directory.

Future: Add Jest/Mocha for automated testing.
