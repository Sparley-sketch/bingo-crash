/* eslint-disable @next/next/no-img-element */
'use client';

import * as React from 'react';

type RoundState = {
  id: string | null;
  phase: 'setup' | 'live' | 'ended' | string;
  speed_ms: number;
  called: number[];
  created_at: string | null;
};

export default function AdminPage() {
  const [state, setState] = React.useState<RoundState | null>(null);
  const [pollMs, setPollMs] = React.useState(1000);
  const [busy, setBusy] = React.useState<string | null>(null);
  const timerRef = React.useRef<number | null>(null);

  async function fetchStateOnce() {
    try {
      const r = await fetch('/api/round/state', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        // For Next.js App Router: ensure no static caching
        next: { revalidate: 0 },
      });
      const json = (await r.json()) as RoundState | { error: string };
      // if there’s an error object, just surface it
      if ('error' in json) {
        console.warn('STATE error:', json.error);
        return;
      }
      setState(json);
    } catch (e) {
      console.warn('STATE fetch failed:', e);
    }
  }

  function restartPoll() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(fetchStateOnce, pollMs);
  }

  React.useEffect(() => {
    fetchStateOnce();
    restartPoll();
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    // change polling rate
    restartPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  async function post(path: string) {
    setBusy(path);
    try {
      const r = await fetch(path, {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(`${path} failed: ${r.status} ${JSON.stringify(json)}`);
      }
      // Always pull fresh state right after
      await fetchStateOnce();
    } catch (e: any) {
      alert(`${path} failed: ${e?.message || e}`);
    } finally {
      setBusy(null);
    }
  }

  const phase = state?.phase ?? '—';
  const calledLen = Array.isArray(state?.called) ? state!.called.length : 0;

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Round Control</h1>
      <div style={{ marginBottom: 8, color: '#555' }}>
        <b>Phase:</b> {phase} · <b>Called:</b> {calledLen}/25 · <b>Speed:</b> {state?.speed_ms ?? '—'}ms
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={() => post('/api/round/end')}   disabled={!!busy}>End</button>
        <button onClick={() => post('/api/round/reset')} disabled={!!busy}>Reset</button>
        <button onClick={() => post('/api/round/start')} disabled={!!busy}>Start</button>
        <button onClick={() => post('/api/round/call')}  disabled={!!busy}>Call Next</button>
        <span style={{ marginLeft: 16 }}>
          Poll: <b>{pollMs}</b> ms
          <button onClick={() => setPollMs(Math.max(250, pollMs - 250))} style={{ marginLeft: 8 }}>Faster</button>
          <button onClick={() => setPollMs(Math.min(5000, pollMs + 500))} style={{ marginLeft: 4 }}>Slower</button>
        </span>
        <button onClick={fetchStateOnce} style={{ marginLeft: 8 }}>Fetch Once</button>
      </div>

      <pre style={{ background: '#111', color: '#0f0', padding: 12, borderRadius: 8, overflow: 'auto' }}>
        {JSON.stringify(state ?? { loading: true }, null, 2)}
      </pre>
    </main>
  );
}
