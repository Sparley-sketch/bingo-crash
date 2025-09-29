'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setErr(error.message); return; }
    router.replace('/admin');
  }

  return (
    <main className="wrap">
      <div className="card" style={{maxWidth:420}}>
        <h2>Admin Login</h2>
        <form onSubmit={onSubmit} style={{display:'grid', gap:12}}>
          <input type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          {err && <div style={{color:'#ff5b6e'}}>{err}</div>}
          <button className="btn" type="submit">Sign in</button>
        </form>
      </div>
    </main>
  );
}
