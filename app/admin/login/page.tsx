'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  // Prevent hydration mismatch and test Supabase connection
  useEffect(() => {
    setMounted(true);
    
    // Test Supabase connection
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Supabase connection test failed:', error);
        } else {
          console.log('Supabase connection test successful');
        }
      } catch (err) {
        console.error('Supabase connection error:', err);
      }
    };
    
    testConnection();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('Form submitted!', { email, password: '***' });
    
    setErr(null);
    setLoading(true);
    
    try {
      console.log('Attempting login with:', email);
      console.log('Supabase client:', supabase);
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      console.log('Login response:', { data, error });
      
      if (error) {
        console.error('Login error:', error);
        setErr(error.message);
        setLoading(false);
        return;
      }
      
      console.log('Login successful:', data);
      
      // Make sure the server sees the session cookie
      router.refresh();
      
      // Small delay to ensure session is set
      setTimeout(() => {
        console.log('Redirecting to admin...');
        window.location.href = '/admin';
      }, 100);
      
    } catch (error) {
      console.error('Unexpected error:', error);
      setErr('An unexpected error occurred');
      setLoading(false);
    }
  }

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return null;
  }

  return (
    <main className="wrap">
      <div className="card" style={{maxWidth:420}}>
        <h2>Admin Login</h2>
        <form onSubmit={onSubmit} style={{display:'grid', gap:12}}>
          <input 
            type="email" 
            placeholder="Email address" 
            value={email} 
            onChange={e=>setEmail(e.target.value)} 
            required 
            disabled={loading}
            autoComplete="email"
            style={{padding: '12px', borderRadius: '8px', border: '1px solid #ccc'}}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
            required 
            disabled={loading}
            autoComplete="current-password"
            style={{padding: '12px', borderRadius: '8px', border: '1px solid #ccc'}}
          />
          {err && <div style={{color:'#ff5b6e', padding: '8px', background: '#ffe6e6', borderRadius: '4px'}}>{err}</div>}
          <button 
            className="btn" 
            type="submit" 
            disabled={loading}
            style={{
              padding: '12px',
              background: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
