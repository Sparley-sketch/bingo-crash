export default function PlayPage() {
  return (
    <main className="wrap" style={{ maxWidth: 'unset', padding: 0 }}>
      <iframe
        src="/bingo-v37/index.html"
        style={{ border: 'none', width: '100%', height: '100vh' }}
        title="Bingo + Crash v3.7"
      />
    </main>
  );
}
