// Bingo + Crash — Multiplayer client (light theme)
// React (UMD) + Babel — no build step

const { useEffect, useState, useRef } = React;

function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function uid(p='id'){ return p+Math.random().toString(36).slice(2,8); }

// ---- Audio + Haptics ----
let _ctx=null;
function audioCtx(){ const Ctx=window.AudioContext||window.webkitAudioContext; if(!_ctx && Ctx) _ctx=new Ctx(); return _ctx; }
async function enableAudio(){ const c=audioCtx(); if(!c) return false; if(c.state==='suspended'){ try{ await c.resume(); }catch{} } return true; }
function vibrate(ms){ try{ if(navigator?.vibrate) navigator.vibrate(ms); }catch{} }
function boom(vol=0.85){ try{ const c=audioCtx(); if(!c) return; const t=c.currentTime;
  const buf=c.createBuffer(1,c.sampleRate*0.6,c.sampleRate); const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  const s=c.createBufferSource(); s.buffer=buf; const g=c.createGain();
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.025); g.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
  s.connect(g).connect(c.destination); s.start(t); s.stop(t+0.55);
}catch{} }

// ---- Card helpers ----
// 5x3 grid, 15 numbers (1..25) with 3 bombs at random positions.
function makeCard(id,name){
  const nums = shuffle(Array.from({length:25},(_,i)=>i+1)).slice(0,15);
  const gridNums = [0,1,2].map(r => nums.slice(r*5, r*5+5));
  const bombIdxs = new Set(shuffle(Array.from({length:15},(_,i)=>i)).slice(0,3));
  const grid = gridNums.map((row,r) =>
    row.map((n,c)=>{
      const flat = r*5 + c;
      return { n, bomb: bombIdxs.has(flat), daubed:false };
    })
  );
  return {
    id, name, grid,
    paused:false, exploded:false, daubs:0,
    wantsShield:false, shieldUsed:false,
    justExploded:false, justSaved:false
  };
}

function applyCallToCards(cards, n, audioOn, volume){
  let anyBoom=false;
  const next = cards.map(card=>{
    if(card.paused || card.exploded) return card;

    let exploded = card.exploded;
    let shieldUsed = card.shieldUsed;
    let daubs = card.daubs;
    let justExploded = false;
    let justSaved = false;

    const grid = card.grid.map(row => row.map(cell=>{
      if(cell.n!==n || cell.daubed) return cell;
      if(cell.bomb){
        if(card.wantsShield && !shieldUsed){
          shieldUsed = true;
          justSaved = true;
          daubs += 1;
          return {...cell, daubed:true};
        }else{
          exploded = true;
          return cell;
        }
      }else{
        daubs += 1;
        return {...cell, daubed:true};
      }
    }));

    if(!card.exploded && exploded){
      anyBoom = true;
      justExploded = true;
    }
    return {...card, grid, exploded, daubs, shieldUsed, justExploded, justSaved};
  });

  if(anyBoom){
    vibrate([80,40,120]);
    if(audioOn) boom(volume);
  }
  setTimeout(()=>{ next.forEach(c=>{ c.justExploded=false; c.justSaved=false; }); }, 900);
  return next;
}

// Icons
const ICON_LOCK_OPEN  = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="%231e293b"><path d="M7 10V7a5 5 0 1 1 10 0h-2a3 3 0 1 0-6 0v3h10v12H5V10h2z"/></svg>';
const ICON_LOCK_CLOSED= 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="%231e293b"><path d="M7 10V8a5 5 0 1 1 10 0v2h2v12H5V10h2zm2 0h6V8a3 3 0 1 0-6 0v2z"/></svg>';

// Explosion image (animated GIF)
const EXPLOSION_SRC = '/bingo-v37/explosion.gif';
const SHIELD_ICON = '/bingo-v37/shield.png';

