'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ScramblingoGame from '@/app/components/scramblingo/ScramblingoGame';

export default function PlayPage() {
  const [durationMs, setDurationMs] = useState(800);
  const [loading, setLoading] = useState(true);
  const [gameEnabled, setGameEnabled] = useState(true);
  const [alias, setAlias] = useState<string>('');
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [showPreloadVideo, setShowPreloadVideo] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [currentGame, setCurrentGame] = useState('bingo_crash');
  const [gameData, setGameData] = useState<any>(null);
  const [forceRender, setForceRender] = useState(0);
  const router = useRouter();
  
  // Use ref to always access the latest currentGame value in the polling interval
  const currentGameRef = useRef(currentGame);
  useEffect(() => {
    currentGameRef.current = currentGame;
  }, [currentGame]);

  // Watch for currentGame changes
  useEffect(() => {
    console.log('🎮 currentGame changed to:', currentGame);
    setForceRender(prev => prev + 1);
  }, [currentGame]);

  useEffect(() => {
    // Load alias from storage
    const storedAlias = localStorage.getItem('player_alias') || localStorage.getItem('bingo-alias');
    if (storedAlias) {
      setAlias(storedAlias);
      // Normalize to canonical key
      localStorage.setItem('player_alias', storedAlias);
    }

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

        // Get current game and game data
        // Use alias from state (set from localStorage above) or from localStorage directly
        const currentAlias = alias || localStorage.getItem('player_alias') || localStorage.getItem('bingo-alias') || '';
        const statusUrl = '/api/game/status?ts=' + Date.now() + (currentAlias ? `&alias=${encodeURIComponent(currentAlias)}` : '');
        const gameRes = await fetch(statusUrl, { cache: 'no-store' });
        if (gameRes.ok) {
          const gameData = await gameRes.json();
          console.log('🎮 Game data received:', gameData);
          setGameData(gameData);
          // Only show alias modal if:
          // 1. No alias stored locally AND
          // 2. Server confirms player doesn't exist
          const hasLocalAlias = currentAlias && currentAlias.trim().length > 0;
          if (!hasLocalAlias && gameData?.wallet && gameData.wallet.hasPlayer === false) {
            setShowAliasModal(true);
          } else if (hasLocalAlias) {
            // If we have a local alias, ensure it's set in state
            if (!alias && currentAlias) {
              setAlias(currentAlias);
            }
            // Hide modal if we have an alias
            setShowAliasModal(false);
          }
          
          // Check scheduler config for current game
          if (gameData.schedulerStatus?.currentGame) {
            console.log('🎮 Setting current game to:', gameData.schedulerStatus.currentGame);
            setCurrentGame(gameData.schedulerStatus.currentGame);
          } else {
            console.log('🎮 No currentGame in schedulerStatus, using default bingo_crash');
            setCurrentGame('bingo_crash');
          }
        } else {
          console.log('🎮 Failed to fetch game status, using default bingo_crash');
          setCurrentGame('bingo_crash');
        }
        
        // Also check for immediate game changes (in case admin just switched)
        const immediateAlias = alias || localStorage.getItem('player_alias') || localStorage.getItem('bingo-alias') || '';
        const immediateGameRes = await fetch('/api/game/status?ts=' + Date.now() + (immediateAlias ? `&alias=${encodeURIComponent(immediateAlias)}` : ''), { cache: 'no-store' });
        if (immediateGameRes.ok) {
          const immediateGameData = await immediateGameRes.json();
          if (immediateGameData.schedulerStatus?.currentGame) {
            console.log('🎮 Immediate check - current game:', immediateGameData.schedulerStatus.currentGame);
            setCurrentGame(immediateGameData.schedulerStatus.currentGame);
          }
        }
        
        // Add a few quick checks for immediate game changes
        for (let i = 0; i < 3; i++) {
          setTimeout(async () => {
            try {
              const quickAlias = alias || localStorage.getItem('player_alias') || localStorage.getItem('bingo-alias') || '';
              const quickRes = await fetch('/api/game/status?ts=' + Date.now() + (quickAlias ? `&alias=${encodeURIComponent(quickAlias)}` : ''), { cache: 'no-store' });
              if (quickRes.ok) {
                const quickData = await quickRes.json();
                if (quickData.schedulerStatus?.currentGame) {
                  console.log(`🎮 Quick check ${i + 1} - current game:`, quickData.schedulerStatus.currentGame);
                  setCurrentGame(quickData.schedulerStatus.currentGame);
                }
              }
            } catch (error) {
              console.error('Quick check error:', error);
            }
          }, (i + 1) * 500); // Check at 0.5s, 1s, 1.5s
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

    // Poll for game access changes and game switching every 5 seconds
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

        // Check for game changes
        const pollingAlias = alias || localStorage.getItem('player_alias') || localStorage.getItem('bingo-alias') || '';
        const gameRes = await fetch('/api/game/status?ts=' + Date.now() + (pollingAlias ? `&alias=${encodeURIComponent(pollingAlias)}` : ''), { cache: 'no-store' });
        if (gameRes.ok) {
          const gameData = await gameRes.json();
          console.log('🎮 Polling - received game data:', gameData);
          setGameData(gameData);
          
          // Only show alias modal if no local alias and server says no player
          const hasLocalAlias = pollingAlias && pollingAlias.trim().length > 0;
          if (!hasLocalAlias && gameData?.wallet && gameData.wallet.hasPlayer === false) {
            setShowAliasModal(true);
          } else if (hasLocalAlias) {
            setShowAliasModal(false);
          }
          
          if (gameData.schedulerStatus?.currentGame) {
            const newGame = gameData.schedulerStatus.currentGame;
            const currentGameValue = currentGameRef.current; // Use ref to get latest value
            console.log('🎮 Polling - current game in data:', newGame, 'current state (from ref):', currentGameValue);
            if (newGame !== currentGameValue) {
              console.log('🎮 Game changed from', currentGameValue, 'to', newGame);
              setCurrentGame(newGame);
              // Force a re-render by updating state
              console.log('🎮 UI should now switch to:', newGame);
              // Force a re-render by updating gameData as well
              setGameData(gameData);
            } else {
              console.log('🎮 Polling - game unchanged:', newGame);
            }
          } else {
            console.log('🎮 Polling - no currentGame in schedulerStatus:', gameData.schedulerStatus);
          }
        } else {
          console.log('🎮 Polling - failed to fetch game status:', gameRes.status);
        }
      } catch (error) {
        console.error('Error polling game access:', error);
      }
    }, 1000); // 1 second to detect game changes faster

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
        width: '100vw',
        background: '#0f1220',
        position: 'relative',
        overflow: 'hidden',
        // Mobile-specific fixes
        minHeight: '100vh',
        minWidth: '100vw'
      }}>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
              50% { opacity: 0.7; transform: translateX(-50%) scale(1.05); }
            }
            
            /* Mobile-specific video scaling - prevent zoom-in while filling screen */
            @media screen and (max-width: 768px) {
              video {
                object-fit: cover !important;
                width: 100vw !important;
                height: 100vh !important;
                object-position: center !important;
                /* Prevent excessive zoom on very wide screens */
                max-width: 100vw !important;
                max-height: 100vh !important;
              }
            }
            
            /* Landscape mobile - ensure proper aspect ratio */
            @media screen and (max-width: 768px) and (orientation: landscape) {
              video {
                object-fit: cover !important;
                width: 100vw !important;
                height: 100vh !important;
                object-position: center center !important;
              }
            }
            
            /* Portrait mobile - prevent vertical zoom */
            @media screen and (max-width: 768px) and (orientation: portrait) {
              video {
                object-fit: cover !important;
                width: 100vw !important;
                height: 100vh !important;
                object-position: center center !important;
              }
            }
            
            /* Very small screens - prevent extreme zoom */
            @media screen and (max-width: 480px) {
              video {
                object-fit: cover !important;
                object-position: center center !important;
                /* Ensure video doesn't exceed screen bounds */
                max-width: 100vw !important;
                max-height: 100vh !important;
              }
            }
            
            /* Prevent zoom-in by using transform scale */
            @media screen and (max-width: 768px) {
              video {
                transform: scale(1) !important;
                transform-origin: center center !important;
              }
            }
            
            /* Handle different aspect ratios to prevent zoom */
            @media screen and (max-aspect-ratio: 16/9) {
              video {
                object-fit: cover !important;
                object-position: center center !important;
              }
            }
            
            @media screen and (max-aspect-ratio: 4/3) {
              video {
                object-fit: cover !important;
                object-position: center center !important;
              }
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
            backgroundColor: '#0f1220',
            // Prevent zoom-in on mobile by ensuring proper scaling
            minWidth: '100%',
            minHeight: '100%',
            // Center the video content
            objectPosition: 'center'
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

  // Debug: Show current game state
  console.log('🎮 Play page render - currentGame:', currentGame, 'gameData:', gameData);
  console.log('🎮 Play page render - schedulerStatus:', gameData?.schedulerStatus);
  console.log('🎮 Play page render - currentGame from scheduler:', gameData?.schedulerStatus?.currentGame);


  // Show Scramblingo game if selected
  if (currentGame === 'scramblingo') {
    console.log('🎮 Showing Scramblingo game. Current game:', currentGame, 'forceRender:', forceRender);
    return (
      <main key={`scramblingo-${forceRender}`} className="wrap" style={{ maxWidth: 'unset', padding: 0, background: '#0f1220', minHeight: '100vh' }}>
        {showAliasModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
            <div style={{ background:'#111936', color:'#fff', padding:20, borderRadius:12, width:360, border:'1px solid rgba(255,255,255,.15)' }}>
              <div style={{ fontSize:18, fontWeight:800, marginBottom:10 }}>Choose Alias</div>
              <input
                value={alias}
                onChange={e => setAlias(e.target.value)}
                placeholder="Enter alias"
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,.2)', background:'#0c1020', color:'#fff', marginBottom:12 }}
              />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => setShowAliasModal(false)} style={{ padding:'8px 14px', background:'#666', color:'#fff', border:'none', borderRadius:8 }}>Cancel</button>
                <button
                  onClick={async () => {
                    const clean = alias.trim();
                    if (!clean) return;
                    try {
                      const res = await fetch('/api/player/upsert', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ alias: clean }) });
                      const j = await res.json();
                      if (res.ok && j?.wallet?.alias) {
                        localStorage.setItem('player_alias', clean);
                        localStorage.setItem('bingo-alias', clean);
                        setShowAliasModal(false);
                        const r = await fetch('/api/game/status?ts=' + Date.now() + '&alias=' + encodeURIComponent(clean), { cache:'no-store' });
                        if (r.ok) setGameData(await r.json());
                      }
                    } catch {}
                  }}
                  style={{ padding:'8px 14px', background:'#2b6cff', color:'#fff', border:'none', borderRadius:8 }}
                >Save</button>
              </div>
            </div>
          </div>
        )}
        {/* Sequence overlay removed as it is now visible in Admin */}
        <ScramblingoGame 
          alias={gameData?.wallet?.alias || alias || 'TestPlayer'}
          walletBalance={gameData?.wallet?.balance ?? 1000}
          roundId={gameData?.roundState?.id}
        />
      </main>
    );
  }

  // Show Bingo Crash game (explicit check, same pattern as Scramblingo)
  if (currentGame === 'bingo_crash') {
    const src = `/bingo-v37/index.html?round_ms=${durationMs}`;
    console.log('🎮 Showing Bingo Crash game. Current game:', currentGame, 'forceRender:', forceRender);
    return (
      <main key={`bingo-crash-${forceRender}`} className="wrap" style={{ maxWidth: 'unset', padding: 0 }}>
        <iframe
          key={`iframe-${forceRender}`}
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

  // Fallback - should never reach here
  return (
    <main className="wrap" style={{ maxWidth: 'unset', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <h2>Unknown Game</h2>
        <p>Current game: {currentGame}</p>
      </div>
    </main>
  );
}
