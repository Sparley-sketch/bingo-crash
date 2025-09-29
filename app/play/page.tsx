// app/play/page.tsx
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering (no static cache)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PlayPage() {
  // default if anything fails
  let durationMs = 800;

  try {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
    if (url && sKey) {
      const supabase = createClient(url, sKey);
      const { data } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'round.duration_ms')
        .single();

      const raw = typeof data?.value === 'number' ? data.value : Number(data?.value);
      if (Number.isFinite(raw) && raw >= 100 && raw <= 5000) {
        durationMs = raw;
      }
    }
  } catch {
    // swallow and keep default
  }

  const src = `/bingo-v37/index.html?round_ms=${durationMs}`;

  return (
    <main className="wrap" style={{ maxWidth: 'unset', padding: 0 }}>
      <iframe
        src={src}
        style={{ border: 'none', width: '100%', height: '100vh' }}
        title="Bingo + Crash"
      />
    </main>
  );
}