function Cell({cell, highlight}){
  const cls=['cell']; if(cell.daubed) cls.push('daub'); else if(highlight) cls.push('hl');
  return (
    <div className={cls.join(' ')}>
      <span className="num">{cell.n}</span>
      {cell.bomb && <div className="bomb">💣</div>}
    </div>
  );
}

function FXStyles(){
  return (
    <style>{`
/* ========== Layout primitives ========== */
.grid{ display:grid; }
.row{ display:flex; align-items:center; gap:12px; flex-wrap:nowrap; }
.list .chip{ margin:2px 4px 0 0; }

.btn{ border:1px solid #e2e8f0; background:#f8fafc; color:#0f172a; padding:6px 10px; border-radius:8px; cursor:pointer; }
.btn.primary{ background:#3b82f6; border-color:#3b82f6; color:#fff; }
.btn.gray{ background:#eef2f7; }
.btn:disabled{ opacity:.5; cursor:not-allowed; }
.chip{ background:#f1f5f9; border:1px solid #e2e8f0; padding:6px 10px; border-radius:999px; }
.title{ font-size:22px; font-weight:800; margin:0 0 4px; }
.muted{ color:#64748b; font-size:14px; }

/* Outer grid: 2 columns on the right for cards */
.cardsGrid{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; }
.twoCol{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }

/* ========== Card & Grid (mobile-safe, responsive) ========== */
.card{
  position:relative; overflow:hidden; padding:12px; border-radius:16px; background:#fff;
  border:1px solid #e2e8f0; box-shadow:0 4px 18px rgba(15,23,42,.04);
  min-width:0; width:100%; box-sizing:border-box;
}
.ownedCard{ border:1.5px solid #22c55e !important; box-shadow:0 0 0 3px rgba(34,197,94,.12); }
.burned{ background:#0b0b0b !important; border-color:#111 !important; filter:saturate(.2) contrast(.9); }

/* Header bits */
.priceTag{
  display:inline-flex; align-items:center; padding:2px 8px; font-size:12px; line-height:1;
  border-radius:999px; background:#f1f5f9; border:1px solid #e2e8f0; color:#0f172a; white-space:nowrap;
}
.shieldCtl{ font-size:12px; white-space:nowrap; }
.shieldCtl input{ vertical-align:middle; }
.shieldIcon{ height:16px; width:auto; display:inline-block; vertical-align:middle; }


/* Grid of 5 columns */
.gridCard{
  display:grid; grid-template-columns:repeat(5, minmax(0,1fr));
  gap:var(--cell-gap, 8px); width:100%; min-width:0;
}
.cell{
  position:relative; display:grid; place-items:center;
  aspect-ratio:1 / 1; border:1px solid #e2e8f0; border-radius:var(--cell-radius,10px);
  background:#fff; min-width:0; box-sizing:border-box; padding:0;
}
.cell .num{
  display:block; width:100%; text-align:center; font-weight:700;
  font-size:var(--cell-font,16px); line-height:1; white-space:nowrap; overflow:hidden;
}
.cell.daub{ background:#dcfce7; border-color:#86efac; }
.cell.hl{ background:#fef9c3; border-color:#fde047; }
.bomb{
  position:absolute; top:6px; right:6px; font-size:var(--bomb-font,12px); line-height:1; pointer-events:none; z-index:2;
}

/* Explosion overlay */
.explosion-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain; z-index:5; pointer-events:none; }

/* Phase sizing (desktop/base) */
.phase-live .cell .num{ --cell-font:15px; }
.phase-live .bomb{ --bomb-font:11px; }

/* iOS anti-zoom for alias box */
.aliasInput{ font-size:16px; }

/* =================== Mobile responsiveness =================== */
/* iPhone 12 Pro and similar (≤ 390px wide): shrink cards more aggressively */
@media (max-width: 400px){
  .twoCol{ grid-template-columns:1fr; }     /* left panel stacks above */
  .cardsGrid{ grid-template-columns: repeat(2, minmax(0,1fr)); gap:8px; }
  .card{ padding:8px; border-radius:12px; }
  .gridCard{ --cell-gap:4px; }
  .cell{ --cell-radius:7px; }
  /* numbers & bombs respond to viewport so 2 columns always fit */
  .cell .num{ --cell-font: clamp(9px, 3.1vw, 12px); }
  .bomb{ --bomb-font: clamp(7.5px, 2.5vw, 10px); top:3px; right:3px; }
  .phase-live .cell .num{ --cell-font: clamp(9px, 3.0vw, 12px); }
  .phase-live .bomb{ --bomb-font: clamp(7px, 2.3vw, 9.5px); }
  .priceTag{ font-size:11px; padding:2px 6px; }
  .shieldCtl{ font-size:11px; }
  .shieldIcon{ height:14px; }
}

/* Small phones (401–480px) */
@media (min-width: 401px) and (max-width: 480px){
  .twoCol{ grid-template-columns:1fr 1fr; }
  .cardsGrid{ grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .card{ padding:10px; border-radius:14px; }
  .gridCard{ --cell-gap:6px; }
  .cell{ --cell-radius:8px; }
  .cell .num{ --cell-font: clamp(10px, 2.9vw, 13px); }
  .bomb{ --bomb-font: clamp(8.5px, 2.3vw, 11px); top:4px; right:4px; }
  .phase-live .cell .num{ --cell-font: clamp(10px, 2.8vw, 13px); }
  .phase-live .bomb{ --bomb-font: clamp(8px, 2.1vw, 10.5px); }
}

/* Larger phones & small tablets */
@media (min-width: 481px) and (max-width: 820px){
  .twoCol{ grid-template-columns:1fr 1fr; }
  .cardsGrid{ grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .gridCard{ --cell-gap:7px; }
  .cell{ --cell-radius:9px; }
  .cell .num{ --cell-font: clamp(12px, 2.2vw, 16px); }
  .bomb     { --bomb-font: clamp(10px, 1.7vw, 12px); }
}
`}</style>
  );
}

