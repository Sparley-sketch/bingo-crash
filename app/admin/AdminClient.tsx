'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type ConfigItem = { key: string; value: any; updated_at?: string };

export default function AdminClient({ canWrite }: { canWrite: boolean }) {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [keyName, setKeyName] = useState('round.duration_ms');
  const [valText, setValText] = useState('800');

  const [round, setRound] = useState<{phase:string; speed_ms:number; called:number[]} | null>(null);
  const [autoOn, setAutoOn] = useState(false);

  const supabase = createClientComponentClient();

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    })();
  }, []);

  useEffect(() => {
    let stop = false;
    async function loadRound() {
      try {
        const r = await fetch('/api/round/state', { cache: 'no-store' });
        const data = await r.json();
        if (!stop) setRound({ phase: data.phase, speed_ms: data.speed_ms, called: data.called || [] });
      } catch {}
    }
    loadRound();
    const t = setInterval(loadRound, 1000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!autoOn || !canWrite) return;
    const ms = round?.speed_ms || 800;
    const id = setInterval(async () => {
      await fetch('/api/round/call', { method: 'POST' });
    }, ms);
    return () => clearInterval(id);
  }, [autoOn, round?.speed_ms, canWrite]);

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
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Save failed: ${err.error || res.statusText}`);
      return;
    }
    const data = await res.json();
    setItems(data.items);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  }

  async function startRound() {
  if (!canWrite) return;
  const r = await fetch('/api/round/start', { method: 'POST' });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    alert(`Start failed: ${j.error || r.statusText}`);
  }
}

async function callOnce() {
  if (!canWrite) return;
  const r = await fetch('/api/round/call', { method: 'POST' });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    alert(`Call failed: ${j.error || r.statusText}`);
  }
}
  
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
          <button className="btn" onClick={save} disabled={!canWrite} title={canWrite ? '' : 'Viewer cannot change config'}>Save</button>
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
        <h3>Round Control {round ? <span className="muted"> · {round.phase} · {round.called?.length || 0}/25</span> : null}</h3>
        <div className="row" style={{gap:8, marginTop:8}}>
          <button className="btn" disabled={!canWrite} onClick={startRound}>Start Round</button>
          <button className="btn" disabled={!canWrite} onClick={callOnce}>Call Next</button>
          <label className="inline-row" style={{display:'inline-flex',alignItems:'center',gap:6}}>
            <input type="checkbox" checked={autoOn} onChange={e=>setAutoOn(e.target.checked)} disabled={!canWrite} />
            Auto-run (uses speed_ms)
          </label>
          <span className="muted small">Speed: {round?.speed_ms ?? '—'} ms</span>
        </div>
      </div>
    </main>
  );
}
