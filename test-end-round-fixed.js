// Test script for the fixed End Round button
// Run this in your browser console on the admin page

async function testEndRoundFixed() {
  console.log('🧪 Testing fixed End Round functionality...');
  
  try {
    // Step 1: Check current round state
    console.log('📊 Checking current round state...');
    const stateResponse = await fetch('/api/round/state?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const state = await stateResponse.json();
    console.log('Current state:', state);
    
    if (!state.id) {
      console.log('🚀 Starting a new round first...');
      const startResponse = await fetch('/api/round/start?ts=' + Date.now(), {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const startResult = await startResponse.json();
      console.log('Start result:', startResult);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 2: Test End Round with roundId in body
    console.log('🛑 Testing End Round with roundId...');
    const endResponse = await fetch('/api/round/end?ts=' + Date.now(), {
      method: 'POST',
      cache: 'no-store',
      headers: { 
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roundId: state.id })
    });
    
    console.log('End Round response status:', endResponse.status);
    const endResult = await endResponse.json();
    console.log('End Round response:', endResult);
    
    if (endResponse.ok) {
      console.log('✅ End Round API call successful!');
      
      // Step 3: Verify the round was ended
      await new Promise(resolve => setTimeout(resolve, 1000));
      const stateResponse2 = await fetch('/api/round/state?ts=' + Date.now(), {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const state2 = await stateResponse2.json();
      console.log('Final state:', state2);
      
      if (state2.phase === 'ended') {
        console.log('🎉 SUCCESS: End Round button is working correctly!');
      } else {
        console.log('⚠️ Round phase is:', state2.phase, '(expected: ended)');
      }
    } else {
      console.error('❌ End Round API call failed:', endResult);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testEndRoundFixed();
