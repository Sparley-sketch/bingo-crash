// Bingo + Crash — Multiplayer client (light theme)
// React (UMD) + Babel — no build step

const { useEffect, useState } = React;

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
// 5x3 grid, 15 numbers (1..25), with **3 bombs total** at random positions.
function makeCard(id,name){
  const nums = shuffle(Array.from({length:25},(_,i)=>i+1)).slice(0,15);
  const gridNums = [0,1,2].map(r => nums.slice(r*5, r*5+5));
  const bombIdxs = new Set(shuffle(Array.from({length:15},(_,i)=>i)).slice(0,3)); // pick 3 of 15
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

function resetCardsForNewRound(cards){
  return cards.map(c=>({
    ...c,
    paused:false, exploded:false, daubs:0, shieldUsed:false, justExploded:false, justSaved:false,
    grid: c.grid.map(r=>r.map(cell=>({...cell, daubed:false})))
  }));
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
    vibrate([80,40,120]);     // haptic
    if(audioOn) boom(volume); // sound
  }

  // clear transient FX flags
  setTimeout(()=>{ next.forEach(c=>{ c.justExploded=false; c.justSaved=false; }); }, 900);
  return next;
}

// ---- Tiny inline icons (open/closed lock) ---
const ICON_LOCK_OPEN  = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="%231e293b"><path d="M7 10V7a5 5 0 1 1 10 0h-2a3 3 0 1 0-6 0v3h10v12H5V10h2z"/></svg>';
const ICON_LOCK_CLOSED= 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="%231e293b"><path d="M7 10V8a5 5 0 1 1 10 0v2h2v12H5V10h2zm2 0h6V8a3 3 0 1 0-6 0v2z"/></svg>';

// ---- UI atoms ----
function Cell({cell, highlight}){
  const cls=['cell']; if(cell.daubed) cls.push('daub'); else if(highlight) cls.push('hl');
  return <div className={cls.join(' ')}><div style={{fontWeight:700}}>{cell.n}</div>{cell.bomb && <div className="bomb">💣</div>}</div>;
}

// Explosion flash CSS (light)
function FXStyles(){
  return (
    <style>{`
      @keyframes explodeFlash {0%{opacity:0}15%{opacity:1}60%{opacity:.6}100%{opacity:0}}
      .fx-flash{animation:explodeFlash 900ms ease-out forwards;background:radial-gradient(circle at center, rgba(239,68,68,.25), rgba(255,255,255,0) 65%);position:absolute;inset:0;pointer-events:none;border-radius:14px}
    `}</style>
  );
}

