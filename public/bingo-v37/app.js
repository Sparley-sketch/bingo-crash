// Bingo Crash — Updated app.js with mobile fixes, explosion scaling, and aliasInput zoom prevention.

const { useEffect, useState, useRef } = React;

// ----------------- Helpers -----------------
function uid(prefix="id"){ return prefix + Math.random().toString(36).slice(2,8); }
function shuffle(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

// ----------------- Card Logic -----------------
function makeCard(id,name){
  const nums = shuffle(Array.from({length:25},(_,i)=>i+1)).slice(0,15);
  const gridNums=[0,1,2].map(r=>nums.slice(r*5,r*5+5));
  const grid=gridNums.map(row=>{
    const bombCols = new Set();
    while(bombCols.size<1) bombCols.add(Math.floor(Math.random()*5));
    return row.map((n,c)=>({n,bomb:bombCols.has(c),daubed:false}));
  });
  return {id,name,grid,paused:false,exploded:false,daubs:0,wantsShield:false,shieldUsed:false};
}

// ----------------- UI Pieces -----------------
function Cell({cell,highlight}){
  const cls=["cell"]; if(cell.daubed) cls.push("daub"); else if(highlight) cls.push("hl");
  return (
    <div className={cls.join(" ")}>
      <span className="num">{cell.n}</span>
      {cell.bomb && <div className="bomb">💣</div>}
    </div>
  );
}

function CardView({card,phase,selectable,onSelect,selected,showShield,onShieldToggle,showLock,onPause}){
  return (
    <div className="card" style={selectable?{cursor:"pointer",outline:selected?"3px solid #2563eb40":"none"}:{}}>
      {/* header row */}
      <div className="row" style={{justifyContent:"space-between",alignItems:"center"}}>
        <div className="row" style={{gap:8,alignItems:"center",flexWrap:"nowrap"}}>
          {phase==="setup" && selectable && <span className="priceTag">1 coin</span>}
          {showShield && (
            <label className="row shieldCtl" style={{gap:6,fontSize:12,color:"#475569",whiteSpace:"nowrap"}}
              onClick={e=>e.stopPropagation()}>
              <input type="checkbox" checked={!!card.wantsShield}
                     onChange={e=>onShieldToggle(card.id,e.target.checked)}/>
              Shield
            </label>
          )}
          {phase==="setup" && !selectable && card.wantsShield && (
            <span className="badge" style={{background:"#22c55e30",color:"#16a34a"}}>shield active</span>
          )}
        </div>
        <div className="row" style={{gap:8,alignItems:"center"}}>
          {phase==="live" && <span className="badge">Daubs: <b>{card.daubs}</b></span>}
          {phase==="live" && card.wantsShield && !card.shieldUsed && (
            <span className="badge" style={{background:"#22c55e30",color:"#16a34a"}}>shield active</span>
          )}
          {phase==="live" && card.shieldUsed && (
            <span className="badge" style={{background:"#f8717130",color:"#dc2626"}}>shield used</span>
          )}
          {phase==="live" && (
            card.exploded ? <span className="badge boom">EXPLODED</span> :
            card.paused ? <span className="badge lock">LOCKED</span> :
                          <span className="badge live">LIVE</span>
          )}
          {showLock && (
            <button className="btn gray" onClick={e=>{e.stopPropagation();onPause(card.id);}}
                    disabled={card.paused||card.exploded}>
              <span className="row" style={{gap:6,alignItems:"center"}}>
                <span>{card.paused?"🔒":"🔓"}</span>
                {card.paused||card.exploded?"Locked":"Lock"}
              </span>
            </button>
          )}
        </div>
      </div>
      {/* grid */}
      <div className="gridCard">
        {card.grid.flatMap((row,r)=>
          row.map((cell,c)=><Cell key={r+"-"+c} cell={cell} highlight={false}/>)
        )}
      </div>
    </div>
  );
}

// ----------------- Styles -----------------
function FXStyles(){
  return (
  <style>{`
  .gridCard{
    display:grid;
    grid-template-columns:repeat(5,minmax(0,1fr));
    gap:var(--cell-gap,8px);
    width:100%;
  }
  .cell{
    position:relative;
    display:grid;
    place-items:center;
    aspect-ratio:1/1;
    border:1px solid #e2e8f0;
    border-radius:var(--cell-radius,10px);
    background:#fff;
    min-width:0;
    box-sizing:border-box;
  }
  .cell .num{
    display:block;
    text-align:center;
    font-weight:700;
    font-size:var(--cell-font,16px);
    line-height:1;
    z-index:1;
  }
  .bomb{
    position:absolute;
    top:6px;right:6px;
    font-size:var(--bomb-font,12px);
    line-height:1;
    z-index:2;
  }
  .phase-live .cell .num{ --cell-font:15px; }
  .phase-live .bomb{ --bomb-font:11px; }
  .card{ position:relative; overflow:hidden; padding:12px; border-radius:16px; container-type:inline-size; }
  .explosion-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain; z-index:5; }
  .priceTag{ display:inline-flex; align-items:center; padding:2px 8px; font-size:12px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:999px; }
  .shieldCtl input{ vertical-align:middle; }
  .row{ display:flex; gap:12px; }
  .badge{ font-size:12px; padding:2px 6px; border-radius:6px; background:#f1f5f9; }
  .btn.gray{ font-size:12px; padding:4px 8px; border-radius:6px; }
  .aliasInput{ font-size:16px; }
  @container (max-width:360px){
    .gridCard{ --cell-gap:5px; }
    .cell{ --cell-radius:8px; }
    .cell .num{ --cell-font:clamp(11px,9cqw,14px); }
    .bomb{ --bomb-font:clamp(9px,7cqw,12px); top:3px; right:3px; }
    .phase-live .cell .num{ --cell-font:clamp(10px,8cqw,13px); }
    .phase-live .bomb{ --bomb-font:clamp(8px,6.5cqw,11px); }
    .card{ padding:10px; }
  }
  @container (min-width:360px) and (max-width:460px){
    .gridCard{ --cell-gap:6px; }
    .cell .num{ --cell-font:clamp(12px,8.2cqw,15px); }
    .bomb{ --bomb-font:clamp(10px,6.8cqw,12px); }
    .phase-live .cell .num{ --cell-font:clamp(11px,7.6cqw,14px); }
  }
  `}</style>);
}

// ----------------- Main App -----------------
function App(){
  const [phase,setPhase] = useState("setup");
  const [players,setPlayers] = useState([{id:uid("p"),name:"Player 1",cards:[]}]);
  const [resetKey,setResetKey]=useState(0);

  useEffect(()=>{ /* Polling etc */ },[]);

  return (
    <div key={resetKey} className={phase==="live"?"phase-live":"phase-setup"}>
      <FXStyles/>
      {/* Alias input modal */}
      <input id="alias_input" className="chip aliasInput"
             style={{padding:"10px 12px",width:"100%"}} placeholder="Your alias"/>
      {/* Demo single card */}
      <CardView card={makeCard("c1","Demo")} phase={phase}
                selectable={true} onSelect={()=>{}} selected={false}
                showShield={true} onShieldToggle={()=>{}}
                showLock={false} onPause={()=>{}}/>
    </div>
  );
}

const root=ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
