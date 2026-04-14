const path = require('path');
const servicePath = path.resolve(__dirname, '../backend/src/services/chatbotService');
const { processMessage } = require(servicePath);

async function testSimulatedResponse() {
  console.log('Testing Chatbot Simulation Fallback...');
  
  // Note: Since I can't easily trigger a Firestore quota error here without actual network, 
  // I will verify that the processMessage call doesn't crash and returns a valid object.
  // Given that the quota error is active in the environment, this should trigger the simulation.
  
  try {
    const result = await processMessage('test-user-id', 'Tell me about my sales performance');
    console.log('Chatbot Reply:', result.reply);
    console.log('Source:', result.source);
    
    if (result.reply.includes('sample data') || result.reply.includes('simulated')) {
      console.log('SUCCESS: Simulation fallback detected.');
    }
  } catch (error) {
    console.error('FAILED: Service crashed during simulation test:', error);
  }
}

testSimulatedResponse().catch(console.error);
