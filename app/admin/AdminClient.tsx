'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type ConfigItem = { key: string; value: any; updated_at?: string };
type Role = 'admin' | 'viewer';

export default function AdminClient() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [keyName, setKeyName] = useState('round.duration_ms');
  const [valText, setValText] = useState('5000');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<Role>('viewer');
  const [msg, setMsg] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/config');
      if (!res.ok) {
        alert('Failed to load config. Are you logged in?');
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
    })();
  }, []);

  function parseValue(txt: string) {
    try { return JSON.parse(txt); } catch {}
    if (/^\d+$/.test(txt)) return Number(txt);
    if (txt === 'true') return true;
    if (txt === 'false') return false;
    return txt;
  }

  async function save() {
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

  async function createUser() {
    setMsg(null);
    if (!newEmail || !newPass) { setMsg('Email and password are required'); return; }
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPass, role: newRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.error || 'Failed'); return; }
    setMsg(`Created ${data.email} (${data.user_id}) as ${newRole}`);
    setNewEmail(''); setNewPass('');
  }

  return (
    <main className="wrap">
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2>Admin — Config</h2>
          <button className="btn ghost" onClick={signOut}>Sign out</button>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <input placeholder="key (e.g., round.duration_ms)" value={keyName} onChange={e => setKeyName(e.target.value)} />
          <input placeholder="value (JSON or raw)" value={valText} onChange={e => setValText(e.target.value)} />
          <button className="btn" onClick={save}>Save</button>
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

      <div className="card" style={{ marginTop: 16 }}>
        <h3>User Management</h3>
        <div className="row" style={{marginTop:8, gap:8}}>
          <input type="email" placeholder="user@email.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)} />
          <select value={newRole} onChange={e=>setNewRole(e.target.value as Role)}>
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
          </select>
          <input type="password" placeholder="temporary password (min 8 chars)" value={newPass} onChange={e=>setNewPass(e.target.value)} />
          <button className="btn" onClick={createUser}>Create user</button>
        </div>
        {msg && <p className="muted" style={{marginTop:8}}>{msg}</p>}
        <p className="muted small" style={{marginTop:8}}>
          No SMTP needed. Share the temp password out-of-band, and ask the user to change it after first login.
        </p>
      </div>
    </main>
  );
}
