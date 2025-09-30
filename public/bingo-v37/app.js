
// Multiplayer-enabled Bingo+Crash — Pre-game + Play (shared caller)
// Plain JavaScript (no TypeScript), React UMD + JSX compiled by Babel not required.
// Make sure React and ReactDOM UMD are loaded before this script.

const { useEffect, useMemo, useRef, useState } = React;
const [roundId, setRoundId] = React.useState(null);

const CARD_PRICE = 5;
const CATALOG_SIZE = 8;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function classNames() {
  return Array.from(arguments).filter(Boolean).join(" ");
}
function uid(prefix = "id") {
  return prefix + Math.random().toString(36).slice(2, 8);
}

// --- FX + Audio ---
let _ctx = null;
function audioCtx(){const Ctx=window.AudioContext||window.webkitAudioContext;if(!_ctx&&Ctx)_ctx=new Ctx();return _ctx;}
async function enableAudio(){const c=audioCtx();if(!c)return false;if(c.state==='suspended'){try{await c.resume();}catch{}}return true;}
function boom(vol=1){try{const c=audioCtx();if(!c)return;const t=c.currentTime;const buf=c.createBuffer(1,c.sampleRate*0.7,c.sampleRate);const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const noise=c.createBufferSource();noise.buffer=buf;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(700,t);const g1=c.createGain();g1.gain.setValueAtTime(0.0001,t);g1.gain.exponentialRampToValueAtTime(0.9*vol,t+0.015);g1.gain.exponentialRampToValueAtTime(0.0001,t+0.55);noise.connect(lp).connect(g1).connect(c.destination);const osc=c.createOscillator();osc.type='sawtooth';osc.frequency.setValueAtTime(160,t);osc.frequency.exponentialRampToValueAtTime(35,t+0.45);const g2=c.createGain();g2.gain.setValueAtTime(0.0001,t);g2.gain.exponentialRampToValueAtTime(0.6*vol,t+0.03);g2.gain.exponentialRampToValueAtTime(0.0001,t+0.6);osc.connect(g2).connect(c.destination);noise.start(t);noise.stop(t+0.6);osc.start(t);osc.stop(t+0.6);}catch{}}

// --- Cards ---
function makeCard(id) {
  const nums = shuffle(Array.from({ length: 25 }, (_, i) => i + 1)).slice(0, 15);
  const gridNums = [0, 1, 2].map((r) => nums.slice(r * 5, r * 5 + 5));
  const grid = gridNums.map((row) => {
    const bombCol = Math.floor(Math.random() * 5);
    return row.map((n, c) => ({ n, bomb: c === bombCol, daubed: false }));
  });
  return { id, grid, paused: false, exploded: false, daubs: 0, wantsShield: false, shieldUsed: false };
}

