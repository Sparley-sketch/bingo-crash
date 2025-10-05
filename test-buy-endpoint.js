// Test script to debug the buy endpoint
// Run this in browser console on your production site

async function testBuyEndpoint() {
  console.log('Testing buy endpoint...');
  
  try {
    const response = await fetch('/api/round/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        alias: 'test-user-' + Date.now(),
        cardName: 'Test Card'
      })
    });
    
    const result = await response.json();
    console.log('Buy endpoint response:', response.status, result);
    
    if (!response.ok) {
      console.error('Buy endpoint failed:', result);
    } else {
      console.log('✅ Buy endpoint working!');
    }
  } catch (error) {
    console.error('❌ Buy endpoint error:', error);
  }
}

// Test the endpoint
testBuyEndpoint();
