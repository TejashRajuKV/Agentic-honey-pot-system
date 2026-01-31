// interactive-test.js
/**
 * Interactive honeypot testing tool
 * Type your messages and see the agent respond in real-time!
 */

const readline = require('readline');

const API_URL = "http://localhost:3000/api/v1/messages";
const API_KEY = "honeypot_secret_key_2026";
const SESSION_ID = `interactive_${Date.now()}`;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n🐝 INTERACTIVE HONEYPOT TEST');
console.log('================================\n');
console.log(`Session ID: ${SESSION_ID}`);
console.log('Type your message and press Enter');
console.log('Type "exit" to quit\n');
console.log('================================\n');

async function sendMessage(userMessage) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: userMessage,
                platform: 'interactive-test'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        console.log('\n' + '─'.repeat(60));
        console.log(`🤖 Agent: ${data.reply}`);
        console.log('─'.repeat(60));

        if (data.isScam) {
            console.log(`\n⚠️  Scam Detected! Confidence: ${(data.confidence * 100).toFixed(0)}%`);
            console.log(`   Phase: ${data.engagementPhase} | Status: ${data.status}`);
        }

        if (data.debug) {
            console.log(`\n🔍 Categories: ${data.debug.detectedCategories.join(', ') || 'none'}`);
            if (data.debug.extractedIntel.upiIds.length > 0) {
                console.log(`   💳 UPI IDs: ${data.debug.extractedIntel.upiIds.join(', ')}`);
            }
            if (data.debug.extractedIntel.phoneNumbers.length > 0) {
                console.log(`   📱 Phone: ${data.debug.extractedIntel.phoneNumbers.join(', ')}`);
            }
            if (data.debug.extractedIntel.urls.length > 0) {
                console.log(`   🔗 URLs: ${data.debug.extractedIntel.urls.join(', ')}`);
            }
        }

        console.log('');

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}\n`);
    }
}

function promptUser() {
    rl.question('You: ', async (answer) => {
        const trimmed = answer.trim();

        if (trimmed.toLowerCase() === 'exit') {
            console.log('\n👋 Goodbye!\n');
            rl.close();
            return;
        }

        if (!trimmed) {
            promptUser();
            return;
        }

        await sendMessage(trimmed);
        promptUser();
    });
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    console.error('❌ Error: fetch is not available.');
    console.error('Please use Node.js 18+ or install node-fetch.');
    process.exit(1);
}

// Start the interactive session
promptUser();
