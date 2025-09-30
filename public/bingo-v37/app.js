
// Bingo+Crash v3.8 — Merged Pre-game + Play UI with Purchase Panel
// React UMD + Babel (no build step).

const { useEffect, useMemo, useRef, useState } = React;

/** Config **/
const CARD_PRICE = 5;            // price per card (coins)
const CATALOG_SIZE = 8;          // how many selectable cards to show pre-game

/** Helpers **/
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}
function uid(prefix = "id") {
  return prefix + Math.random().toString(36).slice(2, 8);
}
function useInterval(cb, delay) {
  const ref = useRef(cb);
  useEffect(() => { ref.current = cb; }, [cb]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => ref.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
// Read ?round_ms= from the page URL, fallback to 800ms
function getRoundMsFromQuery(defaultMs = 800) {
  try {
    const ms = Number(new URLSearchParams(window.location.search).get('round_ms'));
    if (Number.isFinite(ms) && ms >= 100 && ms <= 5000) return ms;
  } catch {}
  return defaultMs;
}

/** Audio FX (unchanged) **/
let _ctx = null;
function audioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!_ctx && Ctx) _ctx = new Ctx();
  return _ctx;
}
async function enableAudio() {
  const c = audioCtx();
  if (!c) return false;
  if (c.state === "suspended") {
    try { await c.resume(); } catch {}
  }
  return true;
}
function boom(vol = 1) {
  try {
    const c = audioCtx();
    if (!c) return;
    const t = c.currentTime;
    const buf = c.createBuffer(1, c.sampleRate * 0.7, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const noise = c.createBufferSource();
    noise.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700, t);
    const g1 = c.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(0.9 * vol, t + 0.015);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    noise.connect(lp).connect(g1).connect(c.destination);
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.45);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.6 * vol, t + 0.03);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g2).connect(c.destination);
    noise.start(t); noise.stop(t + 0.6);
    osc.start(t); osc.stop(t + 0.6);
  } catch {}
}

/** Visual FX (unchanged CSS-in-JS) **/
function FX() {
  return (
    <style>{`
@keyframes explodeFlashLong {0%{opacity:0}10%{opacity:1}60%{opacity:.6}100%{opacity:0}}
.fx-flash-red{animation:explodeFlashLong 900ms ease-out forwards;background:radial-gradient(circle at center, rgba(255,0,0,.45), rgba(255,255,255,0) 65%)}
.fx-flash-blue{animation:explodeFlashLong 900ms ease-out forwards;background:radial-gradient(circle at center, rgba(59,130,246,.45), rgba(255,255,255,0) 65%)}
@keyframes shakeStrong{0%{transform:scale(1) translate(0)}20%{transform:scale(1.03) translate(-3px,3px)}40%{transform:scale(1.02) translate(3px,-3px)}60%{transform:scale(1.01) translate(-3px,-2px)}80%{transform:scale(1.02) translate(2px,3px)}100%{transform:scale(1) translate(0)}
}
.fx-shake-strong{animation:shakeStrong 750ms ease-in-out 1}
@keyframes puff{0%{transform:translateY(0) scale(.7);opacity:.95;filter:blur(2px)}60%{opacity:.6}100%{transform:translateY(-28px) scale(1.35);opacity:0;filter:blur(4px)}}
.puff{position:absolute;width:20px;height:20px;border-radius:9999px;background:radial-gradient(circle at 30% 30%, rgba(200,200,200,.95), rgba(200,200,200,.15));animation:puff 800ms ease-out forwards}
@keyframes debrisFly{0%{transform:translate(0,0) scale(.6);opacity:1}100%{transform:translate(var(--dx), var(--dy)) scale(1.05);opacity:0}}
.debris{position:absolute;width:6px;height:6px;border-radius:9999px;background:rgba(255,80,0,.9);animation:debrisFly 900ms ease-out forwards;}
@keyframes explosionImage {0%{transform:translate(-50%,-50%) scale(.7);opacity:1}60%{opacity:.9}100%{transform:translate(-50%,-50%) scale(1.25);opacity:0}}
.explosion-img{position:absolute;left:50%;top:50%;width:140%;height:auto;pointer-events:none;animation:explosionImage 900ms ease-out forwards}
`}</style>
  );
}
function Puffs() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => {
        const left = 8 + Math.random() * 84;
        const delay = i * 40;
        const size = 16 + Math.floor(Math.random() * 12);
        return (
          <div
            key={i}
            className="puff"
            style={{ left: `${left}%`, bottom: 10 + (i % 2) * 8, width: size, height: size, animationDelay: `${delay}ms` }}
          />
        );
      })}
    </>
  );
}
function Debris() {
  const parts = Array.from({ length: 10 }).map((_, i) => {
    const dx = Math.random() * 120 - 60;
    const dy = Math.random() * -80 - 20;
    const left = 50 + (Math.random() * 30 - 15);
    const top = 50 + (Math.random() * 20 - 10);
    return (
      <div
        key={i}
        className="debris"
        style={{ left: `${left}%`, top: `${top}%`, ["--dx"]: `${dx}px`, ["--dy"]: `${dy}px` }}
      />
    );
  });
  return <>{parts}</>;
}
function ExplosionFX() {
  const src = window.EXPLOSION_IMG;
  return (
    <>
      {src ? <img src={src} alt="explosion" className="explosion-img" /> : <>
        <div className="pointer-events-none absolute inset-0 fx-flash-red" />
        <Puffs />
        <Debris />
      </>}
    </>
  );
}

