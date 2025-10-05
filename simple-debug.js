// Simple debug script for End Round button (works with existing endpoints)
// Run this in your browser console on the admin page

async function simpleDebug() {
  console.log('🔍 Simple debug for End Round button...');
  
  try {
    // Step 1: Check if we can access the round state
    console.log('📊 Checking round state endpoint...');
    const stateResponse = await fetch('/api/round/state?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    
    console.log('State response status:', stateResponse.status);
    console.log('State response headers:', Object.fromEntries(stateResponse.headers.entries()));
    
    if (!stateResponse.ok) {
      console.error('❌ State endpoint failed:', stateResponse.status, stateResponse.statusText);
      const errorText = await stateResponse.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const state = await stateResponse.json();
    console.log('Current state:', state);
    
    // Step 2: Test End Round with detailed logging
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
    
    // Try to get response text first to see what we're getting
    const responseText = await endResponse.text();
    console.log('End Round response body (raw):', responseText);
    
    // Try to parse as JSON
    let endResult;
    try {
      endResult = JSON.parse(responseText);
      console.log('End Round response body (parsed):', endResult);
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', parseError);
      console.log('Response appears to be HTML or other format');
      return;
    }
    
    if (endResponse.ok) {
      console.log('✅ End Round API call successful!');
    } else {
      console.error('❌ End Round API call failed:', endResult);
      
      // Check if it's a database/connection issue
      if (endResult.error && endResult.error.includes('Failed to fetch round')) {
        console.log('💡 This suggests a database connection issue');
        console.log('Check your Supabase environment variables in Vercel');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed with error:', error);
  }
}

// Run the debug
simpleDebug();
