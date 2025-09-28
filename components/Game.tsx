'use client';
import { useEffect, useRef, useState } from 'react';

// TODO: Paste your Bingo Crash UI/logic here.
// This is only a placeholder to prove the route works.
export default function Game() {
  const [locked, setLocked] = useState(false);
  const [numbers, setNumbers] = useState<number[]>([]);

  useEffect(() => {
    // demo: random numbers as "calls"
    const id = setInterval(() => {
      setNumbers(prev => {
        const next = Math.floor(Math.random() * 42) + 1;
        return prev.length > 20 ? [next] : [...prev, next];
      });
    }, 800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card">
      <h2>Demo — Replace with your Bingo Crash</h2>
      <div className="row">
        <button className="btn" onClick={() => setLocked(v => !v)}>
          {locked ? 'Locked' : 'Lock'}
        </button>
        <div style={{ fontSize: 12, opacity: .8 }}>
          Tap lock to toggle (demo). Numbers are random to simulate calls.
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {numbers.map((n, i) => (
          <div key={i} style={{ background: '#0e0f1c', padding: 12, borderRadius: 12, textAlign: 'center' }}>{n}</div>
        ))}
      </div>
    </div>
  );
}
