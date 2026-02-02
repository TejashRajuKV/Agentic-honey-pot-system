// run-all-tests.js
/**
 * Master Test Runner
 * Runs all test suites in sequence
 */

const { spawn } = require('child_process');
const path = require('path');

const testSuites = [
    { name: 'Advanced Detection Layers', file: 'test-advanced-detection.js', requiresServer: false },
    { name: 'Bait Strategy (Unit Tests)', file: 'test-bait-strategy.js', requiresServer: false },
    { name: 'Multi-Turn Conversations', file: 'test-multi-turn.js', requiresServer: true },
    { name: 'Bait Strategy (Integration)', file: 'test-bait-strategy.js', requiresServer: true },
    { name: 'Comprehensive Test Suite', file: 'comprehensive-test.js', requiresServer: true },
    { name: 'Basic Honeypot Tests', file: 'test-honeypot.js', requiresServer: true }
];

async function runTestFile(testFile) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [testFile], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Test failed with exit code ${code}`));
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

async function checkServerAvailable() {
    try {
        const response = await fetch('http://localhost:3000/', {
            method: 'GET'
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function runAllTests() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 HONEYPOT AGENT - MASTER TEST RUNNER');
    console.log('='.repeat(80));

    const serverAvailable = await checkServerAvailable();

    console.log(`\nServer Status: ${serverAvailable ? '✅ Running' : '❌ Not running'}`);

    if (!serverAvailable) {
        console.log('\n⚠️  Warning: Some integration tests require the server to be running.');
        console.log('   Start server with: npm run dev');
        console.log('   Unit tests will still run.\n');
    }

    let passedSuites = 0;
    let failedSuites = 0;
    let skippedSuites = 0;

    for (const suite of testSuites) {
        console.log('\n' + '='.repeat(80));
        console.log(`📋 Running: ${suite.name}`);
        console.log(`   File: ${suite.file}`);
        console.log('='.repeat(80));

        // Skip integration tests if server not available
        if (suite.requiresServer && !serverAvailable) {
            console.log(`\n⏭️  SKIPPED (requires server)\n`);
            skippedSuites++;
            continue;
        }

        try {
            await runTestFile(suite.file);
            console.log(`\n✅ ${suite.name} - PASSED\n`);
            passedSuites++;
        } catch (error) {
            console.log(`\n❌ ${suite.name} - FAILED`);
            console.log(`   Error: ${error.message}\n`);
            failedSuites++;
        }

        // Delay between test suites
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nTotal Test Suites: ${testSuites.length}`);
    console.log(`✅ Passed: ${passedSuites}`);
    console.log(`❌ Failed: ${failedSuites}`);
    console.log(`⏭️  Skipped: ${skippedSuites}`);

    const successRate = ((passedSuites / (passedSuites + failedSuites)) * 100).toFixed(1);
    console.log(`\nSuccess Rate: ${successRate}%`);

    if (skippedSuites > 0) {
        console.log(`\n⚠️  ${skippedSuites} test suite(s) skipped. Start server for full coverage.`);
    }

    console.log('\n' + '='.repeat(80));

    // Exit with appropriate code
    process.exit(failedSuites > 0 ? 1 : 0);
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    console.error('❌ Error: fetch is not available.');
    console.error('Please use Node.js 18+ or install node-fetch.');
    process.exit(1);
}

runAllTests().catch(error => {
    console.error('\n❌ Fatal error running tests:', error);
    process.exit(1);
});
