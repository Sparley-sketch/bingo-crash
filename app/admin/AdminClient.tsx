// --- add near the top ---
type Role = 'admin' | 'viewer';

// --- inside component ---
const [newEmail, setNewEmail] = useState('');
const [newPass, setNewPass] = useState('');
const [newRole, setNewRole] = useState<Role>('viewer');
const [sendInvite, setSendInvite] = useState(true);
const [msg, setMsg] = useState<string | null>(null);

async function createUser() {
  setMsg(null);
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: newEmail, password: newPass || undefined, role: newRole, sendInvite }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { setMsg(data.error || 'Failed'); return; }
  setMsg(`Created ${data.email} (${data.user_id}) as ${newRole}`);
  setNewEmail(''); setNewPass('');
}

// --- in returned JSX (below your config table) ---
<div className="card" style={{ marginTop: 16 }}>
  <h3>User Management</h3>
  <div className="row" style={{marginTop:8, gap:8}}>
    <input type="email" placeholder="user@email.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)} />
    <select value={newRole} onChange={e=>setNewRole(e.target.value as Role)}>
      <option value="viewer">viewer</option>
      <option value="admin">admin</option>
    </select>
    <label style={{display:'inline-flex',alignItems:'center',gap:6}}>
      <input type="checkbox" checked={sendInvite} onChange={e=>setSendInvite(e.target.checked)} />
      Send invite email
    </label>
    {!sendInvite && (
      <input type="password" placeholder="temp password" value={newPass} onChange={e=>setNewPass(e.target.value)} />
    )}
    <button className="btn" onClick={createUser}>Create user</button>
  </div>
  {msg && <p className="muted" style={{marginTop:8}}>{msg}</p>}
</div>
