'use client';

import * as React from 'react';

type RoundState = {
  id: string | null;
  phase: 'setup' | 'live' | 'ended' | string;
  speed_ms: number;
  called: number[];
  created_at: string | null;
  live_cards_count?: number;
  player_count?: number;
};

export default function AdminPage() {
  const CFG_KEY = 'round.duration_ms';

  // Config UI
  const [cfgValue, setCfgValue] = React.useState('1500');
  const [saving, setSaving] = React.useState(false);

  // Round state
  const [state, setState] = React.useState<RoundState | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Polling + Auto-run
  const [pollMs, setPollMs] = React.useState(1000);
  const [polling, setPolling] = React.useState(true);
  const [autoRun, setAutoRun] = React.useState(false);

  // ---------------- helpers ----------------
  async function fetchStateOnce() {
    const r = await fetch(`/api/round/state?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    const json = (await r.json()) as RoundState;
    console.log('📊 Fetched state:', json);
    setState(json);
    return json;
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
      
      const response = await r.json().catch(() => ({}));
      console.log(`📡 Response from ${path}:`, response);
      
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
      const body = { key: CFG_KEY, value: cfgValue };
      const r = await fetch(`/api/config/set?ts=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      await r.json().catch(() => ({}));
      await fetchStateOnce();
    } finally {
      setSaving(false);
    }
  }

  // ---------------- effects ----------------
  React.useEffect(() => {
    fetchStateOnce();
    loadConfig();
  }, []);

  React.useEffect(() => {
    if (!polling) return;
    const id = setInterval(fetchStateOnce, pollMs);
    return () => clearInterval(id);
  }, [pollMs, polling]);

  // Auto-run calls while LIVE
  React.useEffect(() => {
    if (!autoRun || state?.phase !== 'live') return;
    const id = setInterval(() => {
      fetch('/api/round/call?ts=' + Date.now(), {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }).then(() => fetchStateOnce());
    }, state!.speed_ms || 800);
    return () => clearInterval(id);
  }, [autoRun, state?.phase, state?.speed_ms]);

  const phase = state?.phase ?? '—';
  const called = Array.isArray(state?.called) ? state!.called.length : 0;
  const speed = (state?.speed_ms ?? Number(cfgValue)) || 800;
  const liveCards = state?.live_cards_count ?? 0;
  const playerCount = state?.player_count ?? 0;

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

      {/* Config card */}
      <section className="card">
        <div className="row">
          <div className="field">
            <label>Auto caller speed</label>
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
        <p className="hint">Controls the auto-caller speed when Auto-run is used.</p>
      </section>

      {/* Control card */}
      <section className="card">
        <div className="row between">
          <div className="title">Round Control · <span className="cap">{phase}</span> · {called}/25</div>
          <div className="row smgap">
            <label className="check"><input type="checkbox" checked={polling} onChange={e => setPolling(e.target.checked)} />Polling</label>
            <span>Poll: <b>{pollMs}</b> ms</span>
            <button className="btn" onClick={() => setPollMs(m => Math.max(250, m - 250))}>Faster</button>
            <button className="btn" onClick={() => setPollMs(m => Math.min(5000, m + 500))}>Slower</button>
            <button className="btn" onClick={fetchStateOnce}>Fetch Once</button>
          </div>
        </div>

        <div className="row smgap wrap">
          <button className="btn success" onClick={() => post('/api/round/start')} disabled={!!busy}>Start Round</button>
          <button className="btn info"    onClick={() => post('/api/round/call')}  disabled={!!busy}>Call Next</button>
          <button className="btn warn"    onClick={() => post('/api/round/end')}   disabled={!!busy}>End Round</button>
          <button className="btn purple"  onClick={() => post('/api/round/reset')} disabled={!!busy}>Reset to Setup</button>

          <label className="check ml">
            <input type="checkbox" checked={autoRun} onChange={e => setAutoRun(e.target.checked)} />
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
      `}</style>
    </main>
  );
}
