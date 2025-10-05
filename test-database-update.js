// Test script to debug database update issues
// Run this in browser console on your production site

async function testDatabaseUpdate() {
  console.log('🧪 Testing database update...');
  
  try {
    // Test the state endpoint first
    console.log('1. Testing state endpoint...');
    const stateResponse = await fetch('/api/round/state?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const stateData = await stateResponse.json();
    console.log('State response:', stateData);
    
    if (!stateData.id) {
      console.error('❌ No round ID found in state');
      return;
    }
    
    // Test a simple update via the end endpoint (which we know works)
    console.log('2. Testing end round endpoint...');
    const endResponse = await fetch('/api/round/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId: stateData.id })
    });
    const endData = await endResponse.json();
    console.log('End response:', endData);
    
    // Test start round endpoint
    console.log('3. Testing start round endpoint...');
    const startResponse = await fetch('/api/round/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId: stateData.id })
    });
    const startData = await startResponse.json();
    console.log('Start response:', startData);
    
    if (!startResponse.ok) {
      console.error('❌ Start round failed:', startData);
    } else {
      console.log('✅ Start round succeeded:', startData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDatabaseUpdate();
