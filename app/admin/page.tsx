'use client';

import { useEffect, useState, useRef } from 'react';

export default function AdminPage() {
  const [round, setRound] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [schedulerConfig, setSchedulerConfig] = useState<any>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [preBuySeconds, setPreBuySeconds] = useState(30);
  const [loading, setLoading] = useState(true);
  const [isEditingPreBuy, setIsEditingPreBuy] = useState(false);
  const [isEditingSpeed, setIsEditingSpeed] = useState(false);
  const [autoOn, setAutoOn] = useState(false);
  const [speed, setSpeed] = useState(800);
  const [cardPrice, setCardPrice] = useState(10);
  const [shieldPricePercent, setShieldPricePercent] = useState(50);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const isEditingRef = useRef(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      // Only reload if user is not editing the pre-buy field
      if (!isEditingRef.current) {
        loadData();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isEditingPreBuy, isEditingSpeed]);

  // Handle complete scheduler cycle (auto-start, winner display, setup, next game)
  useEffect(() => {
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
          setAutoOn(true);
          // Refresh data after auto-start
          await loadData();
          return;
        }

        // Check for cycle transitions (winner display -> setup -> next game)
        const cycleResponse = await fetch('/api/scheduler/cycle', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const cycleData = await cycleResponse.json();
        
        console.log('Cycle endpoint response:', cycleData);
        
        if (!stop && cycleData.action && cycleData.action !== 'none') {
          console.log('Scheduler cycle action:', cycleData.action, 'New phase:', cycleData.newPhase);
          
          if (cycleData.action === 'setup') {
            console.log('Moved to setup phase - players can now purchase cards');
          } else if (cycleData.action === 'started') {
            console.log('Next game started automatically - enabling auto-run');
            setAutoOn(true);
          }
          
          // Refresh data after cycle action
          await loadData();
        }
      } catch (error) {
        console.error('Scheduler cycle check failed:', error);
      }
    }
    
    handleSchedulerCycle();
    const t = setInterval(handleSchedulerCycle, 1000); // Check every second
    return () => { stop = true; clearInterval(t); };
  }, [schedulerConfig?.enabled]);

  // Auto-run caller - automatically call balls when auto-run is enabled
  useEffect(() => {
    if (!autoOn || !round || round.phase !== 'live') return;
    
    const ms = round?.speed_ms || 800;
    const id = setInterval(async () => {
      try {
        await fetch('/api/round/call', { method: 'POST' });
      } catch (error) {
        console.error('Auto-call failed:', error);
      }
    }, ms);
    
    return () => clearInterval(id);
  }, [autoOn, round?.speed_ms, round?.phase]);

  async function loadData() {
    try {
      // Load round state
      const roundRes = await fetch('/api/round/state?ts=' + Date.now(), { cache: 'no-store' });
      if (roundRes.ok) {
        const roundData = await roundRes.json();
        setRound(roundData);
        // Don't override speed from round data - we want to use config value
        // The round data speed_ms is just for display, config is the source of truth
      }

      // Load config
      const configRes = await fetch('/api/config/get?key=round.duration_ms&ts=' + Date.now(), { cache: 'no-store' });
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
        // Set speed from config only if user is not currently editing it
        if (configData.value && !isEditingSpeed) {
          setSpeed(configData.value);
        }
      }

      // Load scheduler config
      const schedulerRes = await fetch('/api/scheduler?ts=' + Date.now(), { cache: 'no-store' });
      if (schedulerRes.ok) {
        const schedulerData = await schedulerRes.json();
        setSchedulerConfig(schedulerData);
        // Only update preBuySeconds if user is not currently editing
        // Convert from minutes to seconds (multiply by 60)
        if (!isEditingPreBuy) {
          const minutes = schedulerData.preBuyMinutes || 2;
          const seconds = minutes * 60;
          // Ensure the value is within our valid range (10-60 seconds)
          const validSeconds = Math.max(10, Math.min(60, seconds));
          console.log('Loading scheduler config:', { minutes, seconds, validSeconds, isEditingPreBuy });
          setPreBuySeconds(validSeconds);
        }
      }

      // Load scheduler status
      const statusRes = await fetch('/api/scheduler/status?ts=' + Date.now(), { cache: 'no-store' });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSchedulerStatus(statusData);
      }

      // Load pricing config
      const pricingRes = await fetch('/api/pricing?ts=' + Date.now(), { cache: 'no-store' });
      if (pricingRes.ok) {
        const pricingData = await pricingRes.json();
        if (!isEditingPrice) {
          setCardPrice(pricingData.cardPrice || 10);
          setShieldPricePercent(pricingData.shieldPricePercent || 50);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveRoundDuration() {
    try {
      const res = await fetch('/api/config/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'round.duration_ms',
          value: speed
        })
      });
      if (res.ok) {
        await loadData(); // Reload to confirm the change
      } else {
        alert('Failed to save round duration');
      }
    } catch (error) {
      console.error('Error saving round duration:', error);
      alert('Error saving round duration');
    }
  }

  async function savePricing() {
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardPrice,
          shieldPricePercent
        })
      });
      if (res.ok) {
        await loadData(); // Reload to confirm the change
      } else {
        alert('Failed to save pricing');
      }
    } catch (error) {
      console.error('Error saving pricing:', error);
      alert('Error saving pricing');
    }
  }

  async function startRound() {
    try {
      const res = await fetch('/api/round/start', { method: 'POST' });
      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error starting round:', error);
    }
  }

  async function endRound() {
    try {
      const res = await fetch('/api/round/end', { method: 'POST' });
      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error ending round:', error);
    }
  }

  async function resetToSetup() {
    try {
      const res = await fetch('/api/round/reset', { method: 'POST' });
      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error resetting:', error);
    }
  }

  async function callNext() {
    try {
      const res = await fetch('/api/round/call', { method: 'POST' });
      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error calling next:', error);
    }
  }

  async function startScheduler() {
    try {
      // Convert seconds to minutes for the API (use decimal for precision)
      const preBuyMinutes = preBuySeconds / 60;
      const res = await fetch('/api/scheduler/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', preBuyMinutes })
      });
      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error starting scheduler:', error);
    }
  }

  async function stopScheduler() {
    try {
      const res = await fetch('/api/scheduler/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error stopping scheduler:', error);
    }
  }

  function formatTimeUntilNextGame(seconds: number): string {
    if (seconds === null || seconds <= 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <main className="wrap">
        <header className="header">
          <h1>Admin — Config</h1>
        </header>
        <section className="card">
          <p>Loading...</p>
        </section>
      </main>
    );
  }

  const phase = round?.phase ?? '—';
  const called = round?.called?.length || 0;
  const liveCards = round?.live_cards_count ?? 0;
  const playerCount = round?.player_count ?? 0;

  return (
    <main className="wrap">
      <header className="header">
        <h1>Admin — Config</h1>
        <div className="status">
          <span>Phase: <b className="cap">{phase}</b></span>
          <span>· Called: <b>{called}</b>/25</span>
          <span>· Speed: <b>{speed}</b> ms</span>
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
      {/* Round Duration Section */}
      <section className="card">
        <div className="row between">
          <div className="field">
            <label>Round Duration</label>
            <input
              className="input"
              type="number"
              value={speed}
              onChange={e => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                  setSpeed(value);
                }
              }}
              onFocus={() => {
                isEditingRef.current = true;
                setIsEditingSpeed(true);
              }}
              onBlur={() => {
                isEditingRef.current = false;
                setIsEditingSpeed(false);
              }}
              placeholder="ms"
              min="100"
              max="10000"
            />
          </div>
          <div className="actions">
            <button className="btn primary" onClick={saveRoundDuration}>
              Save
            </button>
            <button className="btn" onClick={() => loadData()}>Reload</button>
          </div>
        </div>
      </section>

      {/* Pricing Configuration Section */}
      <section className="card">
        <h3>Pricing Configuration</h3>
        <div className="row between">
          <div className="field">
            <label>Card Price (coins)</label>
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
              onFocus={() => {
                isEditingRef.current = true;
                setIsEditingPrice(true);
              }}
              onBlur={() => {
                isEditingRef.current = false;
                setIsEditingPrice(false);
              }}
              placeholder="coins"
              min="1"
              max="1000"
            />
          </div>
          <div className="field">
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
              onFocus={() => {
                isEditingRef.current = true;
                setIsEditingPrice(true);
              }}
              onBlur={() => {
                isEditingRef.current = false;
                setIsEditingPrice(false);
              }}
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

      {/* Games Scheduler Section */}
      <section className="card">
        <h3>Games Scheduler</h3>
        <div className="row between">
          <div className="field">
            <label>Pre-buy seconds</label>
            <input
              className="input"
              type="number"
              min="10"
              max="60"
              value={preBuySeconds}
              onFocus={() => {
                isEditingRef.current = true;
                setIsEditingPreBuy(true);
              }}
              onBlur={() => {
                isEditingRef.current = false;
                setIsEditingPreBuy(false);
              }}
              onChange={e => {
                const inputValue = e.target.value;
                if (inputValue === '') {
                  setPreBuySeconds(10);
                } else {
                  const value = parseInt(inputValue);
                  if (!isNaN(value)) {
                    setPreBuySeconds(value);
                  }
                }
              }}
              placeholder="seconds"
            />
          </div>
          <div className="actions">
            <button 
              className="btn success" 
              onClick={startScheduler}
              disabled={schedulerConfig?.enabled}
            >
              Start Scheduler
            </button>
            <button 
              className="btn warn" 
              onClick={stopScheduler}
              disabled={!schedulerConfig?.enabled}
            >
              Stop Scheduler
            </button>
          </div>
        </div>

        {schedulerConfig?.enabled && schedulerStatus && (
          <div className="scheduler-status">
            <div><strong>Status:</strong> {schedulerStatus.currentPhase}</div>
            <div><strong>Next Game:</strong> {formatTimeUntilNextGame(schedulerStatus.timeUntilNextGame)}</div>
            <div><strong>Can Purchase Cards:</strong> {schedulerStatus.canPurchaseCards ? 'Yes' : 'No'}</div>
            <div><strong>Pre-buy Period:</strong> {schedulerConfig.preBuyMinutes * 60} seconds</div>
          </div>
        )}
      </section>

      {/* Round Control Section */}
      <section className="card" style={{ opacity: schedulerConfig?.enabled ? 0.6 : 1 }}>
        <div className="row between">
          <div className="title">Round Control · <span className="cap">{phase}</span> · {called}/25</div>
          <div className="row smgap">
            <label className="check">
              <input type="checkbox" checked={true} readOnly />
              Polling
            </label>
            <span>Poll: <b>1000</b> ms</span>
          </div>
        </div>

        <div className="row smgap wrap">
          <button 
            className="btn success" 
            onClick={startRound} 
            disabled={schedulerConfig?.enabled}
          >
            Start Round
          </button>
          <button 
            className="btn info" 
            onClick={callNext} 
            disabled={schedulerConfig?.enabled || round?.phase !== 'live'}
          >
            Call Next
          </button>
          <button 
            className="btn warn" 
            onClick={endRound} 
            disabled={schedulerConfig?.enabled}
          >
            End Round
          </button>
          <button 
            className="btn purple" 
            onClick={resetToSetup} 
            disabled={schedulerConfig?.enabled}
          >
            Reset to Setup
          </button>

          <label className="check ml">
            <input 
              type="checkbox" 
              checked={autoOn} 
              onChange={e => setAutoOn(e.target.checked)}
              disabled={schedulerConfig?.enabled || round?.phase !== 'live'}
            />
            Auto-run (uses speed_ms)
          </label>
        </div>

        {schedulerConfig?.enabled && (
          <div className="warning">
            ⚠️ Scheduler is active - manual controls are disabled
          </div>
        )}
      </section>

      {/* Debug Data */}
      <details className="debug-section">
        <summary className="debug-summary">Debug Data (Click to expand)</summary>
        <div className="debug-content">
          <h3>Scheduler Config:</h3>
          <pre>{JSON.stringify(schedulerConfig, null, 2)}</pre>
          <h3>Scheduler Status:</h3>
          <pre>{JSON.stringify(schedulerStatus, null, 2)}</pre>
        </div>
      </details>

      {/* Scoped styles */}
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

        .btn { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#e8eeff; padding:8px 12px; border-radius:10px; font-size:14px; cursor:pointer; transition:.15s; }
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

        .warning { padding: 8px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; margin-top: 8px; font-size: 14px; color: #856404; }

        .debug-section { margin-top: 20px; }
        .debug-summary { cursor: pointer; padding: 10px; background: #f8f9fa; border-radius: 3px; color: #333; }
        .debug-content { margin-top: 10px; }
        .debug-content h3 { color: #333; margin-top: 15px; }
        .debug-content pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow: auto; color: #333; font-size: 12px; }
      `}</style>
    </main>
  );
}