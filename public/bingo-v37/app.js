// Bingo + Crash — Multiplayer client (light theme)
// React (UMD) + Babel

const { useEffect, useState } = React;

function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function uid(p='id'){ return p+Math.random().toString(36).slice(2,8); }

// ---- Audio (optional) ----
let _ctx=null;
function audioCtx(){ const Ctx=window.AudioContext||window.webkitAudioContext; if(!_ctx && Ctx) _ctx=new Ctx(); return _ctx; }
async function enableAudio(){ const c=audioCtx(); if(!c) return false; if(c.state==='suspended'){ try{ await c.resume(); }catch{} } return true; }
function boom(vol=0.8){ try{ const c=audioCtx(); if(!c) return; const t=c.currentTime;
  const buf=c.createBuffer(1,c.sampleRate*0.6,c.sampleRate); const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  const s=c.createBufferSource(); s.buffer=buf; const g=c.createGain();
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
  s.connect(g).connect(c.destination); s.start(t); s.stop(t+0.55);
}catch{}}

// ---- Card helpers ----
function makeCard(id,name){
  const nums=shuffle(Array.from({length:25},(_,i)=>i+1)).slice(0,15);
  const gridNums=[0,1,2].map(r=>nums.slice(r*5,r*5+5));
  const grid=gridNums.map(row=>{
    const bombCol=Math.floor(Math.random()*5);
    return row.map((n,c)=>({ n, bomb:c===bombCol, daubed:false }));
  });
  return { id,name, grid, paused:false, exploded:false, daubs:0,
           wantsShield:false, shieldUsed:false, justExploded:false, justSaved:false };
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
  const next=cards.map(card=>{
    if(card.paused || card.exploded) return card;
    let exploded=card.exploded, shieldUsed=card.shieldUsed, daubs=card.daubs, justExploded=false, justSaved=false;
    const grid=card.grid.map(row=>row.map(cell=>{
      if(cell.n!==n || cell.daubed) return cell;
      if(cell.bomb){
        if(card.wantsShield && !shieldUsed){ shieldUsed=true; justSaved=true; daubs+=1; return {...cell, daubed:true}; }
        else { exploded=true; return cell; }
      } else { daubs+=1; return {...cell, daubed:true}; }
    }));
    if(!card.exploded && exploded){ justExploded=true; anyBoom=true; }
    return {...card, grid, exploded, daubs, shieldUsed, justExploded, justSaved};
  });
  if(anyBoom && audioOn) boom(volume);
  setTimeout(()=>{ next.forEach(c=>{ c.justExploded=false; c.justSaved=false; }); }, 900);
  return next;
}

// tiny inline lock image (light) – data URI
const LOCK_IMG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="%231e293b"><path d="M17 8V7a5 5 0 0 0-10 0v1H5v14h14V8h-2zm-8-1a3 3 0 0 1 6 0v1H9V7zm8 13H7v-9h10v9z"/></svg>';

function Cell({cell,highlight}){
  const cls=['cell']; if(cell.daubed) cls.push('daub'); else if(highlight) cls.push('hl');
  return <div className={cls.join(' ')}><div style={{fontWeight:700}}>{cell.n}</div>{cell.bomb && <div className="bomb">💣</div>}</div>;
}

