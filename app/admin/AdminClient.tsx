'use client';

import * as React from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type RoundState = {
  id: string | null;
  phase: 'setup' | 'live' | 'ended' | string;
  speed_ms: number;
  called: number[];
  created_at: string | null;
  live_cards_count?: number;
  player_count?: number;
};

export default function AdminClient() {
  const CFG_KEY = 'round.duration_ms';

  // Config UI
  const [cfgValue, setCfgValue] = React.useState('1500');
  const [saving, setSaving] = React.useState(false);

  // Round state
  const [state, setState] = React.useState<RoundState | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Polling + Auto-run
  const [pollMs, setPollMs] = React.useState(1500);
  const [polling, setPolling] = React.useState(true);
  const [autoRun, setAutoRun] = React.useState(false);

  // Game Access Control
  const [gameEnabled, setGameEnabled] = React.useState(true);

  // Scheduler state
  const [schedulerConfig, setSchedulerConfig] = React.useState<any>(null);
  const [schedulerStatus, setSchedulerStatus] = React.useState<any>(null);
  const [preBuySeconds, setPreBuySeconds] = React.useState(30);
  const [isEditingPreBuy, setIsEditingPreBuy] = React.useState(false);
  const isEditingRef = React.useRef(false); // For preventing polling while editing

  // Pricing state
  const [cardPrice, setCardPrice] = React.useState(10);
  const [shieldPricePercent, setShieldPricePercent] = React.useState(50);
  const [isEditingPrice, setIsEditingPrice] = React.useState(false);

  // Session management state
  const [sessionTimeout, setSessionTimeout] = React.useState(30 * 60 * 1000); // 30 minutes in milliseconds
  const [lastActivity, setLastActivity] = React.useState(Date.now());
  const [sessionWarning, setSessionWarning] = React.useState(false);
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const [timeUntilExpiry, setTimeUntilExpiry] = React.useState(30 * 60); // seconds

  // Game switching state
  const [currentGame, setCurrentGame] = React.useState('bingo_crash');
  const [userSelectedGame, setUserSelectedGame] = React.useState(false); // Track if user manually selected
  const [availableGames, setAvailableGames] = React.useState([
    { id: 'bingo_crash', name: 'Bingo Crash', description: 'Classic bingo with crash mechanics' },
    { id: 'scramblingo', name: 'Scramblingo', description: 'Letter-based bingo with 1x6 cards' }
  ]);

  // ---------------- session management ----------------
  const supabase = createClientComponentClient();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // Clear any local storage or session data
      localStorage.clear();
      sessionStorage.clear();
      // Redirect to login
      window.location.href = '/admin/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      window.location.href = '/admin/login';
    }
  };

  const resetSessionTimeout = () => {
    setLastActivity(Date.now());
    setSessionWarning(false);
    setSessionExpired(false);
  };

  const extendSession = () => {
    resetSessionTimeout();
    setTimeUntilExpiry(30 * 60); // Reset to 30 minutes
  };

  // Activity tracking
  const trackActivity = () => {
    resetSessionTimeout();
  };

  // ---------------- helpers ----------------
  async function fetchStateOnce() {
    try {
      const r = await fetch(`/api/round/state?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        next: { revalidate: 0 },
      });
      if (!r.ok) {
        console.warn('⚠️  /api/round/state returned', r.status);
        return state as any;
      }
      const json = (await r.json().catch(() => (state as any))) as RoundState;
      console.log('📊 Fetched state:', json);
      if (json) setState(json);
      return json;
    } catch (e) {
      console.error('⚠️  Failed to fetch /api/round/state:', e);
      return state as any;
    }
  }

  async function post(path: string) {
    setBusy(path);
    try {
      const body = path.includes('/api/round/') && state?.id ? { roundId: state.id } : undefined;
      console.log(`🚀 Calling ${path} with body:`, body);
      
      const r = await fetch(`${path}?ts=${Date.now()}`, {
          method: 'POST',
        cache: 'no-store',
        headers: { 
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      
      if (!r.ok && r.status !== 409) {
        const err = await r.json().catch(() => ({} as any));
        console.warn(`⚠️  ${path} returned ${r.status}`, err);
      } else {
        const response = await r.json().catch(() => ({}));
        console.log(`📡 Response from ${path}:`, response);
      }
      
      // Re-pull twice to avoid race with DB write
      console.log('🔄 Fetching state after API call...');
      await fetchStateOnce();
      await new Promise((res) => setTimeout(res, 120));
      await fetchStateOnce();
      console.log('✅ State fetch completed');
    } finally {
      setBusy(null);
    }
  }

  // Config endpoints
  async function loadConfig() {
      const r = await fetch(`/api/config/get?key=${encodeURIComponent(CFG_KEY)}&ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        next: { revalidate: 0 },
      });
      const j = await r.json();
      if (j?.value != null) setCfgValue(String(j.value));
  }
  
  async function saveConfig() {
    setSaving(true);
    try {
      await fetch(`/api/config/set?ts=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ key: CFG_KEY, value: cfgValue }),
      });
      await fetchStateOnce();
    } finally {
      setSaving(false);
    }
  }

  async function loadSchedulerConfig() {
    const r = await fetch(`/api/game/status?ts=${Date.now()}`, { cache: 'no-store' });
    const data = await r.json();
    console.log('🎮 Admin - Loading scheduler config:', data);
    if (data?.schedulerStatus) {
      setSchedulerConfig(data.schedulerStatus);
      if (data.schedulerStatus.preBuyMinutes != null) {
        setPreBuySeconds(data.schedulerStatus.preBuyMinutes * 60);
      }
      // Only set currentGame if user hasn't manually selected a game
      if (data.schedulerStatus.currentGame && !userSelectedGame) {
        console.log('🎮 Admin - Setting current game from config (no user selection):', data.schedulerStatus.currentGame);
        setCurrentGame(data.schedulerStatus.currentGame);
      } else if (userSelectedGame) {
        console.log('🎮 Admin - Preserving user-selected game:', currentGame);
      }
    }
  }

  async function startScheduler() {
    try {
      // Convert seconds to minutes (divide by 60)
      const preBuyMinutes = preBuySeconds / 60;
      const res = await fetch('/api/scheduler/control', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', preBuyMinutes, winnerDisplaySeconds: 1, gameType: currentGame })
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) {
        alert(`Start scheduler failed: ${j.error || res.statusText}`);
      } else {
        // Reload scheduler config
        await loadSchedulerConfig();
      }
    } catch (error) {
      console.error('Error starting scheduler:', error);
      alert('Error starting scheduler');
    }
  }

  async function stopScheduler() {
    try {
      setBusy('stop');
      setAutoRun(false);
      setPolling(false);
      const res = await fetch('/api/scheduler/control', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) {
        alert(`Stop scheduler failed: ${j.error || res.statusText}`);
      } else {
        // Optimistically reflect stopped state immediately
        setSchedulerConfig(prev => ({
          ...(prev || {} as any),
          enabled: false,
          nextGameStart: null,
          currentPhase: 'manual'
        }));
        setSchedulerStatus(prev => ({
          ...(prev || {} as any),
          enabled: false,
          timeUntilNextGame: null,
          currentPhase: 'manual',
          nextGameStart: null
        }));
        // Then confirm from server
        await loadSchedulerConfig();
      }
    } catch (error) {
      console.error('Error stopping scheduler:', error);
      alert('Error stopping scheduler');
    } finally { setBusy(null); setPolling(true); }
  }

  async function switchGame(gameType: string) {
    try {
      console.log(`🎮 Admin - Switching to game: ${gameType}`);
      const res = await fetch('/api/scheduler/control', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch_game', gameType })
      });
      const j = await res.json().catch(()=>({}));
      console.log(`🎮 Admin - API response:`, j);
      if (!res.ok) {
        alert(`Switch game failed: ${j.error || res.statusText}`);
      } else {
        console.log(`🎮 Admin - Setting current game to: ${gameType}`);
        setCurrentGame(gameType);
        setUserSelectedGame(true); // Mark that user manually selected this game
        // Don't reload scheduler config - it will override our selection
        // Just refresh game state
        await fetchStateOnce();
        console.log(`🎮 Admin - Switched to ${availableGames.find(g => g.id === gameType)?.name || gameType}`);
        // Don't show alert - just switch silently
      }
    } catch (error) {
      console.error('Error switching game:', error);
      alert('Error switching game');
    }
  }

  async function toggleGameAccess() {
    try {
      const newState = !gameEnabled;
      const res = await fetch('/api/game-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState })
      });

      if (res.ok) {
        setGameEnabled(newState);
        alert(`Game access ${newState ? 'ENABLED' : 'DISABLED'}. ${newState ? 'Players can now access the game.' : 'Game page will return 404 error.'}`);
      } else {
        alert('Failed to update game access');
      }
    } catch (error) {
      console.error('Error toggling game access:', error);
      alert('Error toggling game access');
    }
  }

  async function loadPricingConfig() {
    const r = await fetch(`/api/config/get?key=pricing&ts=${Date.now()}`, { cache: 'no-store' });
    const j = await r.json();
    if (j?.value) {
      setCardPrice(j.value.card_cost || 10);
      setShieldPricePercent(j.value.shield_cost_percent || 50);
    }
  }

  async function savePricing() {
    try {
      const res = await fetch('/api/config/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'pricing', 
          value: { 
            card_cost: cardPrice, 
            shield_cost_percent: shieldPricePercent 
          } 
        })
      });
      if (res.ok) {
        alert('Pricing saved!');
        setIsEditingPrice(false);
      } else {
        alert('Failed to save pricing');
      }
    } catch (error) {
      console.error('Error saving pricing:', error);
      alert('Error saving pricing');
    }
  }

  // ---------------- effects ----------------
  React.useEffect(() => {
    fetchStateOnce();
    loadConfig();
    loadSchedulerConfig();
    loadPricingConfig();
    // Load game access status
    fetch('/api/game-access?ts=' + Date.now(), { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setGameEnabled(data.enabled !== false))
      .catch(error => console.error('Error loading game access:', error));
  }, []);

  React.useEffect(() => {
    if (!polling) return;
    const id = setInterval(fetchStateOnce, Math.max(1200, pollMs));
    return () => clearInterval(id);
  }, [pollMs, polling]);

  // Session timeout monitoring
  React.useEffect(() => {
    const sessionTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      const remainingTime = Math.max(0, sessionTimeout - timeSinceLastActivity);
      
      setTimeUntilExpiry(Math.floor(remainingTime / 1000));
      
      if (remainingTime <= 0) {
        setSessionExpired(true);
        clearInterval(sessionTimer);
        return;
      }
      
      // Show warning 5 minutes before expiry
      if (remainingTime <= 5 * 60 * 1000 && !sessionWarning) {
        setSessionWarning(true);
      }
    }, 1000); // Check every second

    return () => clearInterval(sessionTimer);
  }, [lastActivity, sessionTimeout, sessionWarning]);

  // Auto-logout when session expires
  React.useEffect(() => {
    if (sessionExpired) {
      handleLogout();
    }
  }, [sessionExpired]);

  // Activity tracking - reset timeout on user interaction
  React.useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      trackActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, []);

  // Auto-run calls while LIVE
  React.useEffect(() => {
    if (!autoRun || state?.phase !== 'live') return;
    
    const speedMs = state!.speed_ms || 800;
    console.log(`🚀 ADMIN AUTO-RUN STARTED: Speed ${speedMs}ms`);
    
    const id = setInterval(() => {
      const callStartTime = Date.now();
      const callTimestamp = new Date().toISOString();
      
      console.log(`🎯 ADMIN TRIGGERING BALL CALL:`);
      console.log(`  📅 Timestamp: ${callTimestamp}`);
      console.log(`  ⏰ Scheduled Time: ${callStartTime}ms`);
      console.log(`  ⏱️  Expected Speed: ${speedMs}ms`);
      
      fetch('/api/round/call?ts=' + Date.now(), {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }).then(() => {
        const callEndTime = Date.now();
        const actualCallTime = callEndTime - callStartTime;
        console.log(`🏁 ADMIN BALL CALL COMPLETED: ${actualCallTime}ms`);
        fetchStateOnce();
      }).catch(error => {
        console.error('❌ ADMIN BALL CALL FAILED:', error);
      });
    }, speedMs);
    
    return () => {
      console.log(`🛑 ADMIN AUTO-RUN STOPPED`);
      clearInterval(id);
    };
  }, [autoRun, state?.phase, state?.speed_ms]);

  // Scheduler status polling
  React.useEffect(() => {
    let stop = false;
    async function loadSchedulerStatus() {
      try {
        const r = await fetch('/api/game/status', { cache: 'no-store' });
        const data = await r.json();
        if (!stop && data?.schedulerStatus) {
          setSchedulerStatus(data.schedulerStatus);
          // Don't override currentGame from polling - user selection takes priority
          console.log('🎮 Admin - Polling scheduler status, preserving user selection:', userSelectedGame ? currentGame : 'none');
        }
      } catch {}
    }
    loadSchedulerStatus();
    const t = setInterval(loadSchedulerStatus, 2000); // relax scheduler polling
    return () => { stop = true; clearInterval(t); };
  }, [userSelectedGame, currentGame]);

  // Handle complete scheduler cycle (auto-start, winner display, setup, next game)
  React.useEffect(() => {
    if (!schedulerConfig?.enabled) return;
    
    let stop = false;
    async function handleSchedulerCycle() {
      try {
        // Check for auto-start
        const autoStartResponse = await fetch('/api/scheduler/auto-start', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const autoStartData = await autoStartResponse.json();
        
        if (!stop && autoStartData.started) {
          console.log('Game started automatically via scheduler - enabling auto-run');
          // Enable auto-run for scheduled games
          setAutoRun(true);
          // Refresh scheduler config after auto-start
          const res = await fetch('/api/game/status');
          if (res.ok) {
            const data = await res.json();
            if (data?.schedulerStatus) {
              setSchedulerConfig(data.schedulerStatus);
            }
          }
          return;
        }

        // Check for cycle transitions (winner display -> setup -> next game)
        const cycleResponse = await fetch('/api/scheduler/cycle', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const cycleData = await cycleResponse.json();
        
        if (!stop && cycleData.action && cycleData.action !== 'none') {
          console.log('Scheduler cycle action:', cycleData.action,
            'New phase:', cycleData.newPhase);
          
          if (cycleData.action === 'setup') {
            console.log('Moved to setup phase - players can now purchase cards');
          } else if (cycleData.action === 'started') {
            console.log('Next game started automatically - enabling auto-run');
            setAutoRun(true);
          }
          
          // Refresh scheduler config after cycle action
          const res = await fetch('/api/game/status');
          if (res.ok) {
            const data = await res.json();
            if (data?.schedulerStatus) {
              setSchedulerConfig(data.schedulerStatus);
            }
          }
          // Also refresh main state to reflect new round/phase
          await fetchStateOnce();
        }
      } catch (error) {
        console.error('Scheduler cycle check failed:', error);
      }
    }
    
    handleSchedulerCycle();
    const t = setInterval(handleSchedulerCycle, 2000); // relax scheduler cycle checks
    return () => { stop = true; clearInterval(t); };
  }, [schedulerConfig?.enabled]);

  const phase = state?.phase ?? '—';
  const called = Array.isArray(state?.called) ? state!.called.length : 0;
  const maxBalls = currentGame === 'scramblingo' ? 52 : 25;
  const speed = (state?.speed_ms ?? Number(cfgValue)) || 800;
  const liveCards = state?.live_cards_count ?? 0;
  const playerCount = state?.player_count ?? 0;

  function formatTimeUntilNextGame(seconds: number): string {
    if (seconds === null || seconds <= 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return (
    <main className="wrap">
      <header className="header">
        <div className="row between">
          <div>
            <h1>Admin — Config</h1>
            <div className="status">
              <span>Phase: <b className="cap">{phase}</b></span>
              <span>· Called: <b>{called}</b>/{maxBalls}</span>
              <span>· Speed: <b>{speed}</b> ms</span>
              <span>· Session: <b>{Math.floor(timeUntilExpiry / 60)}:{(timeUntilExpiry % 60).toString().padStart(2, '0')}</b></span>
            </div>
          </div>
          <div className="actions">
            <button className="btn warn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Game Status Notification */}
      {phase === 'live' && (
        <section className="notification">
          <div className="notification-content">
            <div className="notification-icon">🎮</div>
            <div className="notification-text">
              <div className="notification-title">Game in Progress</div>
              <div className="notification-details">
                <span><b>{playerCount}</b> players</span>
                <span>·</span>
                <span><b>{liveCards}</b> live cards</span>
        </div>
        </div>
      </div>
        </section>
      )}

      {/* Session Warning Modal */}
      {sessionWarning && (
        <section className="session-warning-overlay">
          <div className="session-warning-modal">
            <div className="session-warning-icon">⚠️</div>
            <div className="session-warning-content">
              <h3>Session Expiring Soon</h3>
              <p>Your session will expire in {Math.floor(timeUntilExpiry / 60)}:{(timeUntilExpiry % 60).toString().padStart(2, '0')} due to inactivity.</p>
              <div className="session-warning-actions">
                <button className="btn primary" onClick={extendSession}>
                  Extend Session
                </button>
                <button className="btn" onClick={handleLogout}>
                  Logout Now
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Game Access Control */}
      <section className="card" style={{ 
        background: gameEnabled ? '#dcfce7' : '#fee2e2',
        border: gameEnabled ? '2px solid #22c55e' : '2px solid #ef4444'
      }}>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 8px 0', color: gameEnabled ? '#166534' : '#991b1b' }}>
              🔒 Game Access Control
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: gameEnabled ? '#15803d' : '#b91c1c' }}>
              {gameEnabled 
                ? '✅ Game is PUBLIC - Players can access /play' 
                : '❌ Game is BLOCKED - /play returns 404 error'}
            </p>
          </div>
          <button 
            className={gameEnabled ? 'btn' : 'btn primary'}
            onClick={toggleGameAccess}
            style={{ 
              minWidth: '120px',
              background: gameEnabled ? '#ef4444' : '#22c55e',
              color: '#fff',
              border: 'none',
              fontWeight: 'bold'
            }}
          >
            {gameEnabled ? '🔒 Disable Game' : '✅ Enable Game'}
          </button>
        </div>
      </section>

          {/* Config card */}
          <section className="card">
            <div className="row between">
              <div className="field">
                <label>Round Duration</label>
              <input 
                  className="input"
                  value={cfgValue}
                  onChange={(e) => setCfgValue(e.target.value)}
                  inputMode="numeric"
                  placeholder="ms"
                />
              </div>
              <div className="actions">
                <button className="btn primary" onClick={saveConfig} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
            </button>
                <button className="btn" onClick={loadConfig}>Reload</button>
          </div>
            </div>
          </section>

      {/* Pricing Section */}
      <section className="card">
        <h3>Pricing</h3>
        <div className="row between">
          <div className="field grow">
            <label>Card Price</label>
            <input
              className="input"
              type="number"
              value={cardPrice}
              onChange={e => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                  setCardPrice(value);
                }
              }}
              onFocus={() => isEditingRef.current = true}
              onBlur={() => isEditingRef.current = false}
              placeholder="coins"
              min="1"
              max="1000"
            />
          </div>
          <div className="field grow">
            <label>Shield Price (%)</label>
            <input
              className="input"
              type="number"
              value={shieldPricePercent}
              onChange={e => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                  setShieldPricePercent(value);
                }
              }}
              onFocus={() => isEditingRef.current = true}
              onBlur={() => isEditingRef.current = false}
              placeholder="%"
              min="0"
              max="100"
            />
          </div>
          <div className="actions">
            <button className="btn primary" onClick={savePricing}>
              Save
            </button>
          </div>
        </div>
        <div className="hint">
          Shield cost: {cardPrice * (shieldPricePercent / 100)} coins ({shieldPricePercent}% of card price)
        </div>
      </section>

      {/* Game Selection Section */}
      <section className="card">
        <h3>🎮 Game Selection</h3>
        <div className="row between">
          <div className="field grow">
            <label>Current Game</label>
            <div className="game-selection">
              {availableGames.map(game => (
                <button
                  key={game.id}
                  className={`game-btn ${currentGame === game.id ? 'active' : ''}`}
                  onClick={() => switchGame(game.id)}
                  disabled={!!busy}
                >
                  <div className="game-name">{game.name}</div>
                  <div className="game-desc">{game.description}</div>
                  {currentGame === game.id && (
                    <div className="active-indicator">✓ Active</div>
                  )}
                </button>
              ))}
            </div>
            <div className="game-status">
              <p>Selected game: <strong>{availableGames.find(g => g.id === currentGame)?.name || currentGame}</strong></p>
              <p>✅ UI switches immediately when you click a game button.</p>
              <p>🎮 Scheduler runs whatever game is currently selected.</p>
              {currentGame === 'scramblingo' && Array.isArray(state?.draw_order) && (
                <div style={{marginTop:8, color:'#b9c0d3'}}>
                  <div>Predetermined sequence (first 20):</div>
                  <div style={{fontFamily:'monospace', fontSize:12, wordBreak:'break-all'}}>
                    {(state.draw_order as number[]).slice(0,20).join(', ')}{(state.draw_order.length>20)?'…':''}
                  </div>
                  <div>Winner call index: <b>{state?.winner_call_index ?? '—'}</b></div>
                </div>
              )}
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={loadSchedulerConfig}>Reload</button>
          </div>
        </div>
      </section>

      {/* Games Scheduler Section */}
      <section className="card">
        <h3>Games Scheduler</h3>
        <div className="row between">
          <div className="field">
            <label>Pre-buy seconds</label>
              <input 
              className="input"
                type="number" 
                value={preBuySeconds} 
                onChange={e => {
                const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      setPreBuySeconds(value);
                }
              }}
              onFocus={() => isEditingRef.current = true}
              onBlur={() => isEditingRef.current = false}
              placeholder="seconds"
              min="10"
              max="3600"
            />
          </div>
          <div className="actions">
            <button className="btn" onClick={loadSchedulerConfig}>Reload</button>
            {schedulerStatus?.enabled && (
              <div className="scheduler-status">
                <div>Status: <b>{schedulerStatus.currentPhase}</b></div>
                <div>Next game in: <b>{formatTimeUntilNextGame(schedulerStatus.timeUntilNextGame || 0)}</b></div>
                <div>Pre-buy enabled: <b>{schedulerStatus.canPurchaseCards ? 'Yes' : 'No'}</b></div>
                <div>Current game: <b>{availableGames.find(g => g.id === currentGame)?.name || currentGame}</b></div>
            </div>
          )}
        </div>
      </div>

        <div className="row between" style={{ marginTop: '16px' }}>
          <div className="actions">
            <button className="btn success" onClick={startScheduler} disabled={!!busy || schedulerConfig?.enabled}>Start Scheduler</button>
            <button className="btn warn" onClick={stopScheduler} disabled={!!busy || !schedulerConfig?.enabled}>Stop Scheduler</button>
        </div>
      </div>
      </section>

      {/* Control card */}
      <section className="card" style={{ opacity: (schedulerConfig?.enabled) ? 0.6 : 1 }}>
        <div className="row between">
          <div className="title">Round Control · <span className="cap">{phase}</span> · {called}/{maxBalls}</div>
          <div className="row smgap">
            <label className="check"><input type="checkbox" checked={polling} onChange={e => setPolling(e.target.checked)} />Polling</label>
            <span>Poll: <b>{pollMs}</b> ms</span>
            <button className="btn" onClick={() => setPollMs(m => Math.max(250, m - 250))}>Faster</button>
            <button className="btn" onClick={() => setPollMs(m => Math.min(5000, m + 500))}>Slower</button>
            <button className="btn" onClick={fetchStateOnce}>Fetch Once</button>
          </div>
        </div>

        <div className="row smgap wrap">
          <button className="btn success" onClick={() => post('/api/round/start')} disabled={!!busy || schedulerConfig?.enabled}>Start Round</button>
          <button className="btn info"    onClick={() => post('/api/round/call')}  disabled={!!busy || schedulerConfig?.enabled || phase !== 'live'}>Call Next</button>
          <button className="btn warn"    onClick={() => post('/api/round/end')}   disabled={!!busy || schedulerConfig?.enabled}>End Round</button>
          <button className="btn purple"  onClick={() => post('/api/round/reset')} disabled={!!busy || schedulerConfig?.enabled}>Reset to Setup</button>

          <label className="check ml">
            <input type="checkbox" checked={autoRun} onChange={e => setAutoRun(e.target.checked)} disabled={schedulerConfig?.enabled} />
            Auto-run (uses speed_ms)
          </label>
        </div>
      </section>

      {/* Scoped styles (no Tailwind required) */}
      <style jsx>{`
        :global(html, body) { background:#0f1220; color:#fff; }
        .wrap { max-width: 1000px; margin: 0 auto; padding: 20px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .header h1 { margin: 0 0 6px; font-size: 28px; font-weight: 800; }
        .status { color:#b9c0d3; display:flex; gap:10px; flex-wrap:wrap; }
        .cap { text-transform: capitalize; }

        .card { background:#12162a; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:16px; margin-top:16px; box-shadow: 0 6px 20px rgba(0,0,0,.25); }
        .title { font-weight:600; color:#dfe6ff; }
        .row { display:flex; gap:12px; align-items:center; }
        .row.wrap { flex-wrap:wrap; }
        .row.between { justify-content:space-between; align-items:center; }
        .smgap { gap:8px; }
        .ml { margin-left:auto; }

        .field { margin-bottom:10px; }
        .field.grow { flex:1; }
        .field label { display:block; font-size:12px; color:#aab3cc; margin-bottom:6px; }
        .hint { margin:4px 0 0; font-size:12px; color:#9aa3bd; }

        .input { width:100%; background:#0c1020; color:#fff; border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:10px 12px; font-size:14px; outline:none; }
        .input:focus { border-color:#5b8cff; box-shadow:0 0 0 3px rgba(91,140,255,.25); }

        .actions { display:flex; gap:8px; align-items:center; }

        .btn { border:1px solid/: rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#e8eeff; padding:8px 12px; border-radius:10px; font-size:14px; cursor:pointer; transition:.15s; }
        .btn:hover { background:rgba(255,255,255,.12); }
        .btn:disabled { opacity:.5; cursor:not-allowed; }

        .primary { background:#2b6cff; border-color:#2b6cff; }
        .primary:hover { background:#3b77ff; }
        .success { background:#16a34a; border-color:#16a34a; }
        .success:hover { background:#22b357; }
        .info { background:#2081e2; border-color:#2081e2; }
        .info:hover { background:#2a8ff0; }
        .warn { background:#f59e0b; border-color:#f59e0b; color:#171923; }
        .warn:hover { background:#ffb31a; }
        .purple { background:#7c3aed; border-color:#7c3aed; }
        .purple:hover { background:#8b5cf6; }

        .check { display:inline-flex; align-items:center; gap:8px; font-size:14px; color:#c5cbe0; }

        .notification { background: linear-gradient(135deg, #1e3a8a, #1e40af); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 16px; margin-top: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); }
        .notification-content { display: flex; align-items: center; gap: 12px; }
        .notification-icon { font-size: 24px; }
        .notification-text { flex: 1; }
        .notification-title { font-weight: 600; color: #dbeafe; margin-bottom: 4px; }
        .notification-details { display: flex; align-items: center; gap: 8px; color: #bfdbfe; font-size: 14px; }

        .scheduler-status { padding: 12px; background: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 8px; margin-top: 12px; font-size: 14px; color: #000000; }
        .scheduler-status div { margin-bottom: 4px; color: #000000; }
        .scheduler-status div:last-child { margin-bottom: 0; }

        .session-warning-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .session-warning-modal { background: #1e293b; border: 2px solid #f59e0b; border-radius: 16px; padding: 24px; max-width: 400px; text-align: center; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); }
        .session-warning-icon { font-size: 48px; margin-bottom: 16px; }
        .session-warning-content h3 { color: #fbbf24; margin: 0 0 12px; font-size: 20px; font-weight: 600; }
        .session-warning-content p { color: #e2e8f0; margin: 0 0 20px; font-size: 16px; }
        .session-warning-actions { display: flex; gap: 12px; justify-content: center; }

        .game-selection { display: flex; gap: 12px; flex-wrap: wrap; }
        .game-btn { 
          background: rgba(255,255,255,.06); 
          border: 1px solid rgba(255,255,255,.12); 
          border-radius: 12px; 
          padding: 16px; 
          cursor: pointer; 
          transition: all 0.2s; 
          text-align: left;
          min-width: 200px;
        }
        .game-btn:hover:not(:disabled) { 
          background: rgba(255,255,255,.12); 
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .game-btn.active { 
          background: #2b6cff; 
          border-color: #2b6cff; 
          color: white;
        }
        .game-btn:disabled { 
          opacity: 0.5; 
          cursor: not-allowed; 
        }
        .game-name { 
          font-weight: 600; 
          font-size: 16px; 
          margin-bottom: 4px; 
        }
        .game-desc { 
          font-size: 12px; 
          color: rgba(255,255,255,0.7); 
        }
        .game-btn.active .game-desc { 
          color: rgba(255,255,255,0.9); 
        }
        .active-indicator {
          font-size: 12px;
          color: #4ade80;
          font-weight: bold;
          margin-top: 4px;
        }
        .game-status {
          margin-top: 15px;
          padding: 10px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          font-size: 14px;
          color: #aab3cc;
        }
        .game-status p {
          margin: 5px 0;
        }
      `}</style>
    </main>
  );
}