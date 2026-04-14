const fs = require('fs');
const path = require('path');
const { getFirestore } = require('../src/config/db');

/**
 * Data Upload Utility
 * Parses evaluator_chart_metrics_data.csv and uploads to Firestore salesData collection.
 */

async function uploadData() {
  console.log('🚀 Starting Data Upload Process...');

  const db = getFirestore();
  const csvPath = path.resolve(__dirname, '../../evaluator_chart_metrics_data.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  // 1. Find the target User ID (associating data with the first user found)
  console.log('🔍 Looking for an active user account...');
  const userSnapshot = await db.collection('users').limit(1).get();
  
  if (userSnapshot.empty) {
    console.error('❌ No users found in database. Please log in to the app first to create an account.');
    process.exit(1);
  }

  const userId = userSnapshot.docs[0].id;
  const userEmail = userSnapshot.docs[0].data().email;
  console.log(`✅ Associating data with User: ${userEmail} (${userId})`);

  // 2. Parse CSV
  console.log('📄 Reading CSV records...');
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  // Skip header if it exists
  const startIndex = lines[0].includes('productName') ? 1 : 0;
  const records = lines.slice(startIndex).map(line => {
    const [productName, sales, stock, date] = line.split(',').map(s => s.trim());
    return {
      userId,
      productName,
      sales: Number(sales || 0),
      stock: Number(stock || 0),
      date: new Date(date || Date.now()),
      createdAt: new Date(),
      source: 'csv_upload'
    };
  });

  console.log(`📊 Found ${records.length} records to upload.`);

  // 3. Batch Upload (limit 500 per batch per Firestore rules)
  const BATCH_SIZE = 500;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = records.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(record => {
      const docRef = db.collection('salesData').doc();
      batch.set(docRef, record);
    });

    console.log(`📤 Uploading batch ${Math.floor(i / BATCH_SIZE) + 1}...`);
    try {
      await batch.commit();
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} complete.`);
    } catch (error) {
      if (error.code === 8 || error.message.includes('Quota exceeded')) {
        console.error('🚨 FIRESTORE QUOTA EXCEEDED. Stopping upload. Some records may have been saved.');
        process.exit(1);
      }
      console.error(`❌ Error uploading batch: ${error.message}`);
    }
  }

  console.log('🎉 Data upload finished successfully!');
}

uploadData().catch(err => {
  console.error('❌ FATAL ERROR:', err);
  process.exit(1);
});