function CardView({
  card, lastCalled,
  onPause, onShieldToggle,
  selectable, selected, onSelectToggle
}){
  const status = card.exploded ? <span className="badge boom">EXPLODED</span>
               : card.paused   ? <span className="badge lock">LOCKED</span>
                               : <span className="badge live">LIVE</span>;

  const sBadge = card.wantsShield && !card.shieldUsed ? <span className="badge shield">shield</span>
                : card.shieldUsed ? <span className="badge" style={{background:'#ffe4e6',borderColor:'#fecdd3'}}>shield used</span>
                : null;

  const wrapperCls=['card']; if(selectable && selected) wrapperCls.push('isSelected');

  return (
    <div
      className={wrapperCls.join(' ')}
      onClick={() => { if(selectable) onSelectToggle(card.id); }}
      style={selectable ? { cursor:'pointer', outline:selected?'3px solid #2563eb40':'none' } : undefined}
    >
      <FXStyles />
      {card.justExploded && <div className="fx-flash" />}
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          {/* Lock icon changes with paused state */}
          <img src={card.paused ? ICON_LOCK_CLOSED : ICON_LOCK_OPEN} alt="" style={{width:18,height:18}} />
          <div className="row" style={{gap:8}}>
            <div style={{fontWeight:700}}>Card</div>
            {status}{sBadge}
            <span className="badge">Daubs: <b>{card.daubs}</b></span>
          </div>
        </div>
        <div className="row" style={{gap:8}}>
          <label className="row" style={{gap:6, fontSize:12, color:'#475569'}}
                 onClick={(e)=>e.stopPropagation()}>
            <input type="checkbox"
                   checked={card.wantsShield}
                   onChange={e=>onShieldToggle(card.id,e.target.checked)} />
            Shield
          </label>
          <button className="btn gray"
                  onClick={(e)=>{ e.stopPropagation(); onPause(card.id); }}
                  disabled={card.paused || card.exploded}>
            <span className="row" style={{gap:6, alignItems:'center'}}>
              <img src={card.paused ? ICON_LOCK_CLOSED : ICON_LOCK_OPEN} alt="" />
              {card.paused || card.exploded ? 'Locked' : 'Lock'}
            </span>
          </button>
        </div>
      </div>

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
  // Player (this viewer)
  const [player, setPlayer] = useState(()=>({
    id: uid('p'),
    cards: [makeCard(uid('c'),'#1'), makeCard(uid('c'),'#2'), makeCard(uid('c'),'#3'), makeCard(uid('c'),'#4')]
  }));
  const [selectedIds, setSelectedIds] = useState(new Set()); // select own cards (pre-game)
  const [audio, setAudio] = useState(false);
  const [volume, setVolume] = useState(0.85);

  // Round state from server
  const [phase,setPhase] = useState('setup');
  const [speedMs,setSpeedMs] = useState(800);
  const [called,setCalled] = useState([]);

  // Popups
  const [showHowTo, setShowHowTo] = useState(true);   // show on first load or when reset to setup
  const [gameOver, setGameOver] = useState(null);     // number | null

  // Helpers
  function toggleSelect(id){ setSelectedIds(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function addCards(n){ n=Math.max(1,Math.min(12,Number(n)||0));
    setPlayer(p=>({...p, cards:[...p.cards, ...Array.from({length:n}).map((_,i)=>makeCard(uid('c'),'#'+(p.cards.length+i+1)))]}));
  }
  function shieldAll(on){ setPlayer(p=>({...p, cards:p.cards.map(c=>({...c, wantsShield:on}))})); }
  function toggleShield(cardId,on){ setPlayer(p=>({...p, cards:p.cards.map(c=>c.id===cardId?({...c, wantsShield:on}):c)})); }
  function pauseCard(cardId){ setPlayer(p=>({...p, cards:p.cards.map(c=>(c.id===cardId && !c.paused && !c.exploded)?({...c, paused:true}):c)})); }

  // Poll state + transitions
  useEffect(()=>{
    let mounted=true, lastPhase = phase, lastCount = called.length;

    async function pull(){
      try{
        const r=await fetch('/api/round/state?ts='+Date.now(), {cache:'no-store', headers:{Accept:'application/json'}});
        const s=await r.json();
        if(!mounted) return;

        const newPhase = s.phase || 'setup';
        const newCalls = Array.isArray(s.called) ? s.called : [];

        // Phase flip to setup -> clear visuals + show HowTo
        if (lastPhase !== 'setup' && newPhase === 'setup') {
          setPlayer(p=>({...p, cards: resetCardsForNewRound(p.cards)}));
          setShowHowTo(true);
          setGameOver(null);
          setSelectedIds(new Set());
        }

        // Call list shrink (reset) -> clear
        if (newCalls.length < lastCount) {
          setPlayer(p=>({...p, cards: resetCardsForNewRound(p.cards)}));
          setShowHowTo(true);
          setGameOver(null);
          setSelectedIds(new Set());
        }

        // Apply new calls
        if (newCalls.length > lastCount) {
          const news = newCalls.slice(lastCount);
          let next = player.cards;
          news.forEach(n => { next = applyCallToCards(next, n, audio, volume); });
          setPlayer(p=>({...p, cards: next}));
        }

        // Detect game over for *this viewer*: no live cards (not exploded & not paused)
        const liveNow = player.cards.filter(c => !c.exploded && !c.paused).length;
        if (newPhase === 'live' && liveNow === 0 && !gameOver) {
          const alive = player.cards.filter(c=>!c.exploded);
          const best = alive.length ? Math.max(...alive.map(c=>c.daubs)) : 0;
          setGameOver(best);
        }

        lastPhase = newPhase;
        lastCount = newCalls.length;
        setPhase(newPhase);
        setSpeedMs(Number(s.speed_ms)||800);
        setCalled(newCalls);
      }catch{}
    }

    pull();
    const id=setInterval(pull, 1000);
    return ()=>{ mounted=false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.cards, audio, volume]);

  const lastCalled = called[called.length-1];

  return (
    <div className="grid" style={{gap:14}}>
      {/* Header */}
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <h2 className="title">Bingo + Crash — Multiplayer</h2>
          <div className="muted">Aim: have the most daubs without exploding. Ties split the prize.</div>
        </div>
        <div className="row">
          {!audio
            ? <button className="btn primary" onClick={async()=>{ if(await enableAudio()){ setAudio(true); boom(0.6);} }}>Enable Sound</button>
            : (<div className="row"><span className="muted">Vol</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></div>)
          }
        </div>
      </div>

      {/* Body */}
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
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
                <div className="row" style={{justifyContent:'space-between'}}>
                  <div className="muted">Purchase Panel</div>
                  <div className="row" style={{gap:6}}>
                    <input id="addN" className="chip" style={{padding:'8px 10px'}} type="number" min="1" max="12" defaultValue="2"/>
                    <button className="btn" onClick={()=>shieldAll(true)}>Shield all</button>
                    <button className="btn" onClick={()=>shieldAll(false)}>Unshield all</button>
                    <button className="btn primary" onClick={()=>{ const el=document.getElementById('addN'); addCards(Number(el?.value)||2); }}>Add n cards</button>
                  </div>
                </div>
                <div className="muted" style={{marginTop:8}}>Tip: tap your cards on the right to select them (pre-game only).</div>
              </>)
          }
        </div>

        {/* Right: Your Cards (tap-to-select in setup) */}
        <div className="card">
          <div className="row" style={{justifyContent:'space-between'}}>
            <div className="muted">Your Cards ({player.cards.length})</div>
            {phase==='setup' && <div className="muted">Selected: {selectedIds.size}</div>}
          </div>

          {player.cards.length===0
            ? <div className="muted" style={{marginTop:8}}>No cards yet. Use “Add n cards”.</div>
            : <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12, marginTop:10}}>
                {player.cards.map(c=>
                  <CardView
                    key={c.id}
                    card={c}
                    lastCalled={lastCalled}
                    onPause={pauseCard}
                    onShieldToggle={toggleShield}
                    selectable={phase==='setup'}
                    selected={selectedIds.has(c.id)}
                    onSelectToggle={toggleSelect}
                  />
                )}
              </div>
          }
        </div>
      </div>

      {/* Footer summary */}
      <div className="card">
        <div className="muted">Round Summary</div>
        {phase!=='live' && <div className="muted" style={{marginTop:6}}>Waiting for round to start…</div>}
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
        {'\n'}• <b>Shield</b>: choose before the round. Absorbs the first bomb on that card. You can set shields per-card or bulk for all a player's cards.
        {'\n'}• <b>Winner(s)</b>: non-exploded card(s) with the most daubs. Ties split the prize equally.
      </Modal>

      <Modal
        open={gameOver != null}
        onClose={()=>setGameOver(null)}
        title="Game Over"
        primaryText="OK"
      >
        Winner has <b>{gameOver ?? 0}</b> daubs.
      </Modal>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