/** Game model **/
function makeCard(id) {
  const nums = shuffle(Array.from({ length: 25 }, (_, i) => i + 1)).slice(0, 15);
  const gridNums = [0, 1, 2].map((r) => nums.slice(r * 5, r * 5 + 5));
  const grid = gridNums.map((row) => {
    const bombCol = Math.floor(Math.random() * 5);
    return row.map((n, c) => ({ n, bomb: c === bombCol, daubed: false }));
  });
  return { id, grid, paused: false, exploded: false, daubs: 0, wantsShield: false, shieldUsed: false };
}
function newCaller() {
  const initialMs = getRoundMsFromQuery(800);
  return { deck: shuffle(Array.from({ length: 25 }, (_, i) => i + 1)), called: [], auto: false, speedMs: initialMs };
}

/** UI pieces **/
function CatalogCard({ card, selected, onToggle }) {
  return (
    <div className={classNames(
      "rounded-2xl border p-3 bg-white shadow-sm relative",
      selected ? "ring-2 ring-black" : ""
    )}>
      <div className="absolute left-2 top-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900">
        Price: {CARD_PRICE}
      </div>
      <label className="absolute right-2 top-2 text-xs flex items-center gap-1">
        <input type="checkbox" checked={selected} onChange={onToggle} />
        Select
      </label>
      <div className="mt-5 grid grid-cols-5 gap-2">
        {card.grid.flatMap((row, r) =>
          row.map((cell, c) => (
            <div key={`${r}-${c}`} className={classNames(
              "aspect-square rounded-xl border flex items-center justify-center relative select-none",
              "min-h-[38px] min-w-[38px]",
              "bg-white border-gray-200"
            )}>
              <div className="text-sm font-semibold">{cell.n}</div>
              {cell.bomb && <div className="absolute bottom-1 right-1">💣</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CardView({ card, lastCalled, onPause, phase }) {
  if (phase !== "live") {
    // Pre-game: show plain card without controls
    return (
      <div className="rounded-2xl border p-3 md:p-4 bg-white shadow-sm relative overflow-hidden">
        <div className="mt-1 grid grid-cols-5 gap-2">
          {card.grid.flatMap((row, r) =>
            row.map((cell, c) => (
              <div key={`${r}-${c}`} className={classNames(
                "aspect-square rounded-xl border flex items-center justify-center relative select-none",
                "min-h-[44px] min-w-[44px]",
                "bg-white border-gray-200"
              )}>
                <div className="text-base md:text-lg font-semibold">{cell.n}</div>
                {cell.bomb && <div className="absolute bottom-1 right-1">💣</div>}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Live round view
  const stateBadge = card.exploded
    ? <span className="ml-2 rounded-full bg-red-200 text-red-900 px-2 py-0.5 text-[11px]">EXPLODED</span>
    : card.paused
    ? <span className="ml-2 rounded-full bg-yellow-200 text-yellow-900 px-2 py-0.5 text-[11px]">LOCKED</span>
    : <span className="ml-2 rounded-full bg-emerald-200 text-emerald-900 px-2 py-0.5 text-[11px]">LIVE</span>;

  const shieldBadge = card.wantsShield && !card.shieldUsed
    ? <span className="ml-1 rounded-full bg-emerald-200 text-emerald-900 px-2 py-0.5 text-[10px]">shield active</span>
    : card.shieldUsed
    ? <span className="ml-1 rounded-full bg-red-200 text-red-900 px-2 py-0.5 text-[10px]">shield used</span>
    : null;

  return (
    <div className={classNames(
      "rounded-2xl md:rounded-3xl border p-3 md:p-4 bg-white shadow-sm relative overflow-hidden",
      (card.justExploded || card.justSaved) && "fx-shake-strong"
    )}>
      {card.justExploded && <ExplosionFX />}
      {card.justSaved && <div className="pointer-events-none absolute inset-0 fx-flash-blue" />}

      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-sm md:text-base flex items-center gap-2">
          {/* Name removed per spec; show only status */}
          {stateBadge}
          {shieldBadge}
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={card.paused || card.exploded}
            onClick={onPause}
            className={classNames(
              "rounded-xl md:rounded-2xl px-3 py-2 text-sm font-semibold min-h-[44px]",
              card.paused || card.exploded ? "bg-gray-200 text-gray-500" : "bg-yellow-400 text-black hover:bg-yellow-300"
            )}
          >
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>{card.paused || card.exploded ? "🔒" : "🔓"}</span>
              <span>{card.paused || card.exploded ? "Locked" : "Lock"}</span>
            </span>
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {card.grid.flatMap((row, r) =>
          row.map((cell, c) => (
            <div key={`${r}-${c}`} className={classNames(
              "aspect-square rounded-xl border flex items-center justify-center relative select-none",
              "min-h-[44px] min-w-[44px]",
              cell.daubed
                ? "bg-emerald-100 border-emerald-300"
                : (lastCalled === cell.n ? "bg-yellow-50 border-yellow-300" : "bg-white border-gray-200")
            )}>
              <div className="text-base md:text-lg font-semibold">{cell.n}</div>
              {cell.bomb && <div className="absolute bottom-1 right-1">💣</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** App **/
function App() {
  const [phase, setPhase] = useState("setup"); // setup → live → ended
  const [caller, setCaller] = useState(() => newCaller());
  const [players, setPlayers] = useState(() => {
    const you = { id: uid("p"), name: "You", cards: [] };
    return [you];
  });
  const you = players[0];

  // Wallet + audio
  const [wallet, setWallet] = useState(100);
  const [audio, setAudio] = useState(false);
  const [volume, setVolume] = useState(1);

  // Catalog & selection (pre-game)
  const [catalog, setCatalog] = useState(() => Array.from({ length: CATALOG_SIZE }, () => makeCard(uid("c"))));
  const [selected, setSelected] = useState(() => new Set());
  const [buyN, setBuyN] = useState(2);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [showRules, setShowRules] = useState(true);
  const [pendingStart, setPendingStart] = useState(false);

  // Derived
  const allCards = useMemo(() => you.cards, [you]);
  const lastCalled = caller.called[caller.called.length - 1];
  const liveCards = allCards.filter((c) => !c.paused && !c.exploded).length;
  const deckExhausted = caller.called.length === 25;
  const roundOver = deckExhausted || liveCards === 0;

  const winners = useMemo(() => {
    const alive = allCards.filter((c) => !c.exploded);
    if (!alive.length) return [];
    const m = Math.max(...alive.map((c) => c.daubs));
    return alive.filter((c) => c.daubs === m);
  }, [allCards]);

  // Interval driving the caller
  useInterval(() => {
    if (!caller.auto || phase !== "live" || roundOver) return;
    callNext();
  }, caller.auto ? caller.speedMs : null);

  // FX cleanup
  useEffect(() => {
    if (!allCards.some((c) => c.justExploded || c.justSaved)) return;
    const t = setTimeout(() => {
      setPlayers((ps) => {
        const me = ps[0];
        return [{ ...me, cards: me.cards.map((c) => ({ ...c, justExploded: false, justSaved: false })) }];
      });
    }, 900);
    return () => clearTimeout(t);
  }, [allCards]);

  useEffect(() => {
    // self-tests (adjusted)
    try {
      const c = newCaller();
      console.assert(c.deck.length === 25 && new Set(c.deck).size === 25, "Deck must be 25 unique");
      console.assert(c.speedMs >= 100 && c.speedMs <= 5000, "Auto speed should be within 100–5000ms");
    } catch (e) {
      console.warn("Self-tests failed", e);
    }
  }, []);

  /** Actions **/
  function resetAll() {
    setCaller(newCaller());
    setPlayers([{ id: uid("p"), name: "You", cards: [] }]);
    setPhase("setup");
    setRulesAccepted(false);
    setShowRules(true);
    setCatalog(Array.from({ length: CATALOG_SIZE }, () => makeCard(uid("c"))));
    setSelected(new Set());
  }

  function toggleSelectCard(cardId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function buySelectedCards() {
    const count = selected.size;
    if (!count) return;
    const cost = count * CARD_PRICE;
    if (wallet < cost) {
      alert(`Not enough coins: need ${cost.toFixed(2)}`);
      return;
    }
    const toBuy = catalog.filter((c) => selected.has(c.id));
    setPlayers((ps) => {
      const me = ps[0];
      return [{ ...me, cards: [...me.cards, ...toBuy] }];
    });
    setWallet((w) => w - cost);
    // remove bought from catalog & refill
    const remaining = catalog.filter((c) => !selected.has(c.id));
    const refill = Array.from({ length: Math.max(0, CATALOG_SIZE - remaining.length) }, () => makeCard(uid("c")));
    setCatalog([...remaining, ...refill]);
    setSelected(new Set());
  }

  function buyRandomCards(n) {
    const count = Math.max(0, Math.floor(n || 0));
    if (!count) return;
    const cost = count * CARD_PRICE;
    if (wallet < cost) {
      alert(`Not enough coins: need ${cost.toFixed(2)}`);
      return;
    }
    const newOnes = Array.from({ length: count }, () => makeCard(uid("c")));
    setPlayers((ps) => {
      const me = ps[0];
      return [{ ...me, cards: [...me.cards, ...newOnes] }];
    });
    setWallet((w) => w - cost);
  }

  function pauseCard(cardId) {
    setPlayers((ps) => {
      const me = ps[0];
      return [{
        ...me,
        cards: me.cards.map((c) => (c.id === cardId && !c.paused && !c.exploded ? { ...c, paused: true } : c))
      }];
    });
  }

  function callNext() {
    if (phase !== "live") return;
    setCaller((prev) => {
      if (prev.deck.length === 0) return prev;
      const n = prev.deck[0];
      const rest = prev.deck.slice(1);
      const called = [...prev.called, n];
      let anyBoom = false;

      setPlayers((ps) => {
        const me = ps[0];
        const nextMe = {
          ...me,
          cards: me.cards.map((card) => {
            if (card.paused || card.exploded) return card;
            let exploded = card.exploded;
            let shieldUsed = card.shieldUsed;
            let justExploded = false;
            let justSaved = false;
            let daubs = card.daubs;
            const grid = card.grid.map((row) =>
              row.map((cell) => {
                if (cell.n === n) {
                  if (cell.bomb) {
                    if (card.wantsShield && !shieldUsed) {
                      shieldUsed = true;
                      justSaved = true;
                      daubs += 1;
                      return { ...cell, daubed: true };
                    } else {
                      exploded = true;
                    }
                  } else {
                    daubs += 1;
                    return { ...cell, daubed: true };
                  }
                }
                return cell;
              })
            );
            if (!card.exploded && exploded) {
              anyBoom = true;
              justExploded = true;
            }
            return { ...card, grid, exploded, daubs, shieldUsed, justExploded, justSaved };
          })
        };
        return [nextMe];
      });

      if (anyBoom && audio) boom(volume);
      return { ...prev, deck: rest, called };
    });
  }

  function startRound() {
    if (!you.cards.length) {
      alert("Buy at least one card to start.");
      return;
    }
    setPhase("live");
  }

  /** Render **/
  const header = (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Bingo + Crash — 25 Ball (v3.8)</h1>
        <p className="text-xs md:text-sm text-gray-600">Merged pre-game and play · Purchase Panel → Caller</p>
      </div>
      <div className="text-xs text-gray-600">
        Wallet: <span className="font-semibold">{wallet.toFixed(2)}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <FX />
      <div className="max-w-7xl mx-auto grid gap-3 md:gap-6">
        {header}

        <div className="bg-white rounded-2xl p-3 border shadow-sm flex items-center gap-2 overflow-auto">
          <div className="ml-auto flex items-center gap-2">
            {!audio ? (
              <button
                className="px-3 py-2 rounded-xl bg-black text-white text-sm"
                onClick={async () => {
                  const ok = await enableAudio();
                  if (ok) {
                    setAudio(true);
                    boom(0.8);
                  }
                }}
              >
                Enable Sound
              </button>
            ) : (
              <>
                <label className="text-xs text-gray-600">Vol</label>
                <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                <button className="px-2 py-1 rounded-lg bg-gray-100 text-xs" onClick={() => boom(volume)}>
                  Test
                </button>
              </>
            )}
            <button className="px-3 py-2 rounded-xl bg-gray-100 text-sm" onClick={resetAll}>
              Reset
            </button>
            <button className="px-3 py-2 rounded-xl bg-gray-100 text-sm" onClick={() => setShowRules(true)}>
              Show Rules
            </button>
          </div>
        </div>

        {/* Rules modal */}
        {showRules && (
          <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => { setShowRules(false); setPendingStart(false); }} />
            <div className="relative w-full md:w-auto mx-2 md:mx-0 mb-4 md:mb-0 rounded-2xl bg-white p-4 md:p-6 shadow-xl border max-w-md">
              <h3 className="text-lg md:text-xl font-bold">How to Play</h3>
              <ul className="mt-2 text-sm text-gray-700 space-y-2 list-disc pl-5">
                <li>Pre-game: pick cards to buy, or buy N random from the left panel.</li>
                <li>When round starts, Purchase Panel turns into the Caller.</li>
                <li>If a called number has a bomb, your card <b className='text-red-600'>explodes</b> (unless shielded).</li>
                <li><b>Shield</b> absorbs the first bomb on that card.</li>
                <li><b>Winners</b>: non-exploded cards with the most daubs.</li>
              </ul>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => { setShowRules(false); setPendingStart(false); }} className="rounded-xl px-3 py-2 bg-gray-100 text-sm">Close</button>
                <button onClick={() => { setRulesAccepted(true); setShowRules(false); if (pendingStart) { setPendingStart(false); startRound(); } }} className="rounded-xl px-4 py-2 bg-black text-white text-sm">Got it</button>
              </div>
            </div>
          </div>
        )}

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
          {/* Left column: Purchase Panel OR Caller */}
          {phase === "setup" ? (
            <div className="rounded-3xl border p-4 bg-white shadow-sm">
              <h3 className="font-semibold mb-2">Purchase Panel</h3>
              <div className="text-xs text-gray-600">Card price: <span className="font-semibold">{CARD_PRICE}</span></div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  className="border rounded px-2 py-1 w-20 text-sm"
                  type="number"
                  min={1}
                  value={buyN}
                  onChange={(e) => setBuyN(Math.max(1, Number(e.target.value) || 1))}
                />
                <button className="rounded-2xl px-3 py-2 bg-black text-white text-sm"
                        onClick={() => buyRandomCards(buyN)}>
                  Buy {buyN}
                </button>
              </div>
              <div className="mt-3">
                <button
                  className="rounded-2xl px-3 py-2 bg-emerald-600 text-white text-sm disabled:opacity-50"
                  disabled={selected.size === 0}
                  onClick={buySelectedCards}
                >
                  Buy Selected ({selected.size}) — {(selected.size * CARD_PRICE).toFixed(2)}
                </button>
              </div>
              <div className="mt-6">
                <button
                  className="rounded-2xl px-4 py-2 bg-sky-600 text-white text-sm disabled:opacity-50"
                  onClick={() => {
                    if (!rulesAccepted) {
                      setShowRules(true);
                      setPendingStart(true);
                      return;
                    }
                    startRound();
                  }}
                  disabled={you.cards.length === 0}
                  title={you.cards.length ? "" : "Buy at least one card"}
                >
                  Start Round
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border p-4 bg-white shadow-sm">
              <h3 className="font-semibold mb-3">Caller</h3>
              <div className="h-16 rounded-xl bg-gray-100 flex items-center justify-center text-3xl font-bold">{lastCalled ?? "—"}</div>
              <div className="mt-2 text-xs text-gray-600">Speed: {(caller.speedMs/1000).toFixed(1)}s · Live cards: {you.cards.filter(c=>!c.paused && !c.exploded).length}</div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="rounded-2xl px-3 py-2 bg-black text-white text-sm disabled:opacity-50" onClick={callNext} disabled={phase !== "live" || roundOver}>
                  Call Next
                </button>
                <button
                  className={classNames("rounded-2xl px-3 py-2 text-sm", caller.auto ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-900")}
                  onClick={() => setCaller((c) => ({ ...c, auto: !c.auto }))}
                  disabled={phase !== "live" || roundOver}
                >
                  {caller.auto ? "Auto: ON" : "Auto: OFF"}
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-600">History:</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {caller.called.map((n) => (
                  <span key={n} className="px-2 py-0.5 rounded-lg bg-gray-100 border text-gray-900 text-xs">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Right column: Cards */}
          <div className="md:col-span-2 grid grid-cols-1 gap-3 md:gap-6">
            {/* Owned cards (always visible) */}
            <div className="rounded-3xl border p-4 bg-white shadow-sm">
              <h3 className="font-semibold mb-3">Your Cards ({you.cards.length})</h3>
              {you.cards.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {you.cards.map((card) => (
                    <CardView key={card.id} card={card} lastCalled={lastCalled} onPause={() => pauseCard(card.id)} phase={phase} />
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No cards yet. Buy some from the Purchase Panel.</div>
              )}
            </div>

            {/* Catalog only pre-game */}
            {phase === "setup" && (
              <div className="rounded-3xl border p-4 bg-white shadow-sm">
                <h3 className="font-semibold mb-3">Available Cards (select to buy)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {catalog.map((card) => (
                    <CatalogCard
                      key={card.id}
                      card={card}
                      selected={selected.has(card.id)}
                      onToggle={() => toggleSelectCard(card.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Round summary only after live */}
            {phase !== "setup" && (
              <div className="rounded-3xl border p-3 bg-white">
                <h3 className="font-semibold">Round Summary</h3>
                {winners.length === 0 ? (
                  <div className="text-sm">No winners (all exploded).</div>
                ) : winners.length === 1 ? (
                  <div className="text-sm">
                    Winner: <span className="font-semibold">Your card</span> with {winners[0].daubs} daubs.
                  </div>
                ) : (
                  <div className="text-sm">Winning cards: {winners.length} with {winners[0].daubs} daubs.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
