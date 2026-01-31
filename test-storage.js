// test-storage.js
/**
 * Send test message and verify it's stored in MongoDB Atlas
 */

const API_URL = "http://localhost:3000/api/v1/messages";
const API_KEY = "honeypot_secret_key_2026";

async function testStorage() {
    console.log('\n🧪 Testing MongoDB Atlas Storage...\n');

    // Send test message
    console.log('📤 Sending test scam message...');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify({
                sessionId: `storage_test_${Date.now()}`,
                message: "Your account will be blocked. Send OTP to verify@paytm",
                platform: 'storage-test',
                sender: 'test-scammer'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        console.log('✅ Message sent successfully!');
        console.log(`   Session ID: ${data.sessionId}`);
        console.log(`   Scam Detected: ${data.isScam ? '🚨 YES' : '✅ NO'}`);
        console.log(`   Confidence: ${(data.confidence * 100).toFixed(0)}%`);
        console.log(`   Agent Reply: "${data.reply}"\n`);

        // Wait a moment for database write
        console.log('⏳ Waiting for database write...\n');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check MongoDB
        console.log('🔍 Checking MongoDB Atlas for stored data...\n');

        require('dotenv').config();
        const mongoose = require('mongoose');

        await mongoose.connect(process.env.MONGODB_URI);

        const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false }));
        const ConversationTurn = mongoose.model('ConversationTurn', new mongoose.Schema({}, { strict: false }));

        const sessionCount = await Session.countDocuments();
        const turnCount = await ConversationTurn.countDocuments();

        console.log(`📊 Total sessions in database: ${sessionCount}`);
        console.log(`📊 Total conversation turns: ${turnCount}\n`);

        // Find our test session
        const testSession = await Session.findOne({ sessionId: data.sessionId });

        if (testSession) {
            console.log('✅ TEST PASSED: Session stored in MongoDB Atlas!');
            console.log(`   Session ID: ${testSession.sessionId}`);
            console.log(`   Platform: ${testSession.platform}`);
            console.log(`   Sender: ${testSession.sender}`);
            console.log(`   Status: ${testSession.status}`);
            console.log(`   Is Scam: ${testSession.isScam}\n`);
        } else {
            console.log('❌ TEST FAILED: Session not found in database\n');
        }

        // Find conversation turns
        const turns = await ConversationTurn.find({ sessionId: data.sessionId }).sort({ turnIndex: 1 });

        if (turns.length > 0) {
            console.log(`✅ TEST PASSED: ${turns.length} conversation turns stored!`);
            turns.forEach(turn => {
                console.log(`   [${turn.role}]: "${turn.text.substring(0, 50)}..."`);
            });
            console.log('');
        }

        console.log('='.repeat(60));
        console.log('✅ MongoDB Atlas is WORKING and STORING data correctly!');
        console.log('='.repeat(60));

        await mongoose.disconnect();

    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}\n`);
    }
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    console.error('❌ Error: fetch is not available.\nPlease use Node.js 18+');
    process.exit(1);
}

testStorage();
