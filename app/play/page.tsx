// app/play/page.tsx
import { createClient } from '@supabase/supabase-js';

export default async function PlayPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
  );

  const { data } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'round.duration_ms')
    .single();

  const raw = typeof data?.value === 'number' ? data.value : Number(data?.value);
  const durationMs = Number.isFinite(raw) && raw >= 100 && raw <= 5000 ? raw : 800;

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
