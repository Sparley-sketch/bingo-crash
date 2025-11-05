'use client';

import { useState, useEffect } from 'react';
import ScramblingoGame from '@/app/components/scramblingo/ScramblingoGame';

export default function TestScramblingoPage() {
  const [alias, setAlias] = useState('');
  const [walletBalance, setWalletBalance] = useState(1000);
  const [roundId, setRoundId] = useState('test-round-' + Date.now());

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0f1220', 
      color: 'white',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
          🧪 Scramblingo Test Page
        </h1>
        
        <div style={{ 
          background: '#1a1a2e', 
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '20px' 
        }}>
          <h3>Test Configuration</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Player Alias:</label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Enter your alias"
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #333',
                  background: '#0c1020',
                  color: 'white',
                  width: '200px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Wallet Balance:</label>
              <input
                type="number"
                value={walletBalance}
                onChange={(e) => setWalletBalance(Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #333',
                  background: '#0c1020',
                  color: 'white',
                  width: '120px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Round ID:</label>
              <input
                type="text"
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #333',
                  background: '#0c1020',
                  color: 'white',
                  width: '200px'
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ 
          background: '#1a1a2e', 
          padding: '20px', 
          borderRadius: '12px' 
        }}>
          <h3>Game Component</h3>
          <ScramblingoGame 
            alias={alias || undefined}
            walletBalance={walletBalance}
            roundId={roundId}
          />
        </div>

        <div style={{ 
          background: '#1a1a2e', 
          padding: '20px', 
          borderRadius: '12px', 
          marginTop: '20px' 
        }}>
          <h3>Testing Instructions</h3>
          <ol style={{ lineHeight: '1.6' }}>
            <li>Enter a player alias (e.g., "TestPlayer")</li>
            <li>Set your wallet balance (default: 1000 coins)</li>
            <li>Click letters to build your card (1×6 format)</li>
            <li>Use "Random My Card!" to generate a random card</li>
            <li>Click "BUY" to purchase the card</li>
            <li>Test the drag-and-drop functionality</li>
            <li>Try purchasing multiple cards (up to 200)</li>
            <li>Test the letter selection and reset functionality</li>
          </ol>
          
          <div style={{ marginTop: '20px', padding: '15px', background: '#16213e', borderRadius: '8px' }}>
            <h4>API Endpoints to Test:</h4>
            <ul style={{ fontFamily: 'monospace', fontSize: '14px' }}>
              <li>POST /api/scramblingo/cards - Create/purchase cards</li>
              <li>GET /api/game/status - Get game status</li>
              <li>POST /api/scheduler/control - Switch games in admin</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


