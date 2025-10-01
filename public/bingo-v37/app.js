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

function Cell({cell,highlight}){
  const cls=['cell']; if(cell.daubed) cls.push('daub'); else if(highlight) cls.push('hl');
  return <div className={cls.join(' ')}><div style={{fontWeight:700}}>{cell.n}</div>{cell.bomb && <div className="bomb">💣</div>}</div>;
}

function Card({card,lastCalled,onPause,onShieldToggle}){
  const status = card.exploded ? <span className="badge boom">EXPLODED</span>
               : card.paused   ? <span className="badge lock">LOCKED</span>
                               : <span className="badge live">LIVE</span>;
  const sBadge = card.wantsShield && !card.shieldUsed ? <span className="badge shield">shield</span>
                : card.shieldUsed ? <span className="badge" style={{background:'#ffe4e6',borderColor:'#fecdd3'}}>shield used</span>
                : null;
  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="row" style={{gap:8}}><div style={{fontWeight:700}}>Card</div>{status}{sBadge}</div>
        <div className="row" style={{gap:8}}>
          <label className="row" style={{gap:6, fontSize:12, color:'#475569'}}>
            <input type="checkbox" checked={card.wantsShield} onChange={e=>onShieldToggle(card.id,e.target.checked)} /> Shield
          </label>
          <button className="btn gray" onClick={()=>onPause(card.id)} disabled={card.paused || card.exploded}>{card.paused || card.exploded ? 'Locked' : 'Lock'}</button>
        </div>
      </div>
      <div className="gridCard" style={{marginTop:10}}>
        {card.grid.flatMap((row,r)=>row.map((cell,c)=><Cell key={r+'-'+c} cell={cell} highlight={lastCalled===cell.n && !cell.daubed} />))}
      </div>
    </div>
  );
}

// --------- NEW: selectable cards (Option 1) ----------
function MiniPreview({card, selected}){
  return (
    <div className={`selectCard ${selected?'sel':''}`}>
      <div className="selectHeader"><span>Card</span><span className="chip">{card.grid.flat().filter(x=>x.bomb).length}💣</span></div>
      <div className="miniGrid" style={{marginTop:6}}>
        {card.grid.flat().map((_,i)=><div key={i} className="miniCell"/>)}
      </div>
    </div>
  );
}

function App(){
  // Player (single viewer’s cards)
  const [player, setPlayer] = useState(()=>({ id:uid('p'), cards:[makeCard(uid('c'),'#1'), makeCard(uid('c'),'#2')] }));
  const [audio, setAudio] = useState(false);
  const [volume, setVolume] = useState(0.8);

  // Server state
  const [phase,setPhase] = useState('setup');
  const [speedMs,setSpeedMs] = useState(800);
  const [called,setCalled] = useState([]);

  // Selection pool (Option 1)
  const [pool,setPool] = useState(()=>Array.from({length:12},(_,i)=>makeCard(uid('pool'), '')));
  const [selected,setSelected] = useState(new Set()); // ids in pool

  function regenPool(){ setPool(Array.from({length:12},()=>makeCard(uid('pool'),''))); setSelected(new Set()); }
  function togglePick(id){ setSelected(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function buySelected(){
    if(selected.size===0) return;
    const picks = pool.filter(c=>selected.has(c.id)).map(c=>makeCard(uid('c'), '#'+(player.cards.length+1))); // new ids
    setPlayer(p=>({...p, cards:[...p.cards, ...picks]}));
    setSelected(new Set());
  }
  function buyCards(n){
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

        // Update phase & speed immediately
        setPhase(newPhase);
        setSpeedMs(Number(s.speed_ms)||800);

        // If round reset or moved to setup -> wipe local daubs/explosions
        if (newPhase==='setup' && (oldCalls.length !== 0 || called.length !== 0)) {
          setPlayer(p=>({...p, cards: resetCardsForNewRound(p.cards)}));
        }
        // If call list shrank (reset) -> also wipe
        if (newCalls.length < oldCalls.length) {
          setPlayer(p=>({...p, cards: resetCardsForNewRound(p.cards)}));
        }

        // Apply any new calls in order
        if (newCalls.length > oldCalls.length) {
          const news = newCalls.slice(oldCalls.length);
          let next = player.cards;
          news.forEach(n => { next = applyCallToCards(next, n, audio, volume); });
          setPlayer(p=>({...p, cards: next}));
        }

        // Always set called (so client reflects reset/end instantly)
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
                    <button className="btn green" onClick={()=>{ const el=document.getElementById('buyN'); buyCards(Number(el?.value)||2); }}>Buy n cards</button>
                    <button className="btn gray" onClick={()=>shieldAll(true)}>Shield all</button>
                    <button className="btn gray" onClick={()=>shieldAll(false)}>Unshield all</button>
                  </div>
                </div>

                {/* Option 1: pick by tap/click */}
                <div className="row" style={{justifyContent:'space-between', marginTop:10}}>
                  <div className="muted">Tap to select · {selected.size} selected</div>
                  <div className="row" style={{gap:6}}>
                    <button className="btn" onClick={regenPool}>Regenerate</button>
                    <button className="btn primary" onClick={buySelected} disabled={selected.size===0}>Buy selected</button>
                  </div>
                </div>
                <div className="selectGrid" style={{marginTop:10}}>
                  {pool.map(c=>{
                    const sel=selected.has(c.id);
                    return (
                      <div key={c.id} onClick={()=>togglePick(c.id)}>
                        <MiniPreview card={c} selected={sel}/>
                      </div>
                    );
                  })}
                </div>
              </>)
          }
        </div>

        {/* Right: Your Cards */}
        <div className="card">
          <div className="row" style={{justifyContent:'space-between'}}>
            <div className="muted">Your Cards ({player.cards.length})</div>
          </div>
          {player.cards.length===0
            ? <div className="muted" style={{marginTop:8}}>No cards yet. Buy some from the Purchase Panel.</div>
            : <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12, marginTop:10}}>
                {player.cards.map(c=><Card key={c.id} card={c} lastCalled={lastCalled} onPause={pauseCard} onShieldToggle={toggleShield} />)}
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
