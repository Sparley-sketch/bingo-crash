// Test environment variables in browser console
// Run this to check if env vars are working

async function testEnvVars() {
  console.log('🔍 Testing environment variables...');
  
  try {
    // Test if we can access the state endpoint
    const response = await fetch('/api/round/state?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    
    console.log('State endpoint status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ State endpoint working:', data);
      console.log('This means Supabase connection is working');
    } else {
      console.log('❌ State endpoint failed:', response.status);
      console.log('This suggests missing environment variables');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('This suggests deployment or environment issues');
  }
}

testEnvVars();
