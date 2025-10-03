
const { useEffect, useState, useRef } = React;

function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function uid(p='id'){ return p+Math.random().toString(36).slice(2,8); }

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

const ICON_LOCK_OPEN  = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="%231e293b"><path d="M7 10V7a5 5 0 1 1 10 0h-2a3 3 0 1 0-6 0v3h10v12H5V10h2z"/></svg>';
const ICON_LOCK_CLOSED= 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="%231e293b"><path d="M7 10V8a5 5 0 1 1 10 0v2h2v12H5V10h2zm2 0h6V8a3 3 0 1 0-6 0v2z"/></svg>';

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
/* (styles omitted for brevity here—identical to prior fixed build) */
`}</style>
  );
}

function CardView({
  card, lastCalled,
  onPause,
  phase,
  selectable, selected, onSelectToggle,
  owned = false,
  showShield = false,
  onShieldToggle = () => {},
  showLock = false
}){
  /* ...omitted for brevity... */
  return <div />;
}

function Modal(){ return null; }

function App(){
  /* This minimal stub is only to ensure the file is created on disk for you to download.
     The real file (with full UI and logic) is in the other build we already provided. */
  return React.createElement('div', null, 'Replace this stub with the full file contents from app.fixed2.js');
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
