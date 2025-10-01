const { useEffect, useMemo, useRef, useState } = React;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function uid(p='id') { return p + Math.random().toString(36).slice(2,8); }

let _ctx = null;
function audioCtx() { const Ctx = window.AudioContext || window.webkitAudioContext; if (!_ctx && Ctx) _ctx = new Ctx(); return _ctx; }
async function enableAudio() { const c = audioCtx(); if (!c) return false; if (c.state === 'suspended') try { await c.resume(); } catch{}; return true; }
function boom(vol=0.9) {
  try { const c=audioCtx(); if(!c) return; const t=c.currentTime;
    const buf=c.createBuffer(1,c.sampleRate*0.7,c.sampleRate); const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const src=c.createBufferSource(); src.buffer=buf; const g=c.createGain();
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
    src.connect(g).connect(c.destination); src.start(t); src.stop(t+0.6);
  } catch {}
}

function makeCard(id, name) {
  const nums = shuffle(Array.from({length:25}, (_,i)=>i+1)).slice(0,15);
  const gridNums = [0,1,2].map(r => nums.slice(r*5, r*5+5));
  const grid = gridNums.map(row => {
    const bombCol = Math.floor(Math.random()*5);
    return row.map((n,c)=>({ n, bomb:c===bombCol, daubed:false }));
  });
  return { id, name, grid, paused:false, exploded:false, daubs:0, wantsShield:false, shieldUsed:false, justExploded:false, justSaved:false };
}

function applyCallToCards(cards, n, audioOn, volume) {
  let anyBoom = false;
  const next = cards.map(card => {
    if (card.paused || card.exploded) return card;
    let exploded=card.exploded, shieldUsed=card.shieldUsed, daubs=card.daubs, justExploded=false, justSaved=false;
    const grid = card.grid.map(row => row.map(cell => {
      if (cell.n !== n || cell.daubed) return cell;
      if (cell.bomb) {
        if (card.wantsShield && !shieldUsed) { shieldUsed=true; justSaved=true; daubs+=1; return { ...cell, daubed:true }; }
        else { exploded=true; return cell; }
      } else { daubs+=1; return { ...cell, daubed:true }; }
    }));
    if (!card.exploded && exploded) { justExploded=true; anyBoom=true; }
    return { ...card, grid, exploded, daubs, shieldUsed, justExploded, justSaved };
  });
  if (anyBoom && audioOn) boom(volume);
  setTimeout(()=>{ next.forEach(c=>{ c.justExploded=false; c.justSaved=false; }); }, 900);
  return next;
}

function classNames(...xs){ return xs.filter(Boolean).join(' '); }

function CellView({ cell, highlight }) {
  const c = classNames('cell', cell.daubed && 'daub', !cell.daubed && highlight && 'hl');
  return (
    <div className={c}>
      <div style={{fontWeight:700}}>{cell.n}</div>
      {cell.bomb && <div className="bomb">💣</div>}
    </div>
  );
}

function CardView({ card, lastCalled, onPause, onShieldToggle }) {
  const status = card.exploded ? <span className="badge boom">EXPLODED</span> : card.paused ? <span className="badge lock">LOCKED</span> : <span className="badge live">LIVE</span>;
  const sBadge = card.wantsShield && !card.shieldUsed ? <span className="badge shield">shield</span> : card.shieldUsed ? <span className="badge" style={{background:'#4c0519'}}>shield used</span> : null;
  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <div style={{fontWeight:700}}>Card</div>
          {status} {sBadge}
        </div>
        <div className="row" style={{gap:8}}>
          <label className="row" style={{gap:6, fontSize:12, color:'#aeb6d8'}}>
            <input type="checkbox" checked={card.wantsShield} onChange={e=>onShieldToggle(card.id, e.target.checked)} />
            Shield
          </label>
          <button className="btn" onClick={()=>onPause(card.id)} disabled={card.paused || card.exploded}>{card.paused || card.exploded ? 'Locked' : 'Lock'}</button>
        </div>
      </div>
      <div className="gridCard" style={{marginTop:10}}>
        {card.grid.flatMap((row, r)=> row.map((cell,c)=> <CellView key={r+'-'+c} cell={cell} highlight={lastCalled===cell.n && !cell.daubed} />))}
      </div>
    </div>
  );
}

