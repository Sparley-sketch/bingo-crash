'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlayPage() {
  const [durationMs, setDurationMs] = useState(800);
  const [loading, setLoading] = useState(true);
  const [gameEnabled, setGameEnabled] = useState(true);
  const [showPreloadVideo, setShowPreloadVideo] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if this is the first visit (no localStorage flag)
    const hasSeenPreload = localStorage.getItem('bingo-crash-preload-seen');
    if (!hasSeenPreload) {
      setShowPreloadVideo(true);
      // Mark as seen for future visits
      localStorage.setItem('bingo-crash-preload-seen', 'true');
    }

    // Try to enable audio on user interaction
    const enableAudioOnInteraction = () => {
      setVideoMuted(false);
      document.removeEventListener('click', enableAudioOnInteraction);
      document.removeEventListener('touchstart', enableAudioOnInteraction);
      document.removeEventListener('keydown', enableAudioOnInteraction);
    };

    // Listen for any user interaction to enable audio
    document.addEventListener('click', enableAudioOnInteraction);
    document.addEventListener('touchstart', enableAudioOnInteraction);
    document.addEventListener('keydown', enableAudioOnInteraction);

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

        // Simple background loading indicator (no actual preloading to avoid conflicts)
        setBackgroundLoading(true);
        
        // Simulate background loading without interfering with game assets
        setTimeout(() => {
          console.log('🎮 Background loading completed');
          setBackgroundLoading(false);
        }, 2000); // 2 second delay to show loading indicator
      } catch (error) {
        console.error('Error checking game settings:', error);
        // On error, allow access (fail open)
      } finally {
        setLoading(false);
      }
    };

    // Initial check
    checkGameAccess();

    // Poll for game access changes every 20 seconds (security requirement)
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
    }, 20000); // 20 seconds instead of 2 seconds

    return () => clearInterval(interval);
  }, [router]);

  // Handle video events
  const handleVideoEnded = () => {
    console.log('🎬 Preload video ended');
    setVideoEnded(true);
    setShowPreloadVideo(false);
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('❌ Preload video error:', e);
    setShowPreloadVideo(false);
    setVideoEnded(true);
  };

  // Function to reset preload video (for testing)
  const resetPreloadVideo = () => {
    localStorage.removeItem('bingo-crash-preload-seen');
    setShowPreloadVideo(true);
    setVideoEnded(false);
  };

  // Add keyboard shortcut for testing (Ctrl+Shift+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        console.log('🔄 Resetting preload video');
        resetPreloadVideo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show preload video on first visit
  if (showPreloadVideo) {
    return (
      <main style={{ 
        maxWidth: 'unset', 
        padding: 0, 
        margin: 0,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#0f1220',
        position: 'relative'
      }}>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
              50% { opacity: 0.7; transform: translateX(-50%) scale(1.05); }
            }
          `
        }} />
        <video
          src="/bingo-v37/PreLoad_shield_break.mp4"
          autoPlay
          muted={videoMuted}
          playsInline
          preload="metadata"
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
            backgroundColor: '#0f1220'
          }}
        />
        {backgroundLoading && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fff',
            fontSize: '14px',
            zIndex: 2,
            background: 'rgba(0,0,0,0.7)',
            padding: '8px 16px',
            borderRadius: '8px'
          }}>
            Loading game assets...
          </div>
        )}
        
        {/* Audio prompt */}
        {videoMuted && (
          <div style={{
            position: 'absolute',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fff',
            fontSize: '16px',
            zIndex: 2,
            background: 'rgba(0,0,0,0.8)',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '2px solid #4ade80',
            textAlign: 'center',
            animation: 'pulse 2s infinite',
            boxShadow: '0 0 20px rgba(74, 222, 128, 0.5)'
          }}>
            🔊 Click anywhere to enable sound
          </div>
        )}
        
        {/* Control buttons */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 3,
          display: 'flex',
          gap: '8px'
        }}>
          {/* Mute/Unmute button */}
          <button
            onClick={() => {
              setVideoMuted(!videoMuted);
              console.log(`🔊 Video ${!videoMuted ? 'muted' : 'unmuted'}`);
            }}
            style={{
              background: 'rgba(0,0,0,0.7)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.9)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.7)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
            }}
          >
            {videoMuted ? '🔇' : '🔊'} {videoMuted ? 'Unmute' : 'Mute'}
          </button>
          
          {/* Skip button */}
          <button
            onClick={() => {
              console.log('⏭️ Video skipped by user');
              handleVideoEnded();
            }}
            style={{
              background: 'rgba(0,0,0,0.7)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.9)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.7)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
            }}
          >
            Skip Intro
          </button>
        </div>
      </main>
    );
  }

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
        style={{ 
          border: 'none', 
          width: '100%', 
          height: '100vh',
          background: '#0f1220' // Match video background
        }}
        title="Bingo + Crash"
        loading="eager"
        allow="autoplay; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </main>
  );
}
