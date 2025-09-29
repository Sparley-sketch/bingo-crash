// app/play/page.tsx
import { createClient } from '@supabase/supabase-js';

export default async function PlayPage() {
  // Read from DB securely on the server with service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-only
  );

  // Get the config value
  const { data } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'round.duration_ms')
    .single();

  // Validate and clamp to a reasonable range
  const msRaw = typeof data?.value === 'number' ? data.value : Number(data?.value);
  const durationMs = Number.isFinite(msRaw) && msRaw >= 100 && msRaw <= 5000 ? msRaw : 800;

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