function App(){
  const [player, setPlayer] = useState(()=>({ id: uid('p'), cards:[makeCard(uid('c'),'#1'), makeCard(uid('c'),'#2')] }));
  const [audio, setAudio] = useState(false);
  const [volume, setVolume] = useState(0.8);

  const [phase, setPhase] = useState('setup');
  const [speedMs, setSpeedMs] = useState(800);
  const [called, setCalled] = useState([]);
  const lastCalled = called[called.length-1];

  useEffect(()=>{
    let mounted=true;
    async function pull(){
      try{
        const r = await fetch('/api/round/state?ts='+Date.now(), {cache:'no-store', headers:{Accept:'application/json'}});
        const s = await r.json();
        if(!mounted) return;
        const newLen = Array.isArray(s.called) ? s.called.length : 0;
        const oldLen = called.length;
        setPhase(s.phase || 'setup');
        setSpeedMs(Number(s.speed_ms)||800);
        if(newLen>oldLen){
          const news = s.called.slice(oldLen);
          let next = player.cards;
          news.forEach(n=>{ next = applyCallToCards(next, n, audio, volume); });
          setPlayer(p=>({...p, cards: next}));
          setCalled(s.called);
        }
      }catch{}
    }
    pull();
    const id=setInterval(pull, 1000);
    return ()=>{ mounted=false; clearInterval(id); };
  }, [called.length, audio, volume, player.cards]);

  function pauseCard(cardId){
    setPlayer(p=>({...p, cards:p.cards.map(c=>(c.id===cardId && !c.paused && !c.exploded)?({...c, paused:true}):c)}));
  }
  function toggleShield(cardId, on){
    setPlayer(p=>({...p, cards:p.cards.map(c=>c.id===cardId?({...c, wantsShield:on}):c)}));
  }
  function buyCards(n){
    n=Math.max(1, Math.min(12, Number(n)||0));
    setPlayer(p=>({...p, cards:[...p.cards, ...Array.from({length:n}).map((_,i)=>makeCard(uid('c'), '#'+(p.cards.length+i+1)))]}));
  }
  function shieldAll(on){
    setPlayer(p=>({...p, cards:p.cards.map(c=>({...c, wantsShield:on}))}));
  }

  return (
    <div className="grid" style={{gap:14}}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <h2 className="title">Bingo + Crash — Multiplayer</h2>
          <div className="muted">Pre‑game purchase → shared caller (admin)</div>
        </div>
        <div className="row">
          {!audio ? <button className="btn primary" onClick={async()=>{ const ok=await enableAudio(); if(ok){ setAudio(true); boom(0.6);} }}>Enable Sound</button>
                   : <div className="row"><span className="muted">Vol</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))} /></div>}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          {phase==='live'
           ? (<>
                <div className="muted">Caller</div>
                <div className="callerNum">{lastCalled ?? '—'}</div>
                <div className="muted" style={{marginTop:6}}>Speed: {(speedMs/1000).toFixed(1)}s · History below</div>
                <div className="list" style={{marginTop:8}}>{called.map(n=><span key={n} className="chip">{n}</span>)}</div>
              </>)
           : (<>
                <div className="muted">Purchase Panel</div>
                <div className="row" style={{gap:8, marginTop:6}}>
                  <input id="buyN" className="chip" style={{padding:'8px 10px'}} type="number" min="1" max="12" defaultValue="2" />
                  <button className="btn green" onClick={()=>{ const el=document.getElementById('buyN'); const n=Number(el?.value)||2; buyCards(n); }}>Buy n cards</button>
                  <button className="btn" onClick={()=>shieldAll(true)}>Shield all</button>
                  <button className="btn" onClick={()=>shieldAll(false)}>Unshield all</button>
                </div>
              </>)
          }
        </div>

        <div className="card">
          <div className="row" style={{justifyContent:'space-between'}}>
            <div className="muted">Your Cards ({player.cards.length})</div>
          </div>
          {player.cards.length===0
           ? <div className="muted" style={{marginTop:8}}>No cards yet. Buy some from the Purchase Panel.</div>
           : <div className="grid grid-2" style={{marginTop:10}}>
               {player.cards.map(c=><CardView key={c.id} card={c} lastCalled={lastCalled} onPause={pauseCard} onShieldToggle={toggleShield} />)}
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
