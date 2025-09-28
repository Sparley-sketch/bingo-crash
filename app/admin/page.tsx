'use client';

import { useEffect, useState } from 'react';

type ConfigItem = { key: string; value: any; updated_at?: string };

export default function AdminPage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [keyName, setKeyName] = useState('round.duration_ms');
  const [valText, setValText] = useState('5000');
  const [secret, setSecret] = useState<string>('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/config');
      const data = await res.json();
      setItems(data.items || []);
      const cached = localStorage.getItem('admin_secret');
      if (cached) setSecret(cached);
    })();
  }, []);

  async function save() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) headers['x-admin-secret'] = secret;

    const body = { key: keyName, value: parseValue(valText) };
    const res = await fetch('/api/config', { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      alert('Save failed. Check your ADMIN_SECRET on server and the header here.');
      return;
    }
    const data = await res.json();
    setItems(data.items);
  }

  function parseValue(txt: string) {
    // Try JSON parse, else use string/number heuristics
    try { return JSON.parse(txt); } catch {}
    if (/^\d+$/.test(txt)) return Number(txt);
    if (txt === 'true') return true;
    if (txt === 'false') return false;
    return txt;
  }

  return (
    <main className="wrap">
      <div className="card">
        <h2>Admin — Config</h2>
        <div className="row" style={{ marginBottom: 8 }}>
          <input
            placeholder="Admin secret (temporary lock)"
            value={secret}
            onChange={(e) => { setSecret(e.target.value); localStorage.setItem('admin_secret', e.target.value); }}
          />
          <button className="btn" onClick={() => { localStorage.removeItem('admin_secret'); setSecret(''); }}>
            Clear
          </button>
        </div>
        <div className="row">
          <input placeholder="key (e.g., round.duration_ms)" value={keyName} onChange={e => setKeyName(e.target.value)} />
          <input placeholder="value (JSON or raw)" value={valText} onChange={e => setValText(e.target.value)} />
          <button className="btn" onClick={save}>Save</button>
        </div>
        <div style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr><th>Key</th><th>Value</th><th>Updated</th></tr>
            </thead>
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
    </main>
  );
}
