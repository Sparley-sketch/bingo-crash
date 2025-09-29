// app/play/page.tsx
import { createClient } from '@supabase/supabase-js';

export default async function PlayPage() {
  // Default in case anything fails
  let durationMs = 800;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const role = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
    if (url && role) {
      const supabase = createClient(url, role);
      const { data } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'round.duration_ms')
        .single();

      const raw = typeof data?.value === 'number' ? data.value : Number(data?.value);
      if (Number.isFinite(raw) && raw >= 100 && raw <= 5000) durationMs = raw;
    }
  } catch {
    // swallow errors and keep default
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
