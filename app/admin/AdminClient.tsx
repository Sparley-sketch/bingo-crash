'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ConfigItem = { key: string; value: any; updated_at?: string };

type SchedulerConfig = {
  enabled: boolean;
  preBuyMinutes: number;
  nextGameStart: string | null;
  currentPhase: string;
  winnerDisplaySeconds: number;
  purchaseBlockSeconds: number;
};

export default function AdminClient({ canWrite }: { canWrite: boolean }) {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [keyName, setKeyName] = useState('round.duration_ms');
  const [valText, setValText] = useState('800');

  const [round, setRound] = useState<{ id?: string; phase: string; speed_ms: number; called: number[] } | null>(null);
  const [autoOn, setAutoOn] = useState(false);
  const [schedulerConfig, setSchedulerConfig] = useState<SchedulerConfig | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [preBuySeconds, setPreBuySeconds] = useState(30);
  // Supabase client is imported

  // Load config table
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    })();
  }, []);

  // Load scheduler config
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/scheduler');
      if (res.ok) {
        const data = await res.json();
        setSchedulerConfig(data);
        // Convert from minutes to seconds (multiply by 60)
        const minutes = data.preBuyMinutes || 2;
        const seconds = minutes * 60;
        // Ensure the value is within our valid range (10-60 seconds)
        const validSeconds = Math.max(10, Math.min(60, seconds));
        setPreBuySeconds(validSeconds);
      }
    })();
  }, []);

  // Poll scheduler status
  useEffect(() => {
    let stop = false;
    async function loadSchedulerStatus() {
      try {
        const r = await fetch('/api/scheduler/status', { cache: 'no-store' });
        const data = await r.json();
        if (!stop) setSchedulerStatus(data);
      } catch {}
    }
    loadSchedulerStatus();
    const t = setInterval(loadSchedulerStatus, 1000);
    return () => { stop = true; clearInterval(t); };
  }, []);

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
          // Refresh scheduler config after auto-start
          const res = await fetch('/api/scheduler');
          if (res.ok) {
            const config = await res.json();
            setSchedulerConfig(config);
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
          console.log('Scheduler cycle action:', cycleData.action, 'New phase:', cycleData.newPhase);
          
          if (cycleData.action === 'setup') {
            console.log('Moved to setup phase - players can now purchase cards');
          } else if (cycleData.action === 'started') {
            console.log('Next game started automatically - enabling auto-run');
            setAutoOn(true);
          }
        }
      } catch (error) {
        console.error('Scheduler cycle check failed:', error);
      }
    }
    
    handleSchedulerCycle();
    const t = setInterval(handleSchedulerCycle, 1000); // Check every second
    return () => { stop = true; clearInterval(t); };
  }, [schedulerConfig?.enabled]);

  // Poll round state
  useEffect(() => {
    let stop = false;
    async function loadRound() {
      try {
        const r = await fetch('/api/round/state', { cache: 'no-store' });
        const data = await r.json();
        if (!stop) setRound({ id: data.id, phase: data.phase, speed_ms: data.speed_ms, called: data.called || [] });
      } catch {}
    }
    loadRound();
    const t = setInterval(loadRound, 1000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  // Auto-run caller - automatically call balls when auto-run is enabled
  useEffect(() => {
    if (!autoOn || !canWrite || !round || round.phase !== 'live') return;
    
    const ms = round?.speed_ms || 800;
    const id = setInterval(async () => {
      try {
        await fetch('/api/round/call', { method: 'POST' });
      } catch (error) {
        console.error('Auto-call failed:', error);
      }
    }, ms);
    
    return () => clearInterval(id);
  }, [autoOn, round?.speed_ms, round?.phase, canWrite]);

  function parseValue(txt: string) {
    try { return JSON.parse(txt); } catch {}
    if (/^\d+$/.test(txt)) return Number(txt);
    if (txt === 'true') return true;
    if (txt === 'false') return false;
    return txt;
  }

  async function save() {
    if (!canWrite) return;
    const body = { key: keyName, value: parseValue(valText) };
    const r = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(`Save failed: ${j.error || r.statusText}`);
      return;
    }
    const data = await r.json();
    setItems(data.items);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  }

  async function startRound() {
    const r = await fetch('/api/round/start', { method: 'POST' });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) alert(`Start failed: ${j.error || r.statusText}`);
  }
  
  async function callOnce() {
    const r = await fetch('/api/round/call', { method: 'POST' });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) alert(`Call failed: ${j.error || r.statusText}`);
  }

  async function endRound() {
    const body = round?.id ? { roundId: round.id } : undefined;
    const r = await fetch('/api/round/end', { 
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) alert(`End failed: ${j.error || r.statusText}`);
  }
  async function resetToSetup() {
    const r = await fetch('/api/round/reset', { method: 'POST' });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) alert((await r.json().catch(()=>({}))).error || r.statusText);
    setAutoOn(false);
  }

  async function startScheduler() {
    // Convert seconds to minutes (divide by 60)
    const preBuyMinutes = preBuySeconds / 60;
    const r = await fetch('/api/scheduler/control', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', preBuyMinutes, winnerDisplaySeconds: 1 })
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) alert(`Start scheduler failed: ${j.error || r.statusText}`);
    else {
      // Reload scheduler config
      const res = await fetch('/api/scheduler');
      if (res.ok) {
        const data = await res.json();
        setSchedulerConfig(data);
      }
    }
  }

  async function stopScheduler() {
    const r = await fetch('/api/scheduler/control', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' })
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) alert(`Stop scheduler failed: ${j.error || r.statusText}`);
    else {
      // Reload scheduler config
      const res = await fetch('/api/scheduler');
      if (res.ok) {
        const data = await res.json();
        setSchedulerConfig(data);
      }
    }
  }

  async function rescheduleNextGame() {
    // Convert seconds to minutes (divide by 60)
    const preBuyMinutes = preBuySeconds / 60;
    const r = await fetch('/api/scheduler/control', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reschedule', preBuyMinutes })
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) alert(`Reschedule failed: ${j.error || r.statusText}`);
    else {
      // Reload scheduler config
      const res = await fetch('/api/scheduler');
      if (res.ok) {
        const data = await res.json();
        setSchedulerConfig(data);
      }
    }
  }

  function formatTimeUntilNextGame(seconds: number | null): string {
    if (seconds === null) return '—';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  console.log('AdminClient rendering, schedulerConfig:', schedulerConfig);
  // Updated with Simple Admin logic - v2

  return (
    <main className="wrap">
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2>Admin — Config {canWrite ? '' : '(read-only)'}</h2>
          <button className="btn ghost" onClick={signOut}>Sign out</button>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <input placeholder="key (e.g., round.duration_ms)" value={keyName} onChange={e => setKeyName(e.target.value)} disabled={!canWrite} />
          <input placeholder="value (JSON or raw)" value={valText} onChange={e => setValText(e.target.value)} disabled={!canWrite} />
          <button className="btn" onClick={save} disabled={!canWrite}>Save</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Key</th><th>Value</th><th>Updated</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key}>
                  <td>{it.key}</td>
                  <td><code style={{ fontSize: 12 }}>{JSON.stringify(it.value)}</code></td>
                  <td style={{ color: '#9aa0a6' }}>{it.updated_at || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, opacity: canWrite ? 1 : 0.6 }}>
        <h3>Games Scheduler</h3>
        {/* Scheduler controls */}
        <div style={{ marginBottom: 16 }}>
          <div className="row" style={{gap:8, marginBottom:8, alignItems: 'center'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
              Pre-buy seconds: 
              <input 
                type="number" 
                min="10"
                max="60"
                value={preBuySeconds} 
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
                disabled={!canWrite}
                style={{width: 80, marginLeft: 10, padding: 5}}
              />
            </label>
            <button 
              className="btn" 
              disabled={!canWrite || schedulerConfig?.enabled} 
              onClick={startScheduler}
            >
              Start Scheduler
            </button>
            <button 
              className="btn" 
              disabled={!canWrite || !schedulerConfig?.enabled} 
              onClick={stopScheduler}
            >
              Stop Scheduler
            </button>
          </div>
          
          {schedulerConfig?.enabled && schedulerStatus && (
            <div style={{ padding: 12, backgroundColor: '#f0f9ff', border: '1px solid #7dd3fc', borderRadius: 8, fontSize: 14, marginTop: 12 }}>
              <div><strong>Scheduler Status:</strong> {schedulerStatus.enabled ? 'Active' : 'Inactive'}</div>
              <div><strong>Current Phase:</strong> {schedulerStatus.currentPhase}</div>
              <div><strong>Time Until Next Game:</strong> {formatTimeUntilNextGame(schedulerStatus.timeUntilNextGame)}</div>
              <div><strong>Can Purchase Cards:</strong> {schedulerStatus.canPurchaseCards ? 'Yes' : 'No'}</div>
              <div><strong>Pre-buy Period:</strong> {schedulerConfig.preBuyMinutes * 60} seconds</div>
              <div><strong>Winner Display:</strong> {schedulerConfig.winnerDisplaySeconds} seconds</div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, opacity: (canWrite && !schedulerConfig?.enabled) ? 1 : 0.6 }}>
        <h3>Manual Round Control · {round?.phase || '—'} · {round?.called?.length || 0}/25</h3>
        {schedulerConfig?.enabled && (
          <div style={{ padding: 8, backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 4, marginBottom: 8, fontSize: 14 }}>
            ⚠️ Scheduler is active - manual controls are disabled
          </div>
        )}
        <div className="row" style={{gap:8, marginTop:8}}>
          <button className="btn" disabled={!canWrite || schedulerConfig?.enabled} onClick={startRound}>Start Round</button>
          <button className="btn" disabled={!canWrite || schedulerConfig?.enabled} onClick={callOnce}>Call Next</button>
          <button className="btn" disabled={!canWrite || schedulerConfig?.enabled} onClick={endRound}>End Round</button>
          <button className="btn" disabled={!canWrite || schedulerConfig?.enabled} onClick={resetToSetup}>Reset to Setup</button>

          <label className="inline-row" style={{display:'inline-flex',alignItems:'center',gap:6}}>
            <input type="checkbox" checked={autoOn} onChange={e=>setAutoOn(e.target.checked)} disabled={!canWrite || schedulerConfig?.enabled} />
            Auto-run (uses speed_ms)
          </label>
          <span className="muted small">Speed: {round?.speed_ms ?? '—'} ms</span>
        </div>
      </div>
    </main>
  );
}