function CardView({
  card, lastCalled,
  onPause,
  phase,
  selectable, selected, onSelectToggle,
  owned = false,
  showShield = false,       // pre-buy only (available pool)
  onShieldToggle = () => {},
  showLock = false          // live only
}){
  const wrapperCls=['card'];
  if(selectable && selected) wrapperCls.push('isSelected');
  if(owned) wrapperCls.push('ownedCard');
  if(card.exploded) wrapperCls.push('burned');

  return (
    <div
      className={wrapperCls.join(' ')}
      onClick={() => { if(selectable) onSelectToggle(card.id); }}
      style={selectable ? { cursor:'pointer', outline:selected?'3px solid #2563eb40':'none', position:'relative' } : {position:'relative'}}
    >
      <FXStyles />

      {/* Explosion GIF overlay */}
      {card.justExploded && <img src={EXPLOSION_SRC} className="explosion-img" alt="boom" />}

      <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
        {/* LEFT: price + shield (pre-buy only) */}
        <div className="row" style={{gap:8}}>
          {phase === 'setup' && selectable && (
            <>
              <span className="priceTag">1 coin</span>
              <label className="row shieldCtl" style={{gap:6}}
                     onClick={(e)=>e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={!!card.wantsShield}
                  onChange={(e)=>onShieldToggle(card.id, e.target.checked)}
                />
                Shield
              </label>
            </>
          )}
          {/* Purchased (not selectable) & still in setup -> show "Shield active" */}
          {phase === 'setup' && !selectable && card.wantsShield && (
		  <img src={SHIELD_ICON} alt="Shield active" className="shieldIcon" />
		)}
        </div>

        {/* RIGHT: daubs / badges / lock (game only) */}
        <div className="row" style={{gap:8, alignItems:'center'}}>
          {phase === 'live' && (
            <span className="badge" style={{background:'#f1f5f9', padding:'2px 6px', borderRadius:'8px'}}>Daubs: <b>{card.daubs}</b></span>
          )} 
			{phase === 'live' && card.wantsShield && !card.shieldUsed && (
			  <img src={SHIELD_ICON} alt="Shield active" className="shieldIcon" />
			)}
          {showLock && (
            <button className="btn gray"
                    onClick={(e)=>{ e.stopPropagation(); onPause(card.id); }}
                    disabled={card.paused || card.exploded}>
              <span className="row" style={{gap:6, alignItems:'center'}}>
                <img src={card.paused ? ICON_LOCK_CLOSED : ICON_LOCK_OPEN} alt="" />
                {card.paused || card.exploded ? 'Locked' : 'Lock'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="gridCard" style={{marginTop:10}}>
        {card.grid.flatMap((row,r)=>row.map((cell,c)=>
          <Cell key={r+'-'+c} cell={cell} highlight={lastCalled===cell.n && !cell.daubed} />
        ))}
      </div>
    </div>
  );
}

// Simple modal
function Modal({open, onClose, children, title, primaryText='Got it', onPrimary}){
  if(!open) return null;
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50}}>
      <div className="card" style={{maxWidth:560, width:'92%', borderRadius:16}}>
        {title && <h3 className="title" style={{marginBottom:8}}>{title}</h3>}
        <div className="muted" style={{whiteSpace:'pre-line'}}>{children}</div>
        <div className="row" style={{justifyContent:'flex-end', marginTop:12}}>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={onPrimary || onClose}>{primaryText}</button>
        </div>
      </div>
    </div>
  );
}

function App(){
  // Alias + wallet
  const [alias, setAlias]     = useState('');
  const [askAlias, setAsk]    = useState(true);
  const [wallet, setWallet]   = useState(100);
  const [resetKey, setResetKey] = useState(0);

  // useRef hooks MUST be inside a component:
  const ownedAtStartRef = useRef(0);
  const postedOutRef    = useRef(false);

  // Available (pre-buy) vs Owned (purchased)
  const freshAvail = () => Array.from({length:4},()=>makeCard(uid('pool'),'')); // start with 4 visible
  const [available, setAvailable] = useState(freshAvail);
  const [selectedPool, setSelectedPool] = useState(new Set());
  const [player, setPlayer] = useState(()=>({ id:uid('p'), cards:[] })); // owned

  const [audio, setAudio] = useState(false);
  const [volume, setVolume] = useState(0.85);

  // Round state from server
  const [roundId, setRoundId] = useState(null);
  const [phase,setPhase] = useState('setup');
  const [speedMs,setSpeedMs] = useState(800);
  const [called,setCalled] = useState([]);

  // Popups
  const [showHowTo, setShowHowTo] = useState(true);
  const [syncedWinner, setSyncedWinner] = useState(null); // {alias, daubs} | null

  // ensure we only end once
  const endPostedRef = useRef(false);

  // ---------- Pre-buy actions (include shields) ----------
  function toggleSelectPool(id){ setSelectedPool(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function generateCards(n){
    n=Math.max(1,Math.min(12,Number(n)||0));
    setAvailable(a=>[...a, ...Array.from({length:n},()=>makeCard(uid('pool'),''))]);
  }
  function buySelected(){
    const price = 1;
    const picks = available.filter(c=>selectedPool.has(c.id));
    const cost  = picks.length * price;
    if (picks.length === 0) return;
    if (wallet < cost) { alert(`Not enough coins. Need ${cost}.`); return; }
    setWallet(w=>w - cost);

    // Move selected available -> owned preserving wantsShield; refresh ids
    const ownedAdd = picks.map(c => ({ ...c, id: uid('c') }));
    setPlayer(p=>({...p, cards:[...p.cards, ...ownedAdd]}));
    setAvailable(a=>a.filter(c=>!selectedPool.has(c.id)));
    setSelectedPool(new Set());
	
	// After successful purchase, mark this alias as "joined" for the current round.
    if (alias) {
      fetch('/api/round/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias })
      }).catch(() => {});
    }
  }
  // shield per-card for AVAILABLE pool (pre-buy only)
  function toggleShieldAvailable(cardId,on){
    setAvailable(a=>a.map(c=>c.id===cardId?({...c, wantsShield:on}):c));
  }
  // bulk shields on SELECTED available cards
  function shieldSelectedAvailable(on){
    setAvailable(a=>a.map(c=> selectedPool.has(c.id) ? ({...c, wantsShield:on}) : c ));
  }

  // Owned management
  function pauseOwned(cardId){ setPlayer(p=>({...p, cards:p.cards.map(c=>(c.id===cardId && !c.paused && !c.exploded)?({...c, paused:true}):c)})); }

  // Poll state + transitions + global winner sync + stop caller on game over
  useEffect(()=>{
    let mounted=true, lastPhase='setup', lastCount=0;

    async function maybeEndRoundOnServer(id){
      if (endPostedRef.current || !id) return;
      endPostedRef.current = true;
      try{
        await fetch('/api/round/end?ts='+Date.now(), { method:'POST', cache:'no-store', headers:{Accept:'application/json'}});
      }catch{}
    }

    async function pull(){
      let s = null;
      try{
        const r=await fetch('/api/round/state?ts='+Date.now(), {cache:'no-store', headers:{Accept:'application/json'}});
        s=await r.json();
        if(!mounted) return;

        const newPhase = s.phase || 'setup';
        const newCalls = Array.isArray(s.called) ? s.called : [];
        setRoundId(s.id || null);

        // RESET TO SETUP: clear purchases & selections, regenerate Available and force paint
        if ((lastPhase !== 'setup' && newPhase === 'setup') || (newCalls.length < lastCount)) {
          setPlayer({ id: uid('p'), cards: [] });
          setAvailable(freshAvail());
          setSelectedPool(new Set());
          setShowHowTo(true);
          setSyncedWinner(null);
          setAsk(true);
          endPostedRef.current = false;
          setResetKey(k => k + 1);     // <- forces a repaint
        }

        // Apply new calls to owned cards
        if (newCalls.length > lastCount) {
          const news = newCalls.slice(lastCount);
          let next = player.cards;
          news.forEach(n => { next = applyCallToCards(next, n, audio, volume); });
          setPlayer(p=>({...p, cards: next}));

          const hasProgress = newCalls.length > 0;
          if (newPhase === 'live' && hasProgress && ownedAtStartRef.current > 0) {
            const liveMine = next.filter(c => !c.exploded && !c.paused).length;
            if (liveMine === 0 && !postedOutRef.current && alias) {
              postedOutRef.current = true;
              fetch('/api/round/out', {
                method:'POST',
                headers:{ 'Content-Type':'application/json' },
                body: JSON.stringify({ alias })
              }).catch(()=>{});
            }
          }
        }

        // End-game detection
        if (newPhase === 'live' && s.id) {
          const deckExhausted = newCalls.length >= 25;
          const liveMine = player.cards.filter(c => !c.exploded && !c.paused).length;

          if (deckExhausted || liveMine === 0) {
            const alive = player.cards.filter(c=>!c.exploded);
            const best = alive.length ? Math.max(...alive.map(c=>c.daubs)) : 0;
            if (alias) {
              fetch(`/api/round/winner?ts=${Date.now()}`, {
                method:'POST',
                headers:{'Content-Type':'application/json', Accept:'application/json'},
                body: JSON.stringify({ round_id: s.id, alias, daubs: best })
              }).catch(()=>{});
            }
            // Stop further calls globally
            maybeEndRoundOnServer(s.id);
          }
        }

        // when phase enters live, remember how many cards I had at start, and reset "postedOut" flag
        if (lastPhase !== 'live' && newPhase === 'live') {
          ownedAtStartRef.current = (player.cards || []).length;
          postedOutRef.current = false;
        }	
		
        // Poll current winner (same for everyone)
        if (s.id) {
          fetch(`/api/round/winner?round_id=${encodeURIComponent(s.id)}&ts=${Date.now()}`, { cache:'no-store' })
            .then(r=>r.json())
            .then(w=>{ if (w?.alias) setSyncedWinner({ alias:w.alias, daubs:w.daubs }); })
            .catch(()=>{});
        }

        lastPhase = newPhase; lastCount = newCalls.length;
        setPhase(newPhase);
        setSpeedMs(Number(s.speed_ms)||800);
        setCalled(newCalls);

        // If server says round ended, sequence winner popup and stop any local auto-caller
        if (newPhase === 'ended') {
          if (typeof setAutoRun === 'function') setAutoRun(false);
          if (s.id) {
            fetch(`/api/round/winner?round_id=${encodeURIComponent(s.id)}&ts=${Date.now()}`, { cache:'no-store' })
              .then(r => r.json())
              .then(w => {
                if (w?.alias) setSyncedWinner({ alias: w.alias, daubs: w.daubs });
                else setSyncedWinner({ alias: '—', daubs: 0 });
              })
              .catch(() => setSyncedWinner({ alias: '—', daubs: 0 }));
          } else {
            setSyncedWinner({ alias: '—', daubs: 0 });
          }
        }

      }catch(e){
        // swallow errors to keep polling resilient
      }
    }

    pull();
    const id=setInterval(pull, 1000);
    return ()=>{ mounted=false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.cards, audio, volume, alias]);

  const lastCalled = called[called.length-1];

  return (
    <div key={resetKey} className={`grid ${phase === 'live' ? 'phase-live' : 'phase-setup'}`} style={{gap:14}} >
      {/* Header */}
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <h2 className="title">Bingo + Crash — Multiplayer</h2>
          <div className="muted">Wallet: <b>{wallet}</b> coins · Alias: <b>{alias || '—'}</b></div>
        </div>
        <div className="row">
          {!audio
            ? <button className="btn primary" onClick={async()=>{ if(await enableAudio()){ setAudio(true); boom(0.6);} }}>Enable Sound</button>
            : (<div className="row"><span className="muted">Vol</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e)=>setVolume(Number(e.target.value))}/></div>)
          }
        </div>
      </div>

      {/* Body */}
      <div className="grid twoCol">
        {/* Left: Purchase Panel (setup) / Caller (live) */}
        <div className="card">
          {phase==='live'
            ? (<>
                <div className="muted">Caller</div>
                <div className="chip" style={{fontSize:36, fontWeight:900, textAlign:'center', padding:'12px 20px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:12}}>{lastCalled ?? '—'}</div>
                <div className="muted" style={{marginTop:6}}>Speed: {(speedMs/1000).toFixed(1)}s · History</div>
                <div className="list" style={{marginTop:8}}>{called.map(n=><span key={n} className="chip">{n}</span>)}</div>
              </>)
            : (<>
                <div className="row" style={{flexWrap:'wrap', gap:8}}>
                  <div className="muted" style={{marginRight:'auto'}}>Purchase Panel</div>
                  <input id="genN" className="chip" style={{padding:'8px 10px'}} type="number" min="1" max="12" defaultValue="2"/>
                  <button className="btn" onClick={()=>{ const el=document.getElementById('genN'); generateCards(Number(el?.value)||2); }}>Generate n</button>
                  {/* bulk shields for SELECTED AVAILABLE */}
                  <button className="btn" onClick={()=>shieldSelectedAvailable(true)} disabled={selectedPool.size===0}>Shield selected</button>
                  <button className="btn" onClick={()=>shieldSelectedAvailable(false)} disabled={selectedPool.size===0}>Unshield selected</button>
                  <button className="btn primary" onClick={buySelected} disabled={selectedPool.size===0}>Buy selected</button>
                </div>
              </>)
          }
        </div>

        {/* Right: Setup → OWNED first, then AVAILABLE; Live → OWNED with LOCKS */}
        <div className="card">
          {phase==='setup' ? (
            <>
              {/* Purchased / Owned */}
              {player.cards.length===0
                ? <div className="muted" style={{marginTop:8}}>You don’t own any cards yet.</div>
                : <div className="cardsGrid" style={{marginTop:10}}>
                    {player.cards.map(c=>
                      <CardView
                        key={c.id}
                        card={c}
                        lastCalled={null}
                        onPause={()=>{}}
                        phase="setup"
                        selectable={false}
                        selected={false}
                        onSelectToggle={()=>{}}
                        owned={true}
                        showShield={false}
                        onShieldToggle={()=>{}}
                        showLock={false}
                      />
                    )}
                  </div>
              }

              {/* Available pool */}
              <div className="row" style={{justifyContent:'space-between', marginTop:16}}>
                <div className="muted">Available Cards ({available.length}) · Selected: {selectedPool.size}</div>
              </div>
              {available.length===0
                ? <div className="muted" style={{marginTop:8}}>No available cards. Use “Generate n”.</div>
                : <div className="cardsGrid" style={{marginTop:10}}>
                    {available.map(c=>
                      <CardView
                        key={c.id}
                        card={c}
                        lastCalled={null}
                        onPause={()=>{}}
                        phase="setup"
                        selectable={true}
                        selected={selectedPool.has(c.id)}
                        onSelectToggle={id=>toggleSelectPool(id)}
                        owned={false}
                        showShield={true}
                        onShieldToggle={toggleShieldAvailable}
                        showLock={false}
                      />
                    )}
                  </div>
              }
            </>
          ) : (
            <>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="muted">My Cards ({player.cards.length})</div>
              </div>
              {player.cards.length===0
                ? <div className="muted" style={{marginTop:8}}>No cards owned.</div>
                : <div className="cardsGrid" style={{marginTop:10}}>
                    {player.cards.map(c=>
                      <CardView
                        key={c.id}
                        card={c}
                        lastCalled={called[called.length-1]}
                        onPause={pauseOwned}
                        phase="live"
                        selectable={false}
                        selected={false}
                        onSelectToggle={()=>{}}
                        owned={true}
                        showShield={false}
                        onShieldToggle={()=>{}}
                        showLock={true}
                      />
                    )}
                  </div>
              }
            </>
          )}
        </div>
      </div>

      {/* Popups */}
      <Modal
        open={showHowTo}
        onClose={()=>setShowHowTo(false)}
        title="How to Play"
        primaryText="Got it, start"
      >
        • Tap the <b>Lock</b> button to lockin your card.
        {'\n'}• If a called number has a <b>bomb</b>, your card explodes <i>(unless shielded)</i>.
        {'\n'}• <b>Shield</b>: choose on available cards <i>before buying</i>. Absorbs the first bomb on that card.
        {'\n'}• <b>Winner(s)</b>: non-exploded card(s) with the most daubs. Ties split the prize equally.
      </Modal>

      {/* Winner modal (synced across players) */}
      <Modal
        open={!!syncedWinner}
        onClose={()=>location.reload()}
        title="Game Over"
        primaryText="OK"
        onPrimary={()=>location.reload()}
      >
        {syncedWinner ? <>Winner: <b>{syncedWinner.alias}</b> with <b>{syncedWinner.daubs}</b> daubs.</> : '—'}
      </Modal>

      {/* Alias prompt */}
      <Modal
        open={askAlias}
        onClose={()=>{}}
        title="Choose an alias"
        primaryText="Save"
        onPrimary={()=>{
          const el=document.getElementById('alias_input');
          const val=(el?.value||'').trim();
          if(!val){ alert('Please enter an alias.'); return; }
          setAlias(val);
          setAsk(false);
        }}
      >
        <div className="row" style={{marginTop:8}}>
          <input id="alias_input"
                 className="chip aliasInput"
                 style={{padding:'10px 12px', width:'100%'}}
                 placeholder="Your alias"/>
        </div>
      </Modal>
    </div>
  );
    return React.createElement('div', null, 'Replace this stub with the full file contents from app.fixed2.js');
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
