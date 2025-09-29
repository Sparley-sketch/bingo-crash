// Bingo+Crash v3.7 — Full playable app (Lock UI merged onto v3.6 base)
// React UMD + Babel (no build step).

var CALL_INTERVAL_MS = (typeof window !== 'undefined' && Number.isFinite(window.ROUND_MS))
  ? window.ROUND_MS
  : 800; // default/fallback

const { useEffect, useMemo, useRef, useState } = React;

const TABS = ["Setup", "Play", "Spectate"];

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

// near your imports / component top:
const getDelayFromQuery = () => {
  if (typeof window === 'undefined') return undefined;
  const ms = Number(new URLSearchParams(window.location.search).get('round_ms'));
  return Number.isFinite(ms) ? ms : undefined;
};

// inside your component:
const [delay, setDelay] = React.useState(() => getDelayFromQuery() ?? 800);

// if you have a slider that updates speed, it should call setDelay(newMs)

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

function FX() {
  return (
    <style>{`
@keyframes explodeFlashLong {0%{opacity:0}10%{opacity:1}60%{opacity:.6}100%{opacity:0}}
.fx-flash-red{animation:explodeFlashLong 900ms ease-out forwards;background:radial-gradient(circle at center, rgba(255,0,0,.45), rgba(255,255,255,0) 65%)}
.fx-flash-blue{animation:explodeFlashLong 900ms ease-out forwards;background:radial-gradient(circle at center, rgba(59,130,246,.45), rgba(255,255,255,0) 65%)}
@keyframes shakeStrong{0%{transform:scale(1) translate(0)}20%{transform:scale(1.03) translate(-3px,3px)}40%{transform:scale(1.02) translate(3px,-3px)}60%{transform:scale(1.01) translate(-3px,-2px)}80%{transform:scale(1.02) translate(2px,3px)}100%{transform:scale(1) translate(0)}}
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

function makeCard(id, name) {
  const nums = shuffle(Array.from({ length: 25 }, (_, i) => i + 1)).slice(0, 15);
  const gridNums = [0, 1, 2].map((r) => nums.slice(r * 5, r * 5 + 5));
  const grid = gridNums.map((row) => {
    const bombCol = Math.floor(Math.random() * 5);
    return row.map((n, c) => ({ n, bomb: c === bombCol, daubed: false }));
  });
  return { id, name, grid, paused: false, exploded: false, daubs: 0, wantsShield: false, shieldUsed: false };
}

function newCaller() {
  return { deck: shuffle(Array.from({ length: 25 }, (_, i) => i + 1)), called: [], auto: false, speedMs: 3000 };
}

function RulesModal({ open, onClose, onAccept }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:w-auto mx-2 md:mx-0 mb-4 md:mb-0 rounded-2xl bg-white p-4 md:p-6 shadow-xl border max-w-md">
        <h3 className="text-lg md:text-xl font-bold">How to Play</h3>
        <ul className="mt-2 text-sm text-gray-700 space-y-2 list-disc pl-5">
          <li>Tap the <b>Lock</b> button to lockin your card.</li>
          <li>If a called number has a bomb, your card <b className='text-red-600'>explodes</b> (unless shielded).</li>
          <li><b>Shield</b>: choose before the round. Absorbs the first bomb on that card. You can set shields per-card or bulk for all a player's cards.</li>
          <li><b>Winner(s)</b>: non-exploded card(s) with the most daubs. Ties split the prize equally.</li>
        </ul>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-3 py-2 bg-gray-100 text-sm">Close</button>
          <button onClick={onAccept} className="rounded-xl px-4 py-2 bg-black text-white text-sm">Got it, start</button>
        </div>
      </div>
    </div>
  );
}

function CellView({ cell, highlight }) {
  const stateClass = cell.daubed
    ? "bg-emerald-100 border-emerald-300"
    : highlight
    ? "bg-yellow-50 border-yellow-300"
    : "bg-white border-gray-200";
  return (
    <div
      className={classNames(
        "aspect-square rounded-xl border flex items-center justify-center relative select-none",
        "min-h-[44px] min-w-[44px]",
        stateClass
      )}
    >
      <div className="text-base md:text-lg font-semibold">{cell.n}</div>
      {cell.bomb && <div className="absolute bottom-1 right-1">💣</div>}
    </div>
  );
}

function CardView({ card, lastCalled, onPause }) {
  const badge = card.exploded ? (
    <span className="ml-2 rounded-full bg-red-200 text-red-900 px-2 py-0.5 text-[11px]">EXPLODED</span>
  ) : card.paused ? (
    <span className="ml-2 rounded-full bg-yellow-200 text-yellow-900 px-2 py-0.5 text-[11px]">LOCKED</span>
  ) : (
    <span className="ml-2 rounded-full bg-emerald-200 text-emerald-900 px-2 py-0.5 text-[11px]">LIVE</span>
  );

  const shieldBadge = card.wantsShield && !card.shieldUsed ? (
    <span className="ml-1 rounded-full bg-emerald-200 text-emerald-900 px-2 py-0.5 text-[10px]">shield active</span>
  ) : card.shieldUsed ? (
    <span className="ml-1 rounded-full bg-red-200 text-red-900 px-2 py-0.5 text-[10px]">shield used</span>
  ) : null;

  return (
    <div
      className={classNames(
        "rounded-2xl md:rounded-3xl border p-3 md:p-4 bg-white shadow-sm relative overflow-hidden",
        (card.justExploded || card.justSaved) && "fx-shake-strong"
      )}
    >
      {card.justExploded && <ExplosionFX />}
      {card.justSaved && <div className="pointer-events-none absolute inset-0 fx-flash-blue" />}
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-sm md:text-base flex items-center gap-2">
          {card.name} {badge}
          {shieldBadge}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs md:text-sm text-gray-600">
            Daubs: <span className="font-semibold text-gray-900">{card.daubs}</span>
          </div>
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
            <CellView key={`${r}-${c}`} cell={cell} highlight={lastCalled === cell.n && !cell.daubed} />
          ))
        )}
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("Setup");
  const [phase, setPhase] = useState("setup");
  const [caller, setCaller] = useState(() => newCaller());
  const [players, setPlayers] = useState(() => {
    const p1 = { id: uid("p"), name: "Player 1", cards: [makeCard(uid("c"), "P1 #1"), makeCard(uid("c"), "P1 #2")] };
    const p2 = { id: uid("p"), name: "Player 2", cards: [makeCard(uid("c"), "P2 #1"), makeCard(uid("c"), "P2 #2")] };
    return [p1, p2];
  });
  const [audio, setAudio] = useState(false);
  const [volume, setVolume] = useState(1);
  const [shieldCostPct, setShieldCostPct] = useState(25);
  const [wallet, setWallet] = useState(100);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [showRules, setShowRules] = useState(true);
  const [pendingStart, setPendingStart] = useState(false);

  useEffect(() => {
    try {
      const c = newCaller();
      console.assert(c.deck.length === 25 && new Set(c.deck).size === 25, "Deck must be 25 unique");
      console.assert(c.speedMs === 3000, "Auto speed should be fixed at 3000ms");
      const test = makeCard("t", "T");
      console.assert(test.grid.length === 3 && test.grid.every((r) => r.length === 5), "Card must be 3x5");
      console.assert(test.grid.every((r) => r.filter((x) => x.bomb).length === 1), "One bomb per row");
      (function testShieldSave() {
        const card = makeCard("ts", "Test");
        card.wantsShield = true; card.shieldUsed = false;
        const bombNum = 99;
        card.grid[0][0] = { n: bombNum, bomb: true, daubed: false };
        let exploded = false; let shieldUsed = card.shieldUsed; let daubs = card.daubs;
        const grid = card.grid.map((row) => row.map((cell) => {
          if (cell.n === bombNum) {
            if (cell.bomb) {
              if (card.wantsShield && !shieldUsed) { shieldUsed = true; daubs += 1; return { ...cell, daubed: true }; }
              else { exploded = true; }
            }
          }
          return cell;
        }));
        const savedCell = grid[0][0];
        console.assert(savedCell.daubed && shieldUsed && !exploded && daubs === 1, "Shield save must daub & count");
      })();
    } catch (e) {
      console.warn("Self-tests failed", e);
    }
  }, []);

  const allCards = React.useMemo(() => players.flatMap((p) => p.cards), [players]);
  const lastCalled = caller.called[caller.called.length - 1];
  const liveCards = allCards.filter((c) => !c.paused && !c.exploded).length;
  const deckExhausted = caller.called.length === 25;
  const roundOver = deckExhausted || liveCards === 0;

  const winners = React.useMemo(() => {
    const alive = allCards.filter((c) => !c.exploded);
    if (!alive.length) return [];
    const m = Math.max(...alive.map((c) => c.daubs));
    return alive.filter((c) => c.daubs === m);
  }, [allCards]);

  useInterval(() => {
    if (!caller.auto || phase !== "live" || roundOver) return;
    callNext();
  }, caller.auto ? caller.speedMs : null);

  useEffect(() => {
    if (!allCards.some((c) => c.justExploded || c.justSaved)) return;
    const t = setTimeout(() => setPlayers((ps) => ps.map((pl) => ({ ...pl, cards: pl.cards.map((c) => ({ ...c, justExploded: false, justSaved: false })) }))), 900);
    return () => clearTimeout(t);
  }, [allCards]);

  useEffect(() => {
    if (roundOver && phase === "live") {
      setPhase("ended");
      setTab("Spectate");
    }
  }, [roundOver, phase]);

  function addPlayer() {
    const idx = players.length + 1;
    setPlayers((ps) => [...ps, { id: uid("p"), name: `Player ${idx}`, cards: [] }]);
  }
  function removePlayer(id) {
    setPlayers((ps) => (ps.length > 1 ? ps.filter((p) => p.id !== id) : ps));
  }
  function renamePlayer(id, name) {
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
  }
  function buyCards(id, count) {
    if (count <= 0) return;
    setPlayers((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p;
        const next = [...p.cards];
        for (let i = 0; i < count; i++) {
          next.push(makeCard(uid("c"), `${p.name} #${next.length + 1}`));
        }
        return { ...p, cards: next };
      })
    );
  }

  function toggleCardShield(cardId, on) {
    setPlayers((ps) => ps.map((p) => ({ ...p, cards: p.cards.map((c) => (c.id === cardId ? { ...c, wantsShield: on } : c)) })));
  }
  function shieldAllForPlayer(playerId, on) {
    setPlayers((ps) => ps.map((p) => (p.id === playerId ? { ...p, cards: p.cards.map((c) => ({ ...c, wantsShield: on })) } : p)));
  }

  function pauseCard(cardId) {
    setPlayers((ps) =>
      ps.map((p) => ({ ...p, cards: p.cards.map((c) => (c.id === cardId && !c.paused && !c.exploded ? { ...c, paused: true } : c)) }))
    );
  }

  function startRound() {
    const shieldedCount = allCards.filter((c) => c.wantsShield).length;
    const cost = shieldedCount * (shieldCostPct / 100);
    if (wallet < cost) {
      alert(`Not enough coins: need ${cost.toFixed(2)} for ${shieldedCount} shields`);
      return;
    }
    setWallet((w) => w - cost);
    setPhase("live");
    setTab("Play");
  }
  function handleStartRound() {
    if (!rulesAccepted) {
      setShowRules(true);
      setPendingStart(true);
      return;
    }
    startRound();
  }
  function resetAll() {
    setCaller(newCaller());
    setPlayers([
      { id: uid("p"), name: "Player 1", cards: [makeCard(uid("c"), "P1 #1"), makeCard(uid("c"), "P1 #2")] },
      { id: uid("p"), name: "Player 2", cards: [makeCard(uid("c"), "P2 #1"), makeCard(uid("c"), "P2 #2")] },
    ]);
    setPhase("setup");
    setTab("Setup");
    setRulesAccepted(false);
    setShowRules(true);
  }

  function callNext() {
    if (phase !== "live") return;
    setCaller((prev) => {
      if (prev.deck.length === 0) return prev;
      const n = prev.deck[0];
      const rest = prev.deck.slice(1);
      const called = [...prev.called, n];
      let anyBoom = false;

      setPlayers((ps) =>
        ps.map((player) => ({
          ...player,
          cards: player.cards.map((card) => {
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
          }),
        }))
      );

      if (anyBoom && audio) boom(volume);
      return { ...prev, deck: rest, called };
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <FX />
      <div className="max-w-7xl mx-auto grid gap-3 md:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Bingo + Crash — 25 Ball (v3.7)</h1>
            <p className="text-xs md:text-sm text-gray-600">Multi-player · Shields · 3s auto-caller · Explosion FX</p>
          </div>
          <div className="text-xs text-gray-600">
            Wallet: <span className="font-semibold">{wallet.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 border shadow-sm flex items-center gap-2 overflow-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={classNames("px-3 py-2 rounded-xl text-sm", tab === t ? "bg-black text-white" : "bg-gray-100")}>
              {t}
            </button>
          ))}
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

        <RulesModal
          open={showRules}
          onClose={() => {
            setShowRules(false);
            setPendingStart(false);
          }}
          onAccept={() => {
            setRulesAccepted(true);
            setShowRules(false);
            if (pendingStart) {
              setPendingStart(false);
              startRound();
            }
          }}
        />

        {tab === "Setup" && (
          <div className="grid gap-3">
            <div className="rounded-2xl border p-3 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Players</h3>
                <div className="text-xs text-gray-600">
                  Shield cost per card:{" "}
                  <input
                    className="w-16 text-center border rounded ml-1"
                    type="number"
                    value={shieldCostPct}
                    onChange={(e) => setShieldCostPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  />
                  %
                </div>
              </div>
              <div className="mt-3 grid gap-3">
                {players.map((p) => (
                  <div key={p.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <input className="border rounded px-2 py-1 text-sm" value={p.name} onChange={(e) => renamePlayer(p.id, e.target.value)} />
                        <button className="rounded-lg px-2 py-1 bg-gray-100 text-xs disabled:opacity-50" disabled={players.length <= 1} onClick={() => removePlayer(p.id)}>
                          Remove
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input className="border rounded px-2 py-1 w-16 text-sm" type="number" min={1} defaultValue={2} id={`buy-${p.id}`} />
                        <button
                          className="rounded-lg px-2 py-1 bg-black text-white text-xs"
                          onClick={() => {
                            const input = document.getElementById(`buy-${p.id}`);
                            const n = Math.max(1, Number(input?.value) || 0);
                            buyCards(p.id, n);
                          }}
                        >
                          Buy n cards
                        </button>
                        <button className="rounded-lg px-2 py-1 bg-sky-100 text-sky-900 text-xs" onClick={() => shieldAllForPlayer(p.id, true)}>
                          Shield all
                        </button>
                        <button className="rounded-lg px-2 py-1 bg-sky-50 text-sky-700 text-xs" onClick={() => shieldAllForPlayer(p.id, false)}>
                          Unshield all
                        </button>
                      </div>
                    </div>
                    {p.cards.length > 0 ? (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {p.cards.map((c) => (
                          <label key={c.id} className="rounded-lg border p-2 flex items-center justify-between text-xs">
                            <span className="truncate mr-2">{c.name}</span>
                            <span className="flex items-center gap-1">
                              <input type="checkbox" checked={c.wantsShield} onChange={(e) => toggleCardShield(c.id, e.target.checked)} />
                              Shield
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 mt-2">No cards yet.</div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button className="rounded-xl px-3 py-2 bg-gray-100" onClick={addPlayer}>
                  Add Player
                </button>
                <button className="ml-auto rounded-xl px-4 py-2 bg-emerald-600 text-white" onClick={handleStartRound}>
                  Start Round
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "Play" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
            <div className="rounded-3xl border p-4 bg-white shadow-sm">
              <h3 className="font-semibold mb-3">Caller</h3>
              <div className="h-16 rounded-xl bg-gray-100 flex items-center justify-center text-3xl font-bold">{lastCalled ?? "—"}</div>
              <div className="mt-2 text-xs text-gray-600">Speed: {(caller.speedMs/1000).toFixed(0)}s · Live cards: {liveCards}</div>
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

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
              {allCards.map((card) => (
                <CardView key={card.id} card={card} lastCalled={lastCalled} onPause={() => pauseCard(card.id)} />
              ))}
            </div>
          </div>
        )}

        {tab === "Spectate" && (
          <div className="grid gap-3">
            <div className="rounded-2xl border p-3 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Spectator Mode</h3>
                <div className="text-xs text-gray-600">Phase: {phase}</div>
              </div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {players.map((p) => {
                  const alive = p.cards.filter((c) => !c.exploded);
                  const maxDaubs = alive.length ? Math.max(...alive.map((c) => c.daubs)) : 0;
                  return (
                    <div key={p.id} className="rounded-xl border p-3 bg-gray-50">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-xs text-gray-600">Cards: {p.cards.length}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-600">Best daubs: {maxDaubs}</div>
                      <div className="mt-2 grid grid-cols-3 gap-1">
                        {p.cards.slice(0, 6).map((c) => (
                          <div key={c.id} className="text-[11px] px-2 py-1 rounded bg-white border truncate">
                            {c.exploded ? "💥" : c.paused ? "🔒" : "•"} {c.daubs}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border p-3 bg-white">
              <h3 className="font-semibold">Round Summary</h3>
              {winners.length === 0 ? (
                <div className="text-sm">No winners (all exploded).</div>
              ) : winners.length === 1 ? (
                <div className="text-sm">
                  Winner: <span className="font-semibold">{winners[0].name}</span> with {winners[0].daubs} daubs.
                </div>
              ) : (
                <div className="text-sm">Winners ({winners.length}) with {winners[0].daubs} daubs. Prize split equally.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