function Card({
  card,
  lastCalled,
  onPause,
  onShieldToggle,
  selectable,
  selected,
  onSelectToggle
}){
  const status = card.exploded ? <span className="badge boom">EXPLODED</span>
               : card.paused   ? <span className="badge lock">LOCKED</span>
                               : <span className="badge live">LIVE</span>;
  const sBadge = card.wantsShield && !card.shieldUsed ? <span className="badge shield">shield</span>
                : card.shieldUsed ? <span className="badge" style={{background:'#ffe4e6',borderColor:'#fecdd3'}}>shield used</span>
                : null;

  const wrapperCls = ['card'];
  if (selectable && selected) wrapperCls.push('isSelected');

  return (
    <div
      className={wrapperCls.join(' ')}
      onClick={() => { if (selectable) onSelectToggle(card.id); }}
      style={selectable ? { cursor: 'pointer', outline: selected ? '3px solid #2563eb40' : 'none' } : undefined}
    >
      <div className="row" style={{justifyContent:'space-between'}}>
        {/* left: small image + title */}
        <div className="row" style={{gap:10, alignItems:'center'}}>
          <img src={LOCK_IMG} alt="" style={{width:20, height:20, opacity: card.paused ? 1 : 0.25}} />
          <div className="row" style={{gap:8}}>
            <div style={{fontWeight:700}}>Card</div>
            {status}{sBadge}
            <span className="badge">Daubs: <b>{card.daubs}</b></span>
          </div>
        </div>
        {/* right: per-card actions */}
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
            {card.paused || card.exploded ? 'Locked' : 'Lock'}
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

function App(){
  // Player (single viewer’s cards)
  const [player, setPlayer] = useState(()=>({ id:uid('p'), cards:[makeCard(uid('c'),'#1'), makeCard(uid('c'),'#2'), makeCard(uid('c'),'#3'), makeCard(uid('c'),'#4')] }));
  const [audio, setAudio] = useState(false);
  const [volume, setVolume] = useState(0.8);

  // Selection of existing cards (pre-game)
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Server state
  const [phase,setPhase] = useState('setup');
  const [speedMs,setSpeedMs] = useState(800);
  const [called,setCalled] = useState([]);

  function toggleSelect(id){
    setSelectedIds(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function addCards(n){
    n=Math.max(1, Math.min(12, Number(n)||0));
    setPlayer(p=>({...p, cards:[...p.cards, ...Array.from({length:n}).map((_,i)=>makeCard(uid('c'), '#'+(p.cards.length+i+1)))]}));
  }
  function shieldAll(on){ setPlayer(p=>({...p, cards:p.cards.map(c=>({...c, wantsShield:on}))})); }
  function toggleShield(cardId,on){ setPlayer(p=>({...p, cards:p.cards.map(c=>c.id===cardId?({...c, wantsShield:on}):c)})); }
  function pauseCard(cardId){ setPlayer(p=>({...p, cards:p.cards.map(c=>(c.id===cardId && !c.paused && !c.exploded)?({...c, paused:true}):c)})); }

  // Poll state (handles End/Reset immediately)
  useEffect(()=>{
    let mounted=true;
    async function pull(){
      try{
        const r=await fetch('/api/round/state?ts='+Date.now(), {cache:'no-store', headers:{Accept:'application/json'}});
        const s=await r.json();
        if(!mounted) return;

        const newPhase = s.phase || 'setup';
        const newCalls = Array.isArray(s.called) ? s.called : [];
        const oldCalls = called;

        setPhase(newPhase);
        setSpeedMs(Number(s.speed_ms)||800);

        // Reset visuals when round resets / goes back to setup
        if (newPhase==='setup' && (oldCalls.length !== 0 || called.length !== 0)) {
          setPlayer(p=>({...p, cards: resetCardsForNewRound(p.cards)}));
        }
        if (newCalls.length < oldCalls.length) {
          setPlayer(p=>({...p, cards: resetCardsForNewRound(p.cards)}));
        }

        // Apply new calls in order
        if (newCalls.length > oldCalls.length) {
          const news = newCalls.slice(oldCalls.length);
          let next = player.cards;
          news.forEach(n => { next = applyCallToCards(next, n, audio, volume); });
          setPlayer(p=>({...p, cards: next}));
        }

        setCalled(newCalls);
      }catch{}
    }
    pull();
    const id=setInterval(pull, 1000);
    return ()=>{ mounted=false; clearInterval(id); };
  }, [called, audio, volume, player.cards]);

  const lastCalled = called[called.length-1];

  return (
    <div className="grid" style={{gap:14}}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <h2 className="title">Bingo + Crash — Multiplayer</h2>
          <div className="muted">Pre-game purchase → shared caller (admin)</div>
        </div>
        <div className="row">
          {!audio
            ? <button className="btn primary" onClick={async()=>{ if(await enableAudio()){ setAudio(true); boom(0.6);} }}>Enable Sound</button>
            : (<div className="row"><span className="muted">Vol</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></div>)
          }
        </div>
      </div>

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
                    <input id="buyN" className="chip" style={{padding:'8px 10px'}} type="number" min="1" max="12" defaultValue="2"/>
                    <button className="btn green" onClick={()=>{ const el=document.getElementById('buyN'); addCards(Number(el?.value)||2); }}>Add n cards</button>
                    <button className="btn gray" onClick={()=>shieldAll(true)}>Shield all</button>
                    <button className="btn gray" onClick={()=>shieldAll(false)}>Unshield all</button>
                  </div>
                </div>
                <div className="muted" style={{marginTop:8}}>Tip: tap your cards on the right to select them (pre-game only).</div>
              </>)
          }
        </div>

        {/* Right: Your Cards (click/tap to select in setup) */}
        <div className="card">
          <div className="row" style={{justifyContent:'space-between'}}>
            <div className="muted">Your Cards ({player.cards.length})</div>
            {phase==='setup' && <div className="muted">Selected: {selectedIds.size}</div>}
          </div>
          {player.cards.length===0
            ? <div className="muted" style={{marginTop:8}}>No cards yet. Use “Add n cards”.</div>
            : <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12, marginTop:10}}>
                {player.cards.map(c=>
                  <Card
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

      <div className="card">
        <div className="muted">Round Summary</div>
        {phase!=='live' && <div className="muted" style={{marginTop:6}}>Waiting for round to start…</div>}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
