// Test script to check if players are being reused
// Run this in browser console on your production site

async function testPlayerReuse() {
  console.log('🧪 Testing player reuse...');
  
  try {
    // First card purchase
    console.log('1. First card purchase...');
    const response1 = await fetch('/api/round/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        alias: 'TestUser',
        cardName: 'Test Card 1'
      })
    });
    
    const result1 = await response1.json();
    console.log('First card response:', response1.status, result1);
    
    // Second card purchase (should reuse player)
    console.log('2. Second card purchase (should reuse player)...');
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
    
    // Check if totalCards increased
    if (result1.totalCards && result2.totalCards) {
      console.log(`Total cards: ${result1.totalCards} -> ${result2.totalCards}`);
      if (result2.totalCards > result1.totalCards) {
        console.log('✅ Player reuse working - cards added to same player');
      } else {
        console.log('❌ Player reuse NOT working - new player created');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPlayerReuse();
