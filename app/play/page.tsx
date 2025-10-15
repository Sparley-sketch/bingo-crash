'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlayPage() {
  const [durationMs, setDurationMs] = useState(800);
  const [loading, setLoading] = useState(true);
  const [gameEnabled, setGameEnabled] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check game access and duration settings
    const checkGameAccess = async () => {
      try {
        // Check game access status
        const accessRes = await fetch('/api/game-access', { cache: 'no-store' });
        if (accessRes.ok) {
          const accessData = await accessRes.json();
          const isEnabled = accessData.enabled !== false;
          setGameEnabled(isEnabled);
          
          // If game is disabled, redirect to 404
          if (!isEnabled) {
            console.log('🔒 Game access is DISABLED - redirecting to 404');
            window.location.href = '/404';
            return;
          }
        }

        // Get duration settings
        const durationRes = await fetch('/api/config/get?key=round.duration_ms', { cache: 'no-store' });
        if (durationRes.ok) {
          const durationData = await durationRes.json();
          const raw = typeof durationData.value === 'number' ? durationData.value : Number(durationData.value);
          if (Number.isFinite(raw) && raw >= 100 && raw <= 5000) {
            setDurationMs(raw);
          }
        }
      } catch (error) {
        console.error('Error checking game settings:', error);
        // On error, allow access (fail open)
      } finally {
        setLoading(false);
      }
    };

    // Initial check
    checkGameAccess();

    // Poll for game access changes every 2 seconds
    const interval = setInterval(async () => {
      try {
        const accessRes = await fetch('/api/game-access', { cache: 'no-store' });
        if (accessRes.ok) {
          const accessData = await accessRes.json();
          const isEnabled = accessData.enabled !== false;
          
          if (!isEnabled) {
            console.log('🔒 Game access was DISABLED - redirecting to 404');
            window.location.href = '/404';
            return;
          }
        }
      } catch (error) {
        console.error('Error polling game access:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [router]);

  if (loading) {
    return (
      <main className="wrap" style={{ maxWidth: 'unset', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <h2>Loading game...</h2>
          <p>Checking game access...</p>
        </div>
      </main>
    );
  }

  if (!gameEnabled) {
    return (
      <main className="wrap" style={{ maxWidth: 'unset', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <h2>Game Access Disabled</h2>
          <p>The game is currently disabled by an administrator.</p>
        </div>
      </main>
    );
  }

  const src = `/bingo-v37/index.html?round_ms=${durationMs}`;

  return (
    <main className="wrap" style={{ maxWidth: 'unset', padding: 0 }}>
      <iframe
        src={src}
        style={{ border: 'none', width: '100%', height: '100vh' }}
        title="Bingo + Crash"
      />
    </main>
  );
}