function CatalogCard(props) {
  const { card, selected, onToggle } = props;
  return (
    <div className={classNames("rounded-2xl border p-3 bg-white shadow-sm relative", selected ? "ring-2 ring-black" : "")}>
      <div className="absolute left-2 top-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900">Price: {CARD_PRICE}</div>
      <label className="absolute right-2 top-2 text-xs flex items-center gap-1">
        <input type="checkbox" checked={selected} onChange={onToggle} /> Select
      </label>
      <div className="mt-5 grid grid-cols-5 gap-2">
        {card.grid.flatMap((row, r) =>
          row.map((cell, c) => (
            <div key={r + "-" + c} className={classNames("aspect-square rounded-xl border flex items-center justify-center relative select-none","min-h-[38px] min-w-[38px]","bg-white border-gray-200")}>
              <div className="text-sm font-semibold">{cell.n}</div>
              {cell.bomb && <div className="absolute bottom-1 right-1">💣</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CardView(props) {
  const { card, lastCalled, phase } = props;
  if (phase !== 'live') {
    return (
      <div className="rounded-2xl border p-3 md:p-4 bg-white shadow-sm">
        <div className="mt-1 grid grid-cols-5 gap-2">
          {card.grid.flatMap((row, r) =>
            row.map((cell, c) => (
              <div key={r + "-" + c} className={classNames("aspect-square rounded-xl border flex items-center justify-center relative select-none","min-h-[44px] min-w-[44px]","bg-white border-gray-200")}>
                <div className="text-base md:text-lg font-semibold">{cell.n}</div>
                {cell.bomb && <div className="absolute bottom-1 right-1">💣</div>}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl md:rounded-3xl border p-3 md:p-4 bg-white shadow-sm relative overflow-hidden">
      <div className="mt-3 grid grid-cols-5 gap-2">
        {card.grid.flatMap((row, r) =>
          row.map((cell, c) => {
            const hl = lastCalled === cell.n && !cell.daubed;
            const cls = cell.daubed ? "bg-emerald-100 border-emerald-300" : (hl ? "bg-yellow-50 border-yellow-300" : "bg-white border-gray-200");
            return (
              <div key={r + "-" + c} className={classNames("aspect-square rounded-xl border flex items-center justify-center relative select-none","min-h-[44px] min-w-[44px]", cls)}>
                <div className="text-base md:text-lg font-semibold">{cell.n}</div>
                {cell.bomb && <div className="absolute bottom-1 right-1">💣</div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function App() {
  const [phase, setPhase] = useState('setup');
  const [roundSpeed, setRoundSpeed] = useState(800);
  const [called, setCalled] = useState([]);
  const lastCalled = called[called.length-1];

  const [wallet, setWallet] = useState(100);
  const [catalog, setCatalog] = useState(()=>Array.from({ length: CATALOG_SIZE }, ()=>makeCard(uid('c'))));
  const [selected, setSelected] = useState(()=>new Set());
  const [buyN, setBuyN] = useState(2);
  const [cards, setCards] = useState([]);
  const [audio, setAudio] = useState(false);
  const [volume, setVolume] = useState(1);

  // Poll shared round state
  useEffect(()=>{
    let stop = false;
    async function load() {
      try {
        const r = await fetch('/api/round/state', { cache: 'no-store' });
        const data = await r.json();
        if (stop) return;
        setPhase(data.phase || 'setup');
        setRoundSpeed(Number(data.speed_ms) || 800);
        setCalled(Array.isArray(data.called) ? data.called : []);
      } catch (e) {
        // keep UI alive even if API not ready
      }
    }
    load();
    const t = setInterval(load, 700);
    return ()=>{ stop = true; clearInterval(t); };
  }, []);

  function toggleSelectCard(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function buySelected() {
    const n = selected.size;
    if (!n) return;
    const cost = n * CARD_PRICE;
    if (wallet < cost) { alert("Not enough coins: need " + cost.toFixed(2)); return; }
    const toBuy = catalog.filter(c => selected.has(c.id));
    setCards(cs => [...cs, ...toBuy]);
    setWallet(w => w - cost);
    const remaining = catalog.filter(c => !selected.has(c.id));
    const refill = Array.from({ length: Math.max(0, CATALOG_SIZE - remaining.length) }, () => makeCard(uid('c')));
    setCatalog([...remaining, ...refill]);
    setSelected(new Set());
  }

  function buyRandom(n) {
    const count = Math.max(0, Math.floor(n || 0));
    if (!count) return;
    const cost = count * CARD_PRICE;
    if (wallet < cost) { alert("Not enough coins: need " + cost.toFixed(2)); return; }
    const newOnes = Array.from({ length: count }, () => makeCard(uid('c')));
    setCards(cs => [...cs, ...newOnes]);
    setWallet(w => w - cost);
  }

  // Apply latest called number to your cards
  useEffect(()=>{
    if (!called.length) return;
    const n = called[called.length-1];
    setCards(prev => prev.map(card=>{
      if (card.paused || card.exploded) return card;
      let exploded = card.exploded;
      let shieldUsed = card.shieldUsed;
      let justExploded = false;
      let justSaved = false;
      let daubs = card.daubs;
      const grid = card.grid.map(row => row.map(cell=>{
        if (cell.n === n) {
          if (cell.bomb) {
            if (card.wantsShield && !shieldUsed) { shieldUsed = true; justSaved = true; daubs += 1; return { ...cell, daubed: true }; }
            else { exploded = true; }
          } else { daubs += 1; return { ...cell, daubed: true }; }
        }
        return cell;
      }));
      if (!card.exploded && exploded) { justExploded = true; if (audio) boom(volume); }
      return { ...card, grid, exploded, daubs, shieldUsed, justExploded, justSaved };
    }));
    const t = setTimeout(()=> setCards(prev => prev.map(c => ({ ...c, justExploded:false, justSaved:false }))), 900);
    return ()=> clearTimeout(t);
  }, [called]);

  const winners = useMemo(()=>{
    const alive = cards.filter(c => !c.exploded);
    if (!alive.length) return [];
    const m = Math.max.apply(null, alive.map(c => c.daubs));
    return alive.filter(c => c.daubs === m);
  }, [cards]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto grid gap-3 md:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Bingo + Crash — Multiplayer</h1>
            <p className="text-xs md:text-sm text-gray-600">Pre-game purchase → shared caller (admin)</p>
          </div>
          <div className="text-xs text-gray-600">Wallet: <span className="font-semibold">{wallet.toFixed(2)}</span></div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl p-3 border shadow-sm flex items-center gap-2 overflow-auto">
          <div className="ml-auto flex items-center gap-2">
            {!audio ? (
              <button className="px-3 py-2 rounded-xl bg-black text-white text-sm" onClick={async()=>{ const ok=await enableAudio(); if(ok){ setAudio(true); boom(0.8);} }}>
                Enable Sound
              </button>
            ) : (
              <>
                <label className="text-xs text-gray-600">Vol</label>
                <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e=>setVolume(Number(e.target.value))}/>
                <button className="px-2 py-1 rounded-lg bg-gray-100 text-xs" onClick={()=>boom(volume)}>Test</button>
              </>
            )}
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
          {/* Left column */}
          {phase === 'setup' ? (
            <div className="rounded-3xl border p-4 bg-white shadow-sm">
              <h3 className="font-semibold mb-2">Purchase Panel</h3>
              <div className="text-xs text-gray-600">Card price: <span className="font-semibold">{CARD_PRICE}</span></div>
              <div className="mt-3 flex items-center gap-2">
                <input className="border rounded px-2 py-1 w-20 text-sm" type="number" min={1} value={buyN} onChange={e=>setBuyN(Math.max(1, Number(e.target.value)||1))}/>
                <button className="rounded-2xl px-3 py-2 bg-black text-white text-sm" onClick={()=>buyRandom(buyN)}>Buy {buyN}</button>
              </div>
              <div className="mt-3">
                <button className="rounded-2xl px-3 py-2 bg-emerald-600 text-white text-sm disabled:opacity-50" disabled={selected.size===0} onClick={buySelected}>
                  Buy Selected ({selected.size}) — {(selected.size*CARD_PRICE).toFixed(2)}
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-500">Waiting for host to start the round…</div>
            </div>
          ) : (
            <div className="rounded-3xl border p-4 bg-white shadow-sm">
              <h3 className="font-semibold mb-3">Caller</h3>
              <div className="h-16 rounded-xl bg-gray-100 flex items-center justify-center text-3xl font-bold">{lastCalled ?? "—"}</div>
              <div className="mt-2 text-xs text-gray-600">Speed: {(roundSpeed/1000).toFixed(1)}s · History below</div>
              <div className="mt-3 text-xs text-gray-600">History:</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {called.map((n)=>(
                  <span key={n} className="px-2 py-0.5 rounded-lg bg-gray-100 border text-gray-900 text-xs">{n}</span>
                ))}
              </div>
            </div>
          )}

          {/* Right column */}
          <div className="md:col-span-2 grid grid-cols-1 gap-3 md:gap-6">
            <div className="rounded-3xl border p-4 bg-white shadow-sm">
              <h3 className="font-semibold mb-3">Your Cards ({cards.length})</h3>
              {cards.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {cards.map(card => <CardView key={card.id} card={card} lastCalled={lastCalled} phase={phase}/>)}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No cards yet. Buy some from the Purchase Panel.</div>
              )}
            </div>

            {phase === 'setup' && (
              <div className="rounded-3xl border p-4 bg-white shadow-sm">
                <h3 className="font-semibold mb-3">Available Cards (select to buy)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {catalog.map(card => (
                    <div key={card.id} onClick={()=>toggleSelectCard(card.id)}>
                      <CatalogCard card={card} selected={selected.has(card.id)} onToggle={()=>toggleSelectCard(card.id)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase !== 'setup' && (
              <div className="rounded-3xl border p-3 bg-white">
                <h3 className="font-semibold">Round Summary</h3>
                {cards.filter(c=>!c.exploded).length===0 ? (
                  <div className="text-sm">No winners (all exploded).</div>
                ) : (
                  <div className="text-sm">Best daubs: {Math.max.apply(null, cards.filter(c=>!c.exploded).map(c=>c.daubs))}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
