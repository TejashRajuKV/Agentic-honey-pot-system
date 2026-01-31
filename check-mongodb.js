// check-mongodb.js
/**
 * Check if MongoDB Atlas is connected and storing data
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function checkMongoDB() {
    console.log('\n🔍 Checking MongoDB Atlas Connection...\n');
    console.log(`Connection String: ${process.env.MONGODB_URI?.replace(/\/\/(.+):(.+)@/, '//***:***@')}`);

    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Successfully connected to MongoDB Atlas!\n');

        // Check collections
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('📂 Collections in database:');
        if (collections.length === 0) {
            console.log('   ⚠️  No collections found (database is empty)\n');
        } else {
            for (const col of collections) {
                const count = await db.collection(col.name).countDocuments();
                console.log(`   - ${col.name}: ${count} documents`);
            }
            console.log('');
        }

        // Check Sessions
        const Session = mongoose.model('Session', new mongoose.Schema({}, { strict: false }));
        const sessionCount = await Session.countDocuments();
        console.log(`💾 Sessions stored: ${sessionCount}`);

        if (sessionCount > 0) {
            const latestSession = await Session.findOne().sort({ createdAt: -1 });
            console.log(`   Latest session: ${latestSession.sessionId}`);
            console.log(`   Created: ${latestSession.createdAt}`);
            console.log(`   Status: ${latestSession.status}`);
            console.log(`   Is Scam: ${latestSession.isScam}`);
        }
        console.log('');

        // Check ConversationTurns
        const ConversationTurn = mongoose.model('ConversationTurn', new mongoose.Schema({}, { strict: false }));
        const turnCount = await ConversationTurn.countDocuments();
        console.log(`💬 Conversation turns stored: ${turnCount}`);

        if (turnCount > 0) {
            const latestTurn = await ConversationTurn.findOne().sort({ timestamp: -1 });
            console.log(`   Latest message: "${latestTurn.text?.substring(0, 50)}..."`);
            console.log(`   Role: ${latestTurn.role}`);
            console.log(`   Timestamp: ${latestTurn.timestamp}`);
        }
        console.log('');

        console.log('='.repeat(60));
        console.log('✅ MongoDB Atlas is working and storing data!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ MongoDB Connection Error:');
        console.error(`   ${error.message}\n`);

        if (error.message.includes('authentication')) {
            console.log('💡 Fix: Check username/password in connection string');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
            console.log('💡 Fix: Check network access in MongoDB Atlas');
            console.log('   - Add IP address 0.0.0.0/0 for testing');
        }
        console.log('');
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB\n');
    }
}

checkMongoDB();
