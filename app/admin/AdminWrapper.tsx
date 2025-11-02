import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminClient from './AdminClient';
import { supabaseConfig } from '@/lib/config';

export default async function AdminWrapper() {
  // Debug: Log configuration status (without exposing sensitive data)
  console.log('AdminWrapper: Checking Supabase configuration...');
  console.log('URL configured:', !!supabaseConfig.url && !supabaseConfig.url.includes('placeholder'));
  console.log('Anon key configured:', !!supabaseConfig.anonKey && !supabaseConfig.anonKey.includes('placeholder'));
  
  // Check if Supabase is configured (not using placeholder values)
  if (!supabaseConfig.url || !supabaseConfig.anonKey || 
      supabaseConfig.url.includes('placeholder') || 
      supabaseConfig.anonKey.includes('placeholder')) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: '#fff', 
        background: '#0f1220',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔧 Configuration Required</h1>
        <div style={{ 
          background: '#1a1a1a', 
          padding: '20px', 
          borderRadius: '10px', 
          maxWidth: '600px',
          textAlign: 'left',
          marginTop: '20px'
        }}>
          <p style={{ marginBottom: '1rem' }}>Please update your Supabase environment variables in <code style={{ background: '#333', padding: '2px 6px', borderRadius: '3px' }}>.env.local</code></p>
          
          <h3 style={{ color: '#4ade80', marginBottom: '10px' }}>Required variables:</h3>
          <ul style={{ marginLeft: '20px', lineHeight: '1.6' }}>
            <li><code style={{ background: '#333', padding: '2px 6px', borderRadius: '3px' }}>NEXT_PUBLIC_SUPABASE_URL_DEV</code> - Your Supabase project URL</li>
            <li><code style={{ background: '#333', padding: '2px 6px', borderRadius: '3px' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV</code> - Your Supabase anon key</li>
            <li><code style={{ background: '#333', padding: '2px 6px', borderRadius: '3px' }}>SUPABASE_SERVICE_ROLE_KEY_DEV</code> - Your Supabase service role key</li>
          </ul>
          
          <div style={{ 
            background: '#2d3748', 
            padding: '15px', 
            borderRadius: '8px', 
            marginTop: '15px',
            border: '1px solid #4a5568'
          }}>
            <h4 style={{ color: '#fbbf24', marginBottom: '8px' }}>📝 How to get these values:</h4>
            <ol style={{ marginLeft: '20px', lineHeight: '1.5' }}>
              <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" style={{ color: '#60a5fa' }}>Supabase Dashboard</a></li>
              <li>Select your project</li>
              <li>Go to Settings → API</li>
              <li>Copy the Project URL and API keys</li>
            </ol>
          </div>
          
          <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#a0aec0' }}>
            After updating the values, restart the development server with <code style={{ background: '#333', padding: '2px 6px', borderRadius: '3px' }}>npm run dev</code>
          </p>
        </div>
      </div>
    );
  }

  try {
    const supabase = createServerComponentClient({ cookies });
    
    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      // Not authenticated, redirect to login
      redirect('/admin/login');
    }

    // Check user role in the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      // No profile found, redirect to forbidden
      redirect('/admin/forbidden');
    }

    if (profile.role !== 'admin') {
      // User doesn't have admin role, redirect to forbidden
      redirect('/admin/forbidden');
    }

    // User is authenticated and has admin role, render the admin page
    return <AdminClient />;
  } catch (error) {
    // Check if this is a Next.js redirect error (which is normal behavior)
    if (error && typeof error === 'object' && 'digest' in error && 
        typeof error.digest === 'string' && error.digest.includes('NEXT_REDIRECT')) {
      // This is a normal Next.js redirect, re-throw it so Next.js can handle it
      throw error;
    }
    console.error('AdminWrapper error:', error);
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: '#fff', 
        background: '#0f1220',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌ Authentication Error</h1>
        <div style={{ 
          background: '#1a1a1a', 
          padding: '20px', 
          borderRadius: '10px', 
          maxWidth: '600px',
          textAlign: 'left',
          marginTop: '20px'
        }}>
          <p style={{ marginBottom: '1rem' }}>There was an error connecting to Supabase. Please check your configuration.</p>
          
          <div style={{ 
            background: '#2d3748', 
            padding: '15px', 
            borderRadius: '8px', 
            marginTop: '15px',
            border: '1px solid #4a5568'
          }}>
            <h4 style={{ color: '#fbbf24', marginBottom: '8px' }}>🔍 Debug Information:</h4>
            <pre style={{ 
              background: '#1a1a1a', 
              padding: '10px', 
              borderRadius: '5px', 
              marginTop: '10px',
              fontSize: '12px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              {error instanceof Error ? error.message : 'Unknown error'}
            </pre>
          </div>
          
          <div style={{ 
            background: '#2d3748', 
            padding: '15px', 
            borderRadius: '8px', 
            marginTop: '15px',
            border: '1px solid #4a5568'
          }}>
            <h4 style={{ color: '#60a5fa', marginBottom: '8px' }}>🛠️ Troubleshooting Steps:</h4>
            <ol style={{ marginLeft: '20px', lineHeight: '1.5' }}>
              <li>Check your <code style={{ background: '#333', padding: '2px 6px', borderRadius: '3px' }}>.env.local</code> file exists</li>
              <li>Verify your Supabase URL and keys are correct</li>
              <li>Make sure your Supabase project is active</li>
              <li>Check if you have internet connectivity</li>
              <li>Restart the development server after making changes</li>
            </ol>
          </div>
          
          <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#a0aec0' }}>
            If the problem persists, check the browser console for more detailed error messages.
          </p>
        </div>
      </div>
    );
  }
}