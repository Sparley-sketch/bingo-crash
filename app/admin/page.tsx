'use client';

import * as React from 'react';

type RoundState = {
  id: string | null;
  phase: string;          // 'setup' | 'live' | 'ended'
  speed_ms: number;
  called: number[];
  created_at: string | null;
};

function useInterval(cb: () => void, ms: number) {
  const ref = React.useRef(cb);
  React.useEffect(() => void (ref.current = cb), [cb]);
  React.useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export default function AdminPage() {
  const [state, setState] = React.useState<RoundState | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pollMs, setPollMs] = React.useState(1000);
  const [polling, setPolling] = React.useState(true);
  const [lastAction, setLastAction] = React.useState<any>(null);

  const fetchStateOnce = React.useCallback(async () => {
    try {
      // cache-bust + no-store to defeat SW/HTTP caches
      const url = `/api/round/state?ts=${Date.now()}`;
      const r = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        // tell Next "never cache this"
        next: { revalidate: 0 },
      });
      const json = (await r.json()) as any;
      setState(json);
      return json;
    } catch (e) {
      setState({ id: null, phase: 'error', speed_ms: 0, called: [], created_at: null });
      return null;
    }
  }, []);

  React.useEffect(() => {
    fetchStateOnce();
  }, [fetchStateOnce]);

  useInterval(() => {
    if (polling) fetchStateOnce();
  }, pollMs);

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
      // pull fresh state twice with a tiny delay to avoid race with DB write
      await fetchStateOnce();
      await new Promise((res) => setTimeout(res, 150));
      await fetchStateOnce();
    } catch (e: any) {
      setLastAction({ path, error: e?.message || String(e) });
    } finally {
      setBusy(null);
    }
  }

  const phase = state?.phase ?? '—';
  const calledLen = Array.isArray(state?.called) ? state!.called.length : 0;

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Round Control — Admin</h1>

      <div style={{ marginBottom: 10, color: '#444' }}>
        <b>Phase:</b> {phase} · <b>Called:</b> {calledLen}/25 · <b>Speed:</b> {state?.speed_ms ?? '—'} ms
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={() => post('/api/round/end')}   disabled={!!busy}>End</button>
        <button onClick={() => post('/api/round/reset')} disabled={!!busy}>Reset</button>
        <button onClick={() => post('/api/round/start')} disabled={!!busy}>Start</button>
        <button onClick={() => post('/api/round/call')}  disabled={!!busy}>Call Next</button>

        <span style={{ marginLeft: 16 }}>
          Poll: <b>{pollMs}</b> ms
          <button onClick={() => setPollMs((m) => Math.max(250, m - 250))} style={{ marginLeft: 8 }}>Faster</button>
          <button onClick={() => setPollMs((m) => Math.min(5000, m + 500))} style={{ marginLeft: 4 }}>Slower</button>
        </span>

        <label style={{ marginLeft: 12 }}>
          <input
            type="checkbox"
            checked={polling}
            onChange={(e) => setPolling(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Polling
        </label>

        <button onClick={fetchStateOnce} style={{ marginLeft: 8 }}>Fetch Once</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <section>
          <h3>State</h3>
          <pre style={{ background: '#0b0b0b', color: '#a6ffa6', padding: 12, borderRadius: 8, minHeight: 160 }}>
            {JSON.stringify(state ?? { loading: true }, null, 2)}
          </pre>
        </section>
        <section>
          <h3>Last action</h3>
          <pre style={{ background: '#0b0b0b', color: '#a6d0ff', padding: 12, borderRadius: 8, minHeight: 160 }}>
            {JSON.stringify(lastAction ?? { none: true }, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
