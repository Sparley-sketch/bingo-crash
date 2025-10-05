// Debug script to diagnose End Round button issues
// Run this in your browser console on the admin page

async function debugEndRound() {
  console.log('🔍 Debugging End Round button issues...');
  
  try {
    // Step 1: Check environment variables
    console.log('📋 Checking environment variables...');
    const envResponse = await fetch('/api/debug/env?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const envData = await envResponse.json();
    console.log('Environment check:', envData);
    
    if (!envData.hasSupabaseUrl || !envData.hasServiceKey) {
      console.error('❌ Missing environment variables!');
      console.log('You need to set:');
      console.log('- NEXT_PUBLIC_SUPABASE_URL');
      console.log('- SUPABASE_SERVICE_ROLE_KEY');
      return;
    }
    
    // Step 2: Test database connection
    console.log('🗄️ Testing database connection...');
    const dbResponse = await fetch('/api/debug/db?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const dbData = await dbResponse.json();
    console.log('Database check:', dbData);
    
    if (!dbData.success) {
      console.error('❌ Database connection failed:', dbData.error);
      return;
    }
    
    // Step 3: Check current round state
    console.log('📊 Checking current round state...');
    const stateResponse = await fetch('/api/round/state?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const state = await stateResponse.json();
    console.log('Current state:', state);
    
    // Step 4: Test End Round with detailed logging
    console.log('🛑 Testing End Round with detailed logging...');
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
    
    const endResult = await endResponse.json();
    console.log('End Round response body:', endResult);
    
    if (endResponse.ok) {
      console.log('✅ End Round API call successful!');
    } else {
      console.error('❌ End Round API call failed:', endResult);
    }
    
  } catch (error) {
    console.error('❌ Debug failed with error:', error);
  }
}

// Run the debug
debugEndRound();
