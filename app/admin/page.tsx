'use client';

import * as React from 'react';

type RoundState = {
  id: string | null;
  phase: 'setup' | 'live' | 'ended' | string;
  speed_ms: number;
  called: number[];
  created_at: string | null;
  ts?: number;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function AdminPage() {
  // Config UI
  const [cfgKey] = React.useState('round.duration_ms');
  const [cfgValue, setCfgValue] = React.useState<string>('1500');
  const [cfgSaving, setCfgSaving] = React.useState(false);

  // Round state
  const [state, setState] = React.useState<RoundState | null>(null);
  const [lastAction, setLastAction] = React.useState<any>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pollMs, setPollMs] = React.useState(1000);
  const [polling, setPolling] = React.useState(true);

  // ---------- fetch helpers (no-cache) ----------
  async function getStateOnce() {
    const r = await fetch(`/api/round/state?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    const json = await r.json();
    setState(json);
    return json as RoundState;
  }

  async function post(path: string) {
    setBusy(path);
    try {
      const r = await fetch(`${path}?ts=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const json = await r.json().catch(() => ({}));
      setLastAction({ path, status: r.status, ok: r.ok, json });
      // Pull state twice with a tiny delay to avoid DB write races
      await getStateOnce();
      await new Promise((res) => setTimeout(res, 120));
      await getStateOnce();
    } catch (e: any) {
      setLastAction({ path, error: e?.message || String(e) });
    } finally {
      setBusy(null);
    }
  }

  // ---------- config helpers ----------
  async function loadConfig() {
    try {
      const r = await fetch(`/api/config/get?key=${encodeURIComponent(cfgKey)}&ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        next: { revalidate: 0 },
      });
      const j = await r.json();
      if (j?.value != null) setCfgValue(String(j.value));
    } catch {}
  }
  async function saveConfig() {
    setCfgSaving(true);
    try {
      const body = { key: cfgKey, value: cfgValue };
      const r = await fetch(`/api/config/set?ts=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      setLastAction({ path: '/api/config/set', status: r.status, ok: r.ok, json: j });
      // If we are in setup, update visible speed immediately by reloading state
      await getStateOnce();
    } finally {
      setCfgSaving(false);
    }
  }

  // ---------- effects ----------
  React.useEffect(() => {
    getStateOnce();
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => getStateOnce(), pollMs);
    return () => clearInterval(id);
  }, [pollMs, polling]);

  const phase = state?.phase ?? '—';
  const calledLen = Array.isArray(state?.called) ? state!.called.length : 0;

  return (
    <main className="min-h-screen bg-[#0e1016] text-white">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin — Config</h1>
          </div>
        </header>

        {/* Config Card */}
        <section className="rounded-2xl bg-[#121523] border border-white/10 p-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 md:gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm text-white/70">Key</label>
              <input
                disabled
                value={cfgKey}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white"
              />
              <p className="text-xs text-white/40">
                The round duration (ms) controls the auto-caller speed when Auto-run is used.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Value (ms)</label>
              <input
                value={cfgValue}
                onChange={(e) => setCfgValue(e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveConfig}
                  disabled={cfgSaving}
                  className={cls(
                    'rounded-xl px-4 py-2 text-sm font-semibold',
                    cfgSaving ? 'bg-white/10 text-white/50' : 'bg-blue-600 hover:bg-blue-500'
                  )}
                >
                  {cfgSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={loadConfig}
                  className="rounded-xl px-3 py-2 text-sm bg-white/10 hover:bg-white/20"
                >
                  Reload
                </button>
              </div>
            </div>
          </div>

          {/* Last saved row preview */}
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="text-sm text-white/70 flex items-center justify-between">
              <span>
                <b>Current speed:</b> {state?.speed_ms ?? '—'} ms
              </span>
              <span className="text-white/50">Phase: {phase}</span>
            </div>
          </div>
        </section>

        {/* Round Control */}
        <section className="rounded-2xl bg-[#121523] border border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div className="text-white/80 font-semibold">
              Round Control · <span className="capitalize">{phase}</span> · {calledLen}/25
            </div>
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={polling}
                  onChange={(e) => setPolling(e.target.checked)}
                />
                Polling
              </label>
              <span>
                Speed: {state?.speed_ms ?? '—'} ms · Poll:{' '}
                <b>{pollMs}</b> ms
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPollMs(Math.max(250, pollMs - 250))}
                        className="rounded-lg px-2 py-1 bg-white/10 hover:bg-white/20">
                  Faster
                </button>
                <button onClick={() => setPollMs(Math.min(5000, pollMs + 500))}
                        className="rounded-lg px-2 py-1 bg-white/10 hover:bg-white/20">
                  Slower
                </button>
                <button onClick={getStateOnce}
                        className="rounded-lg px-2 py-1 bg-white/10 hover:bg-white/20">
                  Fetch Once
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => post('/api/round/start')}
                    disabled={!!busy}
                    className="rounded-xl px-3 py-2 bg-emerald-600 hover:bg-emerald-500">
              Start Round
            </button>
            <button onClick={() => post('/api/round/call')}
                    disabled={!!busy}
                    className="rounded-xl px-3 py-2 bg-blue-600 hover:bg-blue-500">
              Call Next
            </button>
            <button onClick={() => post('/api/round/end')}
                    disabled={!!busy}
                    className="rounded-xl px-3 py-2 bg-orange-500 hover:bg-orange-400">
              End Round
            </button>
            <button onClick={() => post('/api/round/reset')}
                    disabled={!!busy}
                    className="rounded-xl px-3 py-2 bg-purple-600 hover:bg-purple-500">
              Reset to Setup
            </button>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-3">
            <div>
              <h3 className="text-sm text-white/70 mb-2">State</h3>
              <pre className="rounded-xl bg-black/60 text-green-300 p-3 min-h-[160px] overflow-auto">
                {JSON.stringify(state ?? { loading: true }, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-sm text-white/70 mb-2">Last Action</h3>
              <pre className="rounded-xl bg-black/60 text-blue-300 p-3 min-h-[160px] overflow-auto">
                {JSON.stringify(lastAction ?? { none: true }, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
