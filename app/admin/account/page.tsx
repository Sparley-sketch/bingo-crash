'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function Account() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw1.length < 8) { setMsg('Password must be at least 8 characters'); return; }
    if (pw1 !== pw2) { setMsg('Passwords do not match'); return; }

    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) { setMsg(error.message); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ force_password_change: false })
        .eq('id', user.id);
      if (upErr) { setMsg('Updated password, but could not update profile flag: ' + upErr.message); return; }
    }

    window.location.href = '/admin/login';
  }

  return (
    <main className="wrap">
      <div className="card" style={{maxWidth:420}}>
        <h2>Change Password</h2>
        <form onSubmit={changePassword} style={{display:'grid', gap:12}}>
          <input type="password" placeholder="new password" value={pw1} onChange={e=>setPw1(e.target.value)} />
          <input type="password" placeholder="confirm password" value={pw2} onChange={e=>setPw2(e.target.value)} />
          {msg && <div>{msg}</div>}
          <button className="btn" type="submit">Update & Return to Login</button>
        </form>
      </div>
    </main>
  );
}
