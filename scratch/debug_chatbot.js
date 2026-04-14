const path = require('path');
const dbPath = path.resolve(__dirname, '../backend/src/config/db');
const envPath = path.resolve(__dirname, '../backend/src/config/env');

const { getFirestore } = require(dbPath);
const env = require(envPath);

async function test() {
  console.log('OpenAI Key Present (first 5 chars):', env.openAiApiKey ? env.openAiApiKey.slice(0, 5) : 'MISSING');
  console.log('AI Provider:', env.aiProvider);
  
  const db = getFirestore();
  if (!db) {
    console.log('Could not initialize Firestore');
    return;
  }
  
  const salesSnapshot = await db.collection('salesData').limit(1).get();
  if (salesSnapshot.empty) {
    console.log('salesData collection is empty');
  } else {
    console.log('Sample salesData record:', JSON.stringify(salesSnapshot.docs[0].data(), null, 2));
  }
  
  const inventorySnapshot = await db.collection('inventory').limit(1).get();
  if (inventorySnapshot.empty) {
    console.log('inventory collection is empty');
  } else {
    console.log('Sample inventory record:', JSON.stringify(inventorySnapshot.docs[0].data(), null, 2));
  }
}

test().catch(console.error);
