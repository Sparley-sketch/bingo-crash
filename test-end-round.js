// Test script to verify End Round functionality
// Run this in your browser console on the admin page

async function testEndRound() {
  console.log('🧪 Testing End Round functionality...');
  
  try {
    // Step 1: Check current round state
    console.log('📊 Checking current round state...');
    const stateResponse = await fetch('/api/round/state?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const state = await stateResponse.json();
    console.log('Current state:', state);
    
    // Step 2: Start a round if none exists
    if (!state.id || state.phase === 'setup') {
      console.log('🚀 Starting a new round...');
      const startResponse = await fetch('/api/round/start?ts=' + Date.now(), {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const startResult = await startResponse.json();
      console.log('Start result:', startResult);
    }
    
    // Step 3: Wait a moment for round to be live
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Check state again
    const stateResponse2 = await fetch('/api/round/state?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const state2 = await stateResponse2.json();
    console.log('State after start:', state2);
    
    if (state2.phase !== 'live') {
      console.error('❌ Round is not live, cannot test End Round');
      return;
    }
    
    // Step 5: Test End Round
    console.log('🛑 Testing End Round...');
    const endResponse = await fetch('/api/round/end?ts=' + Date.now(), {
      method: 'POST',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const endResult = await endResponse.json();
    console.log('End result:', endResult);
    
    if (endResponse.ok) {
      console.log('✅ End Round API call successful!');
      
      // Step 6: Verify the round was ended
      await new Promise(resolve => setTimeout(resolve, 1000));
      const stateResponse3 = await fetch('/api/round/state?ts=' + Date.now(), {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const state3 = await stateResponse3.json();
      console.log('Final state:', state3);
      
      if (state3.phase === 'ended') {
        console.log('🎉 SUCCESS: End Round button is working correctly!');
      } else {
        console.error('❌ Round phase is not "ended":', state3.phase);
      }
    } else {
      console.error('❌ End Round API call failed:', endResult);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testEndRound();
