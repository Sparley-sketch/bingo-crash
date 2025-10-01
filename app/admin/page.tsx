'use client';

import * as React from 'react';

type RoundState = {
  id: string | null;
  phase: 'setup' | 'live' | 'ended' | string;
  speed_ms: number;
  called: number[];
  created_at: string | null;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function AdminPage() {
  // ----- CONFIG -----
  const CFG_KEY = 'round.duration_ms';
  const [cfgValue, setCfgValue] = React.useState('1500');
  const [saving, setSaving] = React.useState(false);

  // ----- ROUND STATE / CONTROL -----
  const [state, setState] = React.useState<RoundState | null>(null);
  const [lastAction, setLastAction] = React.useState<any>(null);
  const [pollMs, setPollMs] = React.useState(1000);
  const [polling, setPolling] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [autoRun, setAutoRun] = React.useState(false);

  // ---------- helpers ----------
  async function fetchStateOnce() {
    const r = await fetch(`/api/round/state?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    const json = (await r.json()) as RoundState;
    setState(json);
    return json;
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
      // Pull state twice to avoid race with DB write
      await fetchStateOnce();
      await new Promise((res) => setTimeout(res, 120));
      await fetchStateOnce();
    } catch (e: any) {
      setLastAction({ path, error: e?.message || String(e) });
    } finally {
      setBusy(null);
    }
  }

  // ---------- config ----------
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
      const j = await r.json();
      setLastAction({ path: '/api/config/set', status: r.status, ok: r.ok, json: j });
      // Refresh visible speed in UI
      await fetchStateOnce();
    } finally {
      setSaving(false);
    }
  }

  // ---------- effects ----------
  React.useEffect(() => {
    fetchStateOnce();
    loadConfig();
  }, []);

  React.useEffect(() => {
    if (!polling) return;
    const id = setInterval(fetchStateOnce, pollMs);
    return () => clearInterval(id);
  }, [pollMs, polling]);

  // Auto-run: call automatically when LIVE
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
  const calledLen = Array.isArray(state?.called) ? state!.called.length : 0;

  return (
    <main className="min-h-screen bg-[#0f1220] text-white">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold">Admin — Config</h1>

        {/* Config Card (like your old screenshot) */}
        <section className="rounded-2xl bg-[#12162a] border border-white/10 p-4 space-y-3">
          <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="text-sm text-white/70">Key</label>
              <input
                disabled
                value="round.duration_ms"
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm"
              />
              <p className="text-xs text-white/50 mt-2">
                The round duration (ms) controls the auto-caller speed when Auto-run is used.
              </p>
            </div>
            <div>
              <label className="text-sm text-white/70">Value (ms)</label>
              <input
                value={cfgValue}
                onChange={(e) => setCfgValue(e.target.value)}
                className="w-full mt-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className={cx(
                    'rounded-xl px-4 py-2 text-sm font-semibold',
                    saving ? 'bg-white/10 text-white/50' : 'bg-blue-600 hover:bg-blue-500'
                  )}
                >
                  {saving ? 'Saving…' : 'Save'}
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

          <div className="border-t border-white/10 pt-3 text-sm text-white/70">
            <b>Current speed:</b> {state?.speed_ms ?? '—'} ms
          </div>
        </section>

        {/* Round Control Card */}
        <section className="rounded-2xl bg-[#12162a] border border-white/10 p-4">
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
              <span>Poll: <b>{pollMs}</b> ms</span>
              <button onClick={() => setPollMs(Math.max(250, pollMs - 250))}
                      className="rounded-lg px-2 py-1 bg-white/10 hover:bg-white/20">Faster</button>
              <button onClick={() => setPollMs(Math.min(5000, pollMs + 500))}
                      className="rounded-lg px-2 py-1 bg-white/10 hover:bg-white/20">Slower</button>
              <button onClick={fetchStateOnce}
                      className="rounded-lg px-2 py-1 bg-white/10 hover:bg-white/20">Fetch Once</button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => post('/api/round/start')}
                    disabled={!!busy}
                    className="rounded-xl px-3 py-2 bg-emerald-600 hover:bg-emerald-500">Start Round</button>
            <button onClick={() => post('/api/round/call')}
                    disabled={!!busy}
                    className="rounded-xl px-3 py-2 bg-blue-600 hover:bg-blue-500">Call Next</button>
            <button onClick={() => post('/api/round/end')}
                    disabled={!!busy}
                    className="rounded-xl px-3 py-2 bg-orange-500 hover:bg-orange-400">End Round</button>
            <button onClick={() => post('/api/round/reset')}
                    disabled={!!busy}
                    className="rounded-xl px-3 py-2 bg-purple-600 hover:bg-purple-500">Reset to Setup</button>

            <label className="ml-auto flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRun}
                onChange={(e) => setAutoRun(e.target.checked)}
              />
              Auto-run (uses speed_ms)
            </label>
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
