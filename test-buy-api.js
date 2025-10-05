// Test script to debug the buy API calls
// Run this in browser console on your production site

async function testBuyAPI() {
  console.log('🧪 Testing buy API calls...');
  
  try {
    // Test single card purchase
    console.log('1. Testing single card purchase...');
    const response = await fetch('/api/round/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        alias: 'TestUser',
        cardName: 'Test Card'
      })
    });
    
    const result = await response.json();
    console.log('Single card response:', response.status, result);
    
    if (!response.ok) {
      console.error('❌ Single card failed:', result);
      return;
    }
    
    // Test second card purchase (should reuse player)
    console.log('2. Testing second card purchase (should reuse player)...');
    const response2 = await fetch('/api/round/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        alias: 'TestUser',
        cardName: 'Test Card 2'
      })
    });
    
    const result2 = await response2.json();
    console.log('Second card response:', response2.status, result2);
    
    if (!response2.ok) {
      console.error('❌ Second card failed:', result2);
    } else {
      console.log('✅ Second card succeeded:', result2);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBuyAPI();
