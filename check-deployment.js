// Check if the deployment is working
// Run this in your browser console

async function checkDeployment() {
  console.log('🔍 Checking deployment status...');
  
  try {
    // Check if we can access the round state
    const stateResponse = await fetch('/api/round/state?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    
    console.log('State endpoint status:', stateResponse.status);
    
    if (stateResponse.ok) {
      const state = await stateResponse.json();
      console.log('Current round state:', state);
      
      // Test the End Round endpoint
      console.log('Testing End Round endpoint...');
      const endResponse = await fetch('/api/round/end?ts=' + Date.now(), {
        method: 'POST',
        cache: 'no-store',
        headers: { 
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('End Round status:', endResponse.status);
      const endText = await endResponse.text();
      console.log('End Round response:', endText);
      
      if (endResponse.status === 400 && endText.includes('Missing roundId')) {
        console.log('💡 The old version is still running. Testing with roundId...');
        
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
        const endText2 = await endResponse2.text();
        console.log('End Round with roundId response:', endText2);
        
        if (endResponse2.ok) {
          console.log('✅ SUCCESS! The End Round button works when we send roundId');
          console.log('🔧 The issue is that the frontend needs to send roundId in the request body');
        }
      }
    } else {
      console.error('❌ State endpoint failed:', stateResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkDeployment();
