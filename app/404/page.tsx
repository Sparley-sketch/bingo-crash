'use client';

export default function GameDisabledPage() {
  return (
    <main className="wrap" style={{ 
      maxWidth: 'unset', 
      padding: '20px',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      background: '#0f1220',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ 
        textAlign: 'center',
        background: '#12162a',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: '16px',
        padding: '40px',
        boxShadow: '0 6px 20px rgba(0,0,0,.25)',
        maxWidth: '500px'
      }}>
        <h1 style={{ 
          fontSize: '48px', 
          margin: '0 0 20px 0',
          color: '#ef4444'
        }}>
          🔒 404
        </h1>
        <h2 style={{ 
          fontSize: '24px', 
          margin: '0 0 16px 0',
          color: '#dfe6ff'
        }}>
          Game Access Disabled
        </h2>
        <p style={{ 
          fontSize: '16px', 
          margin: '0 0 24px 0',
          color: '#aab3cc',
          lineHeight: '1.5'
        }}>
          The game is currently disabled by an administrator. Please check back later or contact support if you believe this is an error.
        </p>
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button 
            onClick={() => window.location.href = '/play'}
            style={{
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.12)',
              color: '#e8eeff',
              padding: '12px 24px',
              borderRadius: '10px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,.12)'}
            onMouseOut={(e) => (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,.06)'}
          >
            Back to Game
          </button>
        </div>
      </div>
    </main>
  );
}
