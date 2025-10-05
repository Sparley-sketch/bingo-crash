// Quick debug script to check what's happening with the End Round button
// Run this in your browser console on the admin page

async function quickDebug() {
  console.log('🔍 Quick debug for End Round button...');
  
  try {
    // Step 1: Check if the deployment is live
    console.log('📊 Checking if deployment is live...');
    const stateResponse = await fetch('/api/round/state?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    
    console.log('State response status:', stateResponse.status);
    if (!stateResponse.ok) {
      console.error('❌ State endpoint failed:', stateResponse.status);
      return;
    }
    
    const state = await stateResponse.json();
    console.log('Current state:', state);
    
    // Step 2: Test End Round with detailed error logging
    console.log('🛑 Testing End Round endpoint...');
    const endResponse = await fetch('/api/round/end?ts=' + Date.now(), {
      method: 'POST',
      cache: 'no-store',
      headers: { 
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('End Round response status:', endResponse.status);
    console.log('End Round response headers:', Object.fromEntries(endResponse.headers.entries()));
    
    const responseText = await endResponse.text();
    console.log('End Round response body (raw):', responseText);
    
    // Try to parse as JSON
    try {
      const endResult = JSON.parse(responseText);
      console.log('End Round response body (parsed):', endResult);
      
      if (endResult.error) {
        console.error('❌ API Error:', endResult.error);
        
        // Check for specific error patterns
        if (endResult.error.includes('Missing roundId')) {
          console.log('💡 The production version still expects roundId parameter');
          console.log('🔧 Let me test with roundId...');
          
          // Test with roundId
          const endResponse2 = await fetch('/api/round/end?ts=' + Date.now(), {
            method: 'POST',
            cache: 'no-store',
            headers: { 
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roundId: state.id })
          });
          
          console.log('End Round with roundId status:', endResponse2.status);
          const responseText2 = await endResponse2.text();
          console.log('End Round with roundId response:', responseText2);
        }
      }
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', parseError);
      console.log('Response appears to be HTML or other format');
    }
    
  } catch (error) {
    console.error('❌ Debug failed with error:', error);
  }
}

// Run the debug
quickDebug();
