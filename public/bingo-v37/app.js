// Bingo + Crash — Multiplayer client (light theme)
// React (UMD) + Babel — no build step
// Cache bust: 2025-01-07-17:30

const { useEffect, useState, useRef } = React;

// DEBUG flag for production logging control
const DEBUG = false; // Set to false in production

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
function makeCard(id,name,bombsCount=3){
  const nums = shuffle(Array.from({length:25},(_,i)=>i+1)).slice(0,15);
  const gridNums = [0,1,2].map(r => nums.slice(r*5, r*5+5));
  const bombIdxs = new Set(shuffle(Array.from({length:15},(_,i)=>i)).slice(0,bombsCount));
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
    let bombWriggling = false;

    const grid = card.grid.map(row => row.map(cell=>{
      if(cell.n!==n || cell.daubed) return cell;
      if(cell.bomb){
        if(card.wantsShield && !shieldUsed){
          shieldUsed = true;
          justSaved = true;
          daubs += 1;
          return {...cell, daubed:true};
        }else{
          bombWriggling = true;
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
    return {...card, grid, exploded, daubs, shieldUsed, justExploded, justSaved, bombWriggling};
  });

  // Update database for any cards that changed status
  next.forEach(card => {
    const originalCard = cards.find(c => c.id === card.id);
    if (originalCard && (
      originalCard.exploded !== card.exploded || 
      originalCard.paused !== card.paused || 
      originalCard.daubs !== card.daubs ||
      originalCard.shieldUsed !== card.shieldUsed
    )) {
      fetch('/api/round/update-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card.id,
          exploded: card.exploded,
          paused: card.paused,
          daubs: card.daubs,
          shieldUsed: card.shieldUsed
        })
      }).catch(error => {
        console.error('Failed to update card:', error);
      });
    }
  });

  if(anyBoom){
    vibrate([80,40,120]);
    if(audioOn) boom(volume);
  }
  setTimeout(()=>{ next.forEach(c=>{ c.justExploded=false; c.justSaved=false; }); }, 500); // Back to 500ms for responsiveness
  return next;
}

// Icons
const ICON_LOCK_OPEN  = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="%231e293b"><path d="M7 10V7a5 5 0 1 1 10 0h-2a3 3 0 1 0-6 0v3h10v12H5V10h2z"/></svg>';
const ICON_LOCK_CLOSED= 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="%231e293b"><path d="M7 10V8a5 5 0 1 1 10 0v2h2v12H5V10h2zm2 0h6V8a3 3 0 1 0-6 0v2z"/></svg>';

// Explosion image (animated GIF)
const EXPLOSION_SRC = '/bingo-v37/explosion.gif';
const SHIELD_ICON = '/bingo-v37/shield.png';
// Video format sources - WebM now default for all devices (lightest)
const SHIELD_BREAKING_SOURCES = {
  webm: '/bingo-v37/shield_break.webm', //Default format (lightest, 6x speed)
  webmMobile: '/bingo-v37/shield_break.webm',//Mobile-optimized version
  mp4: '/bingo-v37/shield_break.mp4',   // Fallback for unsupported browsers
  gif: '/bingo-v37/shield_break.gif',    // Ultimate fallback (1x speed only)
};

// Get the best video source for the current device
const getBestVideoSource = () => {
  // For low-performance devices, always use GIF
  if (isLowPerformanceDevice()) {
    console.log('🛡️ Low-performance device detected, using GIF fallback');
    return SHIELD_BREAKING_SOURCES.gif;
  }
  
  // Use mobile-optimized WebM for mobile devices
  if (supportsWebM()) {
    return isMobile() ? SHIELD_BREAKING_SOURCES.webmMobile : SHIELD_BREAKING_SOURCES.webm;
  } else if (supportsMP4()) {
    return SHIELD_BREAKING_SOURCES.mp4;
  } else {
    return SHIELD_BREAKING_SOURCES.gif;
  }
};

// Check WebM support
const supportsWebM = () => {
  const video = document.createElement('video');
  return video.canPlayType('video/webm; codecs="vp8, vorbis"') !== '';
};

// Check MP4 support  
const supportsMP4 = () => {
  const video = document.createElement('video');
  return video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
};

// Detect mobile device for performance optimization
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth <= 768;
};

// Detect low-performance devices
const isLowPerformanceDevice = () => {
  // Check for low-end device indicators
  const userAgent = navigator.userAgent.toLowerCase();
  const isOldAndroid = /android [1-4]\./i.test(userAgent);
  const isLowEndAndroid = /android.*(go|lite|low)/i.test(userAgent);
  const isOldIOS = /iphone os [1-9]_/i.test(userAgent);
  const hasLowMemory = navigator.deviceMemory && navigator.deviceMemory <= 2;
  const hasSlowConnection = navigator.connection && (
    navigator.connection.effectiveType === 'slow-2g' || 
    navigator.connection.effectiveType === '2g'
  );
  
  return isOldAndroid || isLowEndAndroid || isOldIOS || hasLowMemory || hasSlowConnection;
};

// Smart preload function with format detection and mobile optimization
const preloadShieldVideo = () => {
  const videoSource = getBestVideoSource();
  
  // Skip preloading on mobile and low-performance devices to save bandwidth and memory
  if (isMobile() || isLowPerformanceDevice()) {
    console.log('🛡️ Skipping video preload for better performance');
    console.log('🛡️ Will use format:', videoSource);
    return;
  }
  
  // Create a hidden video element to preload the video
  const video = document.createElement('video');
  video.src = videoSource;
  video.preload = 'metadata'; // Use metadata instead of auto for better performance
  video.muted = true;
  video.playsInline = true;
  video.style.display = 'none';
  
  video.addEventListener('canplaythrough', () => {
    console.log('🛡️ Shield breaking video preloaded:', videoSource);
    // Remove the preload element after it's loaded
    if (video.parentNode) {
      video.parentNode.removeChild(video);
    }
  });
  
  video.addEventListener('error', (e) => {
    console.warn('Failed to preload shield breaking video:', videoSource, e);
    // Try fallback format if WebM fails
    if (videoSource.includes('.webm')) {
      console.log('🛡️ Trying MP4 fallback...');
      video.src = SHIELD_BREAKING_SOURCES.mp4;
      video.load();
    } else {
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    }
  });
  
  // Add to DOM and start loading
  document.body.appendChild(video);
  video.load();
};

function Cell({cell, highlight, bombWriggling}){
  const cls=['cell']; 
  if(cell.daubed) {
    cls.push('daub'); 
  } else if(highlight) {
    cls.push('hl');
  }
  return (
    <div className={cls.join(' ')}>
      <span className="num">{cell.n}</span>
      {cell.bomb && (
        <div className={`bomb ${bombWriggling ? 'wriggling' : ''}`}>💣</div>
      )}
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

.btn{ border:1px solid #e2e8f0; background:#f8fafc; color:#0f172a; padding:6px 10px; border-radius:8px; cursor:pointer; transition: all 0.2s ease; }
.btn.primary{ background:#3b82f6; border-color:#3b82f6; color:#fff; }
.btn.gray{ background:#eef2f7; }
.btn:disabled{ opacity:.5; cursor:not-allowed; }
.btn:hover:not(:disabled){ transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

/* Custom slider styles */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

input[type="range"]::-webkit-slider-track {
  background: #e2e8f0;
  height: 6px;
  border-radius: 3px;
}

input[type="range"]::-moz-range-track {
  background: #e2e8f0;
  height: 6px;
  border-radius: 3px;
  border: none;
}
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

/* Shield container */
.shieldContainer{
  position:relative; display:inline-block; vertical-align:middle;
}



/* Grid of 5 columns */
.gridCard{
  display:grid; grid-template-columns:repeat(5, minmax(0,1fr));
  gap:var(--cell-gap, 8px); width:100%; min-width:0;
}
.cell{
  position:relative; display:grid; place-items:center;
  aspect-ratio:1 / 1; border:1px solid #e2e8f0; border-radius:var(--cell-radius,10px);
  background:#fff; min-width:0; box-sizing:border-box; padding:0;
  z-index:2;
}
.cell .num{
  display:block; width:100%; text-align:center; font-weight:700;
  font-size:var(--cell-font,16px); line-height:1; white-space:nowrap; overflow:hidden;
}
.cell.daub{ background:#dcfce7; border-color:#86efac; }
.cell.hl{ background:#fef9c3; border-color:#fde047; }
.bomb{
  position:absolute; top:2px; left:50%; transform:translateX(-50%); font-size:var(--bomb-font,12px); line-height:1; pointer-events:none; z-index:2;
}

/* Explosion overlay */
.explosion-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:5; pointer-events:none; }

/* Delayed explosion animation */
.delayed-explosion{
  animation: delayed-explosion 1s ease-in-out forwards;
}

@keyframes delayed-explosion{
  0%{ opacity:0; transform:scale(0.8); }
  50%{ opacity:0.5; transform:scale(0.9); }
  100%{ opacity:1; transform:scale(1); }
}

/* Bomb wriggling animation */
.bomb.wriggling{
  animation: bomb-wriggle 1s ease-in-out infinite;
}

@keyframes bomb-wriggle{
  0%{ transform:translateX(0) rotate(0deg) scale(1); }
  15%{ transform:translateX(-2px) rotate(-5deg) scale(1.1); }
  30%{ transform:translateX(2px) rotate(5deg) scale(0.9); }
  45%{ transform:translateX(-1px) rotate(-3deg) scale(1.05); }
  60%{ transform:translateX(1px) rotate(3deg) scale(0.95); }
  75%{ transform:translateX(-0.5px) rotate(-2deg) scale(1.02); }
  90%{ transform:translateX(0.5px) rotate(2deg) scale(0.98); }
  100%{ transform:translateX(0) rotate(0deg) scale(1); }
}


/* Card UI improvements - aligned heights (reduced by 20%) */
.daubsCounter{ 
  font-size:13px; font-weight:700; color:#1e293b; 
  background:transparent; padding:6px 10px; border-radius:6px;
  border:1px solid #e2e8f0;
  height:32px; display:flex; align-items:center;
  box-sizing:border-box;
}
.lockButton{ 
  padding:6px 30px; font-size:13px; font-weight:600;
  height:35px; border-radius:6px;
  display:flex; align-items:center;
  box-sizing:border-box;
  margin-left:-10px;
  transition:all 0.2s ease;
  background:#f97316; color:#fff; border:1px solid #ea580c;
}
.lockButton:hover{
  animation: lockPulseFaded 1.5s ease-in-out infinite;
}
.lockButton:active{
  animation: lockShake 0.3s ease-in-out;
}
.shieldIcon{ 
  height:26px; width:26px; 
  display:flex; align-items:center; justify-content:center;
  background:transparent; border:1px solid #e2e8f0; border-radius:6px;
  box-sizing:border-box;
  margin-left:0px;
}
.lockedText{
  font-size:13px; font-weight:600; color:#dc2626;
  background:transparent; padding:6px 10px; border-radius:6px;
  border:1px solid #dc2626; height:32px; display:flex; align-items:center;
  box-sizing:border-box;
}

/* Exploded card styles */
.daubsCounter.exploded{ color:#fff !important; border-color:#666 !important; }

.explodedText{
  font-size:13px; font-weight:700; color:#FF9700;
  background:transparent; padding:6px 10px; border-radius:6px;
  border:1px solid #FF9700; height:32px; display:flex; align-items:center;
  box-sizing:border-box; position:relative; overflow:visible;
}

/* Smoke animation for exploded cards */
.card-smoke-effect{
  position:absolute; inset:0; pointer-events:none; z-index:10;
}

.smoke-cloud{
  position:absolute; background:#666; opacity:0.7; 
  animation:smoke-cloud-rise 4s infinite ease-out;
  border-radius:50px;
}

.smoke1{ 
  width:20px; height:12px; left:15%; top:85%; 
  animation-delay:0s; 
}
.smoke2{ 
  width:25px; height:15px; left:35%; top:80%; 
  animation-delay:0.8s; 
}
.smoke3{ 
  width:18px; height:10px; left:55%; top:90%; 
  animation-delay:1.6s; 
}
.smoke4{ 
  width:22px; height:13px; left:75%; top:75%; 
  animation-delay:2.4s; 
}
.smoke5{ 
  width:16px; height:9px; left:25%; top:70%; 
  animation-delay:3.2s; 
}
.smoke6{ 
  width:24px; height:14px; left:85%; top:85%; 
  animation-delay:0.4s; 
}

@keyframes smoke-cloud-rise{
  0%{ 
    transform:translateY(0) scale(0.5) rotate(0deg); 
    opacity:0.7; 
    filter:blur(0px);
  }
  25%{ 
    transform:translateY(-15px) scale(0.8) rotate(5deg); 
    opacity:0.8; 
    filter:blur(1px);
  }
  50%{ 
    transform:translateY(-30px) scale(1.2) rotate(-3deg); 
    opacity:0.6; 
    filter:blur(2px);
  }
  75%{ 
    transform:translateY(-45px) scale(1.5) rotate(2deg); 
    opacity:0.4; 
    filter:blur(3px);
  }
  100%{ 
    transform:translateY(-60px) scale(2.0) rotate(-1deg); 
    opacity:0; 
    filter:blur(4px);
  }
}

/* Shield breaking effect - flash + expanding rings + sparkles */
.shieldBreakingEffect{
  position:absolute; 
  top:0; 
  right:0; 
  width:30px; 
  height:30px; 
  pointer-events:none; 
  z-index:15;
}

/* Breaking shield video - covers full card at 8x speed */
.shieldBreakingVideoContainer{
  position:absolute;
  top:0;
  left:0;
  width:100%;
  height:100%;
  z-index:20;
  pointer-events:none;
  background:rgba(0,0,0,0.1); /* Fallback background */
}

.shieldBreakingVideo{
  width:100%;
  height:100%;
  object-fit:cover;
  /* Play at natural speed; no accelerated animation */
  background:transparent;
  /* Mobile optimizations */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  -webkit-perspective: 1000;
  perspective: 1000;
}

/* removed playbackSpeed keyframes (no speed-up) */

/* Flash effect removed - using breaking image only */

/* Ring effects removed - using breaking image only */

/* Sparkle effects removed - using breaking image only */

/* Counter styles */
.counter{
  transition: all 0.2s ease;
}
.counter:hover{
  background: #374151 !important;
  transform: scale(1.05);
}



/* Lock overlay - in front but very faded */
.mobileLockOverlay{
  position:absolute; inset:0; z-index:3;
  display:flex; align-items:center; justify-content:center;
  background:transparent; border-radius:inherit;
  cursor:pointer; transition:all 0.2s ease;
}
.mobileLockOverlay.locked{
  background:transparent; z-index:3;
}
.mobileLockIcon{
  transition:all 0.2s ease;
  animation: lockPulseFaded 2s ease-in-out infinite;
  opacity:0.05;
  display:flex; align-items:center; justify-content:center;
}
.mobileLockIcon img{
  width:58px; height:58px;
}
.mobileLockOverlay.locked .mobileLockIcon{
  animation: lockShake 0.5s ease-in-out;
  opacity:0.8;
}
.mobileLockOverlay.locked .mobileLockIcon img{
  width:58px; height:58px;
}

/* Lock animations */
@keyframes lockPulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.05); opacity: 1; }
}
@keyframes lockPulseFaded {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.02); opacity: 0.6; }
}
@keyframes lockShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

/* Bingo ball styling */
.bingoBall{
  display:inline-flex; align-items:center; justify-content:center;
  width:40px; height:40px; border-radius:50%;
  background:#dc2626; /* Default red, will be overridden by color classes */
  box-shadow:0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3);
  font-size:16px; font-weight:700; color:#000;
  margin:2px; position:relative;
}
.bingoBall::before{
  content:''; position:absolute; top:4px; left:50%; transform:translateX(-50%);
  width:18px; height:18px; border-radius:50%;
  background:radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0.2) 70%, transparent 100%);
  pointer-events:none; z-index:4;
}
.bingoBall span{
  position:relative; z-index:3; color:#000; font-weight:900;
  display:inline-flex; align-items:center; justify-content:center;
  width:28px; height:28px; border-radius:50%;
  background:#fff; border:1px solid #000;
}

.bingoBallMain{
  display:inline-flex; align-items:center; justify-content:center;
  width:80px; height:80px; border-radius:50%;
  background:#dc2626; /* Default red, will be overridden by color classes */
  box-shadow:0 6px 12px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.4);
  font-size:32px; font-weight:900; color:#000;
  position:relative;
}
.bingoBallMain::before{
  content:''; position:absolute; top:8px; left:50%; transform:translateX(-50%);
  width:36px; height:36px; border-radius:50%;
  background:radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0.2) 70%, transparent 100%);
  pointer-events:none; z-index:4;
}
.bingoBallMain span{
  position:relative; z-index:3; color:#000; font-weight:900;
  display:inline-flex; align-items:center; justify-content:center;
  width:56px; height:56px; border-radius:50%;
  background:#fff; border:2px solid #000;
}

/* Color classes for bingo balls */
.bingoBall.red{ background:#dc2626; }
.bingoBall.green{ background:#16a34a; }
.bingoBall.purple{ background:#9333ea; }
.bingoBall.orange{ background:#ea580c; }
.bingoBall.pink{ background:#db2777; }

.bingoBallMain.red{ background:#dc2626; }
.bingoBallMain.green{ background:#16a34a; }
.bingoBallMain.purple{ background:#9333ea; }
.bingoBallMain.orange{ background:#ea580c; }
.bingoBallMain.pink{ background:#db2777; }


/* Enhanced 3D hover effects */
.bingoBall:hover{
  transform:translateY(-2px);
  box-shadow:0 8px 16px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4);
  transition:all 0.2s ease;
}
.bingoBallMain:hover{
  transform:translateY(-3px);
  box-shadow:0 12px 24px rgba(0,0,0,0.5), 0 6px 12px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.4);
  transition:all 0.2s ease;
}


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
  .bomb{ --bomb-font: clamp(7.5px, 2.5vw, 10px); top:1px; left:50%; transform:translateX(-50%); }
  .phase-live .cell .num{ --cell-font: clamp(9px, 3.0vw, 12px); }
  .phase-live .bomb{ --bomb-font: clamp(7px, 2.3vw, 9.5px); }
  .priceTag{ font-size:11px; padding:2px 6px; }
  .shieldCtl{ font-size:11px; }
  .shieldIcon{ height:21px; width:21px; }
  .daubsCounter{ font-size:11px; padding:3px 6px; height:26px; }
  .explodedText{ font-size:11px; padding:3px 6px; height:26px; }
  .lockButton{ display:none; }
  .mobileLockOverlay{ display:flex; }
  .mobileLockIcon img{ width:35px; height:35px; }
  .bingoBall{ width:32px; height:32px; font-size:14px; }
  .bingoBallMain{ width:60px; height:60px; font-size:24px; }
  .rollingBall{ width:60px; height:60px; font-size:24px; }
  .rollingBall span{ width:42px; height:42px; }
}

/* Small phones (401–480px) */
@media (min-width: 401px) and (max-width: 480px){
  .twoCol{ grid-template-columns:1fr 1fr; }
  .cardsGrid{ grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .card{ padding:10px; border-radius:14px; }
  .gridCard{ --cell-gap:6px; }
  .cell{ --cell-radius:8px; }
  .cell .num{ --cell-font: clamp(10px, 2.9vw, 13px); }
  .bomb{ --bomb-font: clamp(8.5px, 2.3vw, 11px); top:2px; left:50%; transform:translateX(-50%); }
  .phase-live .cell .num{ --cell-font: clamp(10px, 2.8vw, 13px); }
  .phase-live .bomb{ --bomb-font: clamp(8px, 2.1vw, 10.5px); }
  .shieldIcon{ height:23px; width:23px; }
  .daubsCounter{ font-size:12px; padding:4px 8px; height:29px; }
  .explodedText{ font-size:12px; padding:4px 8px; height:29px; }
  .lockButton{ display:none; }
  .mobileLockOverlay{ display:flex; }
  .mobileLockIcon img{ width:35px; height:35px; }
  .bingoBall{ width:32px; height:32px; font-size:14px; }
  .bingoBallMain{ width:60px; height:60px; font-size:24px; }
  .rollingBall{ width:60px; height:60px; font-size:24px; }
  .rollingBall span{ width:42px; height:42px; }
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
  showLock = false,          // live only
  cardPrice = 10,
  shieldPricePercent = 50
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

      {/* Explosion GIF overlay - delayed by 1 second */}
      {card.justExploded && (
        <img src={EXPLOSION_SRC} className="explosion-img delayed-explosion" alt="boom" />
      )}

      {/* Smoke effect for exploded cards */}
      {card.exploded && (
        <div className="card-smoke-effect">
          <div className="smoke-cloud smoke1"></div>
          <div className="smoke-cloud smoke2"></div>
          <div className="smoke-cloud smoke3"></div>
          <div className="smoke-cloud smoke4"></div>
          <div className="smoke-cloud smoke5"></div>
          <div className="smoke-cloud smoke6"></div>
        </div>
      )}

      <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
        {/* LEFT: daubs counter (live phase) or price + shield (setup phase) */}
        <div className="row" style={{gap:8, alignItems:'center'}}>
          {phase === 'live' && (
            <>
              <span className={`daubsCounter ${card.exploded ? 'exploded' : ''}`}>
                Daubs: <b> {card.daubs}</b>
              </span>
              {card.exploded && (
                <span className="explodedText">
                  EXPLODED
                </span>
              )}
            </>
          )}
          {phase === 'setup' && selectable && (
            <>
              <span className="priceTag">
                {cardPrice} {card.wantsShield && `+ ${(cardPrice * (shieldPricePercent / 100)).toFixed(1)}`} coins
              </span>
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
		  <div className="shieldContainer">
		    <img src={SHIELD_ICON} alt="Shield active" className="shieldIcon" />
		  </div>
		)}
          {/* LOCKED text when card is locked */}
          {phase === 'live' && card.paused && (
            <span className="lockedText">LOCKED</span>
          )}
        </div>

        {/* CENTER: empty space (lock button removed) */}
        <div className="row" style={{gap:8, alignItems:'center'}}>
        </div>

        {/* RIGHT: shield (live phase only) */}
        <div className="row" style={{gap:8, alignItems:'center'}}>
          {phase === 'live' && card.wantsShield && !card.shieldUsed && (
			  <div className="shieldContainer">
			    <img src={SHIELD_ICON} alt="Shield active" className="shieldIcon" />
			  </div>
			)}
          {/* Shield breaking effect when just saved - VIDEO OVER FULL CARD */}
          {phase === 'live' && card.justSaved && (
            <div className="shieldBreakingVideoContainer">
              <video 
                src={getBestVideoSource()}
                className="shieldBreakingVideo"
                autoPlay 
                muted 
                playsInline
                webkit-playsinline="true"
                preload={isMobile() ? "none" : "metadata"}
                onLoadedMetadata={(e) => {
                  try {
                    const videoSource = getBestVideoSource();
                    console.log('🛡️ Loading shield break video:', videoSource);
                    
                    // Play at 2x speed for faster shield breaking effect
                    e.target.playbackRate = 2;
                    
                    // Enhanced mobile-specific optimizations
                    if (isMobile()) {
                      e.target.style.willChange = 'transform';
                      e.target.style.transform = 'translateZ(0)'; // Force hardware acceleration
                      e.target.style.backfaceVisibility = 'hidden'; // Additional optimization
                      e.target.style.perspective = '1000px'; // 3D acceleration hint
                    }
                    
                    e.target.play().catch(err => {
                      console.log('Video play failed:', err);
                      // Ensure 2x speed on retry
                      e.target.playbackRate = 2;
                      e.target.play().catch(fallbackErr => console.log('Fallback video play failed:', fallbackErr));
                    });
                  } catch (error) {
                    console.error('Error setting up video playback:', error);
                  }
                }}
                onError={(e) => {
                  console.error('Shield breaking video failed to load:', e.target.src);
                  
                  // Try fallback formats
                  const currentSrc = e.target.src;
                  if (currentSrc.includes('.webm')) {
                    console.log('🛡️ WebM failed, trying MP4...');
                    e.target.src = SHIELD_BREAKING_SOURCES.mp4;
                  } else if (currentSrc.includes('.mp4')) {
                    console.log('🛡️ MP4 failed, trying GIF...');
                    e.target.src = SHIELD_BREAKING_SOURCES.gif;
                  } else {
                    console.log('🛡️ All formats failed, hiding video');
                    e.target.style.display = 'none';
                  }
                }}
                onEnded={(e) => {
                  e.target.style.display = 'none';
                  // Clean up mobile-specific styles
                  if (isMobile()) {
                    e.target.style.willChange = 'auto';
                    e.target.style.transform = '';
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="gridCard" style={{marginTop:10}}>
        {card.grid.flatMap((row,r)=>row.map((cell,c)=>
          <Cell key={r+'-'+c} cell={cell} highlight={lastCalled===cell.n && !cell.daubed} bombWriggling={card.bombWriggling && cell.bomb && lastCalled===cell.n} />
        ))}
      </div>

      {/* Lock overlay (live phase only) - always behind numbers - hidden for exploded cards */}
      {showLock && !card.exploded && (
        <div className={`mobileLockOverlay ${card.paused ? 'locked' : ''}`}
             onClick={(e)=>{ e.stopPropagation(); onPause(card.id); }}>
          <div className="mobileLockIcon">
            <img src={card.paused ? ICON_LOCK_CLOSED : ICON_LOCK_OPEN} alt="" />
          </div>
        </div>
      )}
    </div>
  );
}

// Simple modal
function Modal({open, onClose, children, title, primaryText='Got it', onPrimary, showDontShowAgain=false, onDontShowAgain}){
  if(!open) return null;
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50}}>
      <div className="card" style={{maxWidth:560, width:'92%', borderRadius:16}}>
        {title && <h3 className="title" style={{marginBottom:8}}>{title}</h3>}
        <div className="muted" style={{whiteSpace:'pre-line'}}>{children}</div>
        
        {/* Don't show again checkbox */}
        {showDontShowAgain && (
          <div style={{marginTop:12, marginBottom:8}}>
            <label style={{display:'flex', alignItems:'center', gap:8, fontSize:'14px', cursor:'pointer'}}>
              <input type="checkbox" onChange={onDontShowAgain} />
              Do not show this message again
            </label>
          </div>
        )}
        
        <div className="row" style={{justifyContent:'flex-end', marginTop:12}}>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={onPrimary || onClose}>{primaryText}</button>
        </div>
      </div>
    </div>
  );
}

function App(){
  // Alias + wallet (with localStorage persistence)
  const initialAlias = (() => {
    const a = localStorage.getItem('player_alias') || localStorage.getItem('bingo-alias') || '';
    if (a) localStorage.setItem('player_alias', a);
    return a;
  })();
  const [alias, setAlias]     = useState(initialAlias);
  const [askAlias, setAsk]    = useState(() => !initialAlias);
  const [wallet, setWallet]   = useState(null); // Will be updated from server
  const [resetKey, setResetKey] = useState(0);

  // useRef hooks MUST be inside a component:
  const ownedAtStartRef = useRef(0);
  const postedOutRef    = useRef(false);

  // Wallet balance will be fetched via merged API endpoint
  // Only fetch separately when needed (purchases, wins)
  const fetchWalletBalance = async () => {
    if (!alias) return;
    
    try {
      const response = await fetch(`/api/player/wallet?alias=${encodeURIComponent(alias)}&ts=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      if (data.balance !== undefined) {
        setWallet(data.balance);
      }
    } catch (err) {
      console.error('Failed to fetch wallet balance:', err);
    }
  };

  // Available (pre-buy) vs Owned (purchased)
  const freshAvail = () => Array.from({length:4},()=>makeCard(uid('pool'),'', 3)); // start with 4 visible
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
  
  // Track which rounds have had their prize awarded (prevent duplicate awards)
  const awardedRoundsRef = useRef(new Set());

  // Popups
  const [showHowTo, setShowHowTo] = useState(() => {
    // Check localStorage to see if user previously chose not to show this message
    return localStorage.getItem('bingo-crash-hide-how-to') !== 'true';
  });
  const [syncedWinner, setSyncedWinner] = useState(null); // {alias, daubs} | null
  const [liveCardsCount, setLiveCardsCount] = useState(0); // Total live cards in the game

  // Scheduler state
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [timeUntilNextGame, setTimeUntilNextGame] = useState(null);
  const [canPurchaseCards, setCanPurchaseCards] = useState(true);
  
  // Client-side countdown timer for smooth updates
  const [clientTimeUntilNextGame, setClientTimeUntilNextGame] = useState(null);
  const countdownIntervalRef = useRef(null);

  // Pricing and prize pool
  const [prizePool, setPrizePool] = useState(0);
  const [cardPrice, setCardPrice] = useState(10);
  const [shieldPricePercent, setShieldPricePercent] = useState(50);
  const [quickPurchaseCount, setQuickPurchaseCount] = useState(2);

  // ensure we only end once
  const endPostedRef = useRef(false);
  
  // Track first load state to prevent redundant ball processing (removed - simplified logic)

  // Pricing configuration will be loaded via merged API endpoint
  // Only load separately if needed (admin changes between games)
  const loadPricingConfig = async () => {
    try {
      const r = await fetch('/api/pricing', { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        setCardPrice(data.cardPrice || 10);
        setShieldPricePercent(data.shieldPricePercent || 50);
      }
    } catch (error) {
      console.error('Failed to load pricing:', error);
    }
  };

  // Handle "don't show again" checkbox
  function handleDontShowAgain(event) {
    if (event.target.checked) {
      localStorage.setItem('bingo-crash-hide-how-to', 'true');
    }
  }

  // Format time until next game (MM:SS)
  function formatTimeUntilNextGame(seconds) {
    if (seconds === null || seconds === undefined) return '—';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // This will be replaced by the main merged API polling
  // Keep this as fallback for now, but it will be removed


  // ---------- Pre-buy actions (include shields) ----------
  function toggleSelectPool(id){ setSelectedPool(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function generateCards(n){
    n=Math.max(1,Math.min(12,Number(n)||0));
    setAvailable(a=>[...a, ...Array.from({length:n},()=>makeCard(uid('pool'),'', 3))]);
  }
  function buySelected(){
    // Check if purchases are blocked by scheduler
    if (!canPurchaseCards) {
      alert('Card purchases are blocked. Next game starting soon!');
      return;
    }
    
    const picks = available.filter(c=>selectedPool.has(c.id));
    if (picks.length === 0) return;
    
    // Calculate total cost based on real pricing with proper rounding
    const shieldCost = Math.round(cardPrice * (shieldPricePercent / 100) * 100) / 100;
    const totalCost = picks.reduce((sum, card) => {
      const cardCost = Math.round((cardPrice + (card.wantsShield ? shieldCost : 0)) * 100) / 100;
      return Math.round((sum + cardCost) * 100) / 100;
    }, 0);
    
    if (wallet === null || wallet < totalCost) { 
      alert(`Not enough coins. Need ${totalCost.toFixed(2)}, have ${wallet !== null ? wallet.toFixed(2) : 'unknown'}.`); 
      return; 
    }

    // Move selected available -> owned preserving wantsShield; refresh ids
    const ownedAdd = picks.map(c => ({ ...c, id: uid('c') }));
    setPlayer(p=>({...p, cards:[...p.cards, ...ownedAdd]}));
    setAvailable(a=>a.filter(c=>!selectedPool.has(c.id)));
    setSelectedPool(new Set());
	
	// After successful purchase, create cards in the database
    if (alias) {
      // Create each purchased card in the database SEQUENTIALLY to avoid race conditions
      async function createCardsSequentially() {
        // UI is already updated above, just sync with database
        
        for (let i = 0; i < ownedAdd.length; i++) {
          const card = ownedAdd[i];
          
          try {
            const response = await fetch('/api/round/buy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                alias: alias,
                cardName: card.name || 'Bingo Card',
                wantsShield: card.wantsShield || false
              })
            });
            
            const result = await response.json();
            
            if (response.ok && result.ok && result.cardId) {
              // Update wallet with actual balance from server
              if (result.newBalance !== undefined) {
                setWallet(result.newBalance);
              } else {
                // Fallback: fetch wallet balance if not provided in response
                fetchWalletBalance();
              }
              
              // Update the local card with the database UUID
              setPlayer(p => ({
                ...p, 
                cards: p.cards.map(c => 
                  c.id === card.id ? { ...c, id: result.cardId } : c
                )
              }));
            } else if (!response.ok) {
              // Handle error (e.g., insufficient balance)
              alert(result.error || 'Failed to purchase card');
              // Revert the optimistic update
              setPlayer(p => ({
                ...p,
                cards: p.cards.filter(c => c.id !== card.id)
              }));
              setAvailable(a => [...a, { ...card, id: uid('pool') }]);
            }
          } catch (error) {
            console.error('Card creation failed:', error);
          }
        }
      }
      
      createCardsSequentially();
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

  // Quick purchase function - instantly purchase cards and shields
  function quickPurchase(cardCount, shieldCount) {
    // Check if purchases are blocked by scheduler
    if (!canPurchaseCards) {
      alert('Card purchases are blocked. Next game starting soon!');
      return;
    }
    
    if (!alias) {
      alert('Please set your alias first.');
      return;
    }
    
    if (cardCount === 0 && shieldCount === 0) {
      alert('Please select at least 1 card or shield.');
      return;
    }
    
    // Calculate total cost
    const shieldCost = Math.round(cardPrice * (shieldPricePercent / 100) * 100) / 100;
    const totalCost = Math.round((cardCount * cardPrice + shieldCount * shieldCost) * 100) / 100;
    
    if (wallet === null || wallet < totalCost) { 
      alert(`Not enough coins. Need ${totalCost.toFixed(2)}, have ${wallet !== null ? wallet.toFixed(2) : 'unknown'}.`); 
      return; 
    }

    // Create cards with shields
    const newCards = [];
    for (let i = 0; i < cardCount; i++) {
      const card = makeCard(uid('c'), 'Quick Card', 3);
      card.wantsShield = shieldCount > i; // First few cards get shields
      newCards.push(card);
    }

    // Add to owned cards immediately (optimistic update)
    setPlayer(p => ({...p, cards: [...p.cards, ...newCards]}));
    
    // Create cards in database
    async function createQuickPurchaseCards() {
      for (let i = 0; i < newCards.length; i++) {
        const card = newCards[i];
        
        try {
          const response = await fetch('/api/round/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              alias: alias,
              cardName: card.name || 'Quick Card',
              wantsShield: card.wantsShield || false
            })
          });
          
          const result = await response.json();
          
          if (response.ok && result.ok && result.cardId) {
            // Update wallet with actual balance from server
            if (result.newBalance !== undefined) {
              setWallet(result.newBalance);
            } else {
              // Fallback: fetch wallet balance if not provided in response
              fetchWalletBalance();
            }
            
            // Update the local card with the database UUID
            setPlayer(p => ({
              ...p, 
              cards: p.cards.map(c => 
                c.id === card.id ? { ...c, id: result.cardId } : c
              )
            }));
          } else if (!response.ok) {
            // Handle error (e.g., insufficient balance)
            alert(result.error || 'Failed to purchase card');
            // Revert the optimistic update for this card
            setPlayer(p => ({
              ...p,
              cards: p.cards.filter(c => c.id !== card.id)
            }));
          }
        } catch (error) {
          console.error('Quick purchase card creation failed:', error);
          // Revert the optimistic update for this card
          setPlayer(p => ({
            ...p,
            cards: p.cards.filter(c => c.id !== card.id)
          }));
        }
      }
    }
    
    createQuickPurchaseCards();
  }

  // Owned management
  function pauseOwned(cardId){ 
    setPlayer(p=>({...p, cards:p.cards.map(c=>{
      if(c.id===cardId && !c.paused && !c.exploded){
        // Update database when card is paused
        fetch('/api/round/update-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId: cardId,
            paused: true
          })
        }).catch(error => {
          console.error('Failed to pause card:', error);
        });
        return {...c, paused:true};
      }
      return c;
    })})); 
  }


  // Main polling using merged API endpoint
  useEffect(()=>{
    let mounted=true, lastPhase='setup', lastCount=0, isFirstLoad=true;
    // Track the round ID to reset lastCount when round changes
    let trackedRoundId = null;

    async function maybeEndRoundOnServer(id){
      if (endPostedRef.current || !id) return;
      endPostedRef.current = true;
      try{
        await fetch('/api/round/end?ts='+Date.now(), { method:'POST', cache:'no-store', headers:{Accept:'application/json'}});
      }catch{}
    }

    // Request throttling to prevent too many simultaneous calls
    let lastRequestTime = 0;
    const minRequestInterval = 1000; // 1s minimum between requests
    
    async function pull(){
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      
      // Throttle requests to prevent overwhelming the server
      if (timeSinceLastRequest < minRequestInterval) {
        return; // Skip this request if it's too soon
      }
      
      lastRequestTime = now;
      const pullStartTime = Date.now();
      const pullTimestamp = new Date().toISOString();
      
      let gameStatus = null;
      try{
        const fetchStartTime = Date.now();
        // Use merged API endpoint with alias parameter
        const url = alias 
          ? `/api/game/status?alias=${encodeURIComponent(alias)}&ts=${Date.now()}`
          : `/api/game/status?ts=${Date.now()}`;
        const r=await fetch(url, {cache:'no-store', headers:{Accept:'application/json'}});
        const fetchEndTime = Date.now();
        const fetchTime = fetchEndTime - fetchStartTime;
        
        gameStatus=await r.json();
        if(!mounted) return;
        
        // Log fetch timing (only in debug mode)
        if (DEBUG && fetchTime > 200) {
          console.warn(`⚠️  SLOW MERGED API FETCH: ${fetchTime}ms at ${pullTimestamp}`);
        }

        // Extract data from merged response
        const s = gameStatus.roundState;
        const schedulerStatus = gameStatus.schedulerStatus;
        const pricing = gameStatus.pricing;
        const walletInfo = gameStatus.wallet;


        const newPhase = s.phase || 'setup';
        const newCalls = Array.isArray(s.called) ? s.called : [];
        const currentRoundId = s.id || null;
        setRoundId(currentRoundId);
        
        // Reset lastCount when round ID changes (new round started)
        if (trackedRoundId !== null && trackedRoundId !== currentRoundId) {
          lastCount = 0;
          isFirstLoad = true; // Treat as first load for new round
          if (DEBUG) {
            console.log(`🔄 New round detected: ${trackedRoundId} -> ${currentRoundId}, resetting lastCount`);
          }
        }
        trackedRoundId = currentRoundId;
        
        // Update all state from merged response
        setSchedulerStatus(schedulerStatus);
        setTimeUntilNextGame(schedulerStatus.timeUntilNextGame);
        setCanPurchaseCards(schedulerStatus.canPurchaseCards);
        
        // Update pricing (only if changed)
        if (pricing.cardPrice !== cardPrice || pricing.shieldPricePercent !== shieldPricePercent) {
          setCardPrice(pricing.cardPrice);
          setShieldPricePercent(pricing.shieldPricePercent);
        }
        
        // Update wallet (only if alias provided and balance changed)
		if (alias && walletInfo && walletInfo.balance !== null && walletInfo.balance !== wallet) {
		setWallet(walletInfo.balance);
		}
        
        // Update prize pool
        if (s.prize_pool !== undefined) {
          const pool = Number(s.prize_pool) || 0;
          setPrizePool(pool);
        }

        // RESET TO SETUP: clear purchases & selections, regenerate Available and force paint
        if (lastPhase !== 'setup' && newPhase === 'setup') {
          setPlayer({ id: uid('p'), cards: [] });
          setAvailable(freshAvail());
          setSelectedPool(new Set());
          
          // Reset lastCount when transitioning to setup phase
          lastCount = 0;
          setShowHowTo(true);
          setSyncedWinner(null);
          setAsk(true);
          endPostedRef.current = false;
          setResetKey(k => k + 1);     // <- forces a repaint
          
          // Wallet and pricing are already updated from merged API response above
          // No need for separate API calls
        }

        // CRITICAL: Update called state IMMEDIATELY when transitioning to live phase
        // This ensures balls are displayed even before any cards are processed
        const isTransitioningToLive = lastPhase !== 'live' && newPhase === 'live';
        if (isTransitioningToLive) {
          // Immediately update called state to show balls when entering live phase
          setCalled(newCalls);
          // Reset lastCount to 0 so all existing balls are processed
          lastCount = 0;
          isFirstLoad = false; // Don't treat as first load anymore
          
          if (DEBUG && newCalls.length > 0) {
            console.log(`🎯 Transitioning to LIVE phase with ${newCalls.length} balls already called`);
          }
        }

        // On first load, initialize lastCount to match existing called numbers
        // This prevents processing old balls that were called before the page loaded
        // BUT still update the display so users can see what's been called
        if (isFirstLoad) {
          lastCount = newCalls.length;
          isFirstLoad = false;
          console.log('🎮 First load complete - initialized lastCount to', lastCount, 'to skip processing', newCalls.length, 'existing calls (but UI will show them)');
          // On first load, immediately update the called display if game is live
          if (newPhase === 'live' && newCalls.length > 0) {
            setCalled(newCalls);
          }
        }

        // Process new balls if we have more than before OR if we're transitioning to live phase
        const shouldProcessBalls = newCalls.length > lastCount || (isTransitioningToLive && newCalls.length > 0);
        if (shouldProcessBalls) {
          // Apply new calls to owned cards
          const news = isTransitioningToLive && lastCount === 0
            ? newCalls  // All balls if transitioning to live phase (process all existing calls)
            : newCalls.slice(lastCount);  // Only new balls since last update
          const newBallTime = Date.now();
          const newBallTimestamp = new Date().toISOString();
          
          // Minimal logging for new balls - only essential info (debug mode only)
          if (DEBUG) {
            console.log(`🎲 New balls: [${news.join(', ')}] (${newCalls.length}/25)`);
          }
          
          // Only process balls if player has cards (prevents errors on first load)
          if (player.cards && player.cards.length > 0) {
            let next = player.cards;
            news.forEach(n => { next = applyCallToCards(next, n, audio, volume); });
            setPlayer(p=>({...p, cards: next}));
          } else if (DEBUG) {
            console.log('⚠️ Skipping ball processing - no cards owned yet (cards will load correct state from server)');
          }
          
          // CRITICAL: Update lastCount to match server state immediately after processing
          // This ensures we stay in sync with the server
          lastCount = newCalls.length;
          
          if (DEBUG) {
            console.log(`✅ Updated lastCount to ${lastCount} to match server`);
          }

          // Trigger rolling ball animation for the latest called number
          if (news.length > 0) {
            const latestNumber = news[news.length - 1];
            const colorClass = (() => {
              if (latestNumber >= 1 && latestNumber <= 5) return 'red';
              if (latestNumber >= 6 && latestNumber <= 10) return 'green';
              if (latestNumber >= 11 && latestNumber <= 15) return 'purple';
              if (latestNumber >= 16 && latestNumber <= 20) return 'orange';
              if (latestNumber >= 21 && latestNumber <= 25) return 'pink';
              return 'red';
            })();
            
          }

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

        // End-game detection is handled entirely by the server
        // Server will end the game when live_cards_count reaches 0 or deck is exhausted
        // Client should not try to end the game based on deck exhaustion

        // when phase enters live, remember how many cards I had at start, and reset "postedOut" flag
        if (lastPhase !== 'live' && newPhase === 'live') {
          ownedAtStartRef.current = (player.cards || []).length;
          postedOutRef.current = false;
        }	
		
        // Poll current winner (same for everyone) - only if game is live
        // REMOVED: This was causing winner popup to appear during live games
        // if (s.id && newPhase === 'live') {
        //   fetch(`/api/round/winner?round_id=${encodeURIComponent(s.id)}&ts=${Date.now()}`, { cache:'no-store' })
        //     .then(r=>r.json())
        //     .then(w=>{ if (w?.alias) setSyncedWinner({ alias:w.alias, daubs:w.daubs }); })
        //     .catch(()=>{});
        // }

          lastPhase = newPhase;
          setPhase(newPhase);
          setSpeedMs(Number(s.speed_ms)||800);
        
        // Update called numbers - always show current called balls from server
        // This ensures balls are displayed immediately when a new round starts, even without cards
        const isNewRound = roundId !== s.id;
        
        // CRITICAL: Always sync called state with server in live phase
        // This must happen AFTER processing balls to ensure lastCount is updated
        if (newPhase !== 'setup') {
          // Live phase - ALWAYS update called balls to match server exactly
          // This ensures balls are visible and synchronized with server state
          // Always update to ensure we're in sync (React will optimize if values are the same)
          setCalled(newCalls);
        } else if (isNewRound) {
          // New round in setup phase - clear history
          setCalled(newCalls);
        }
        // If same round in setup phase, keep existing called array (preserves history)
        setLiveCardsCount(Number(s.live_cards_count) || 0);

        // If server says round ended, sequence winner popup and stop any local auto-caller
        if (newPhase === 'ended') {
          if (typeof setAutoRun === 'function') setAutoRun(false);
          
          // Helper function to award prize (only called once per round)
          const awardPrize = (winner) => {
            if (!winner?.alias || !s.id || s.prize_pool <= 0) return;
            
            // Check if we've already awarded this round (prevent duplicate calls from polling)
            if (awardedRoundsRef.current.has(s.id)) {
              return;
            }
            
            // Mark this round as awarded immediately (before the API call)
            awardedRoundsRef.current.add(s.id);
            
            fetch(`/api/round/winner`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                alias: winner.alias,
                daubs: winner.daubs,
                prizePool: s.prize_pool
              })
            })
            .then(r => r.json())
            .then(result => {
              // Update wallet after prize award
              if (alias && winner.alias === alias) {
                fetchWalletBalance();
              }
            })
            .catch(err => {
              console.error('Failed to award prize to winner:', err);
              // Remove from set on error so it can be retried
              awardedRoundsRef.current.delete(s.id);
            });
          };
          
          // Use winner from merged response if available
          if (s.winner && s.winner.alias) {
            setSyncedWinner({ alias: s.winner.alias, daubs: s.winner.daubs });
            awardPrize(s.winner);
          } else {
            setSyncedWinner({ alias: '—', daubs: 0 });
          }
        }

      }catch(e){
        // swallow errors to keep polling resilient
      }
    }

    pull();
    
    // Optimized polling with merged API endpoint
    const getPollingInterval = () => {
      if (phase === 'live') return 2000; // 1s during live games (merged API is more efficient)
      
      // During setup phase, poll more frequently when countdown is near zero
      if (phase === 'setup' && (clientTimeUntilNextGame || timeUntilNextGame) <= 15) {
        return 1000; // 1s when countdown is 15 seconds or less
      }
      
      // During setup phase, moderate polling for countdown updates
      if (phase === 'setup') {
        return 5000; // 3s during normal setup phase (merged API reduces need for frequent polling)
      }
      
      return 10000; // 5s during ended phases
    };
    
    let id = null;
    const startPolling = () => {
      const interval = getPollingInterval();
      if (interval > 0) {
        id = setInterval(pull, interval);
      } else {
        id = null;
      }
    };
    
    startPolling();
    
    // Dynamic polling adjustment
    const adjustPolling = () => {
      if (id) {
        clearInterval(id);
      }
      startPolling();
    };
    
    // Adjust polling when phase changes or countdown is near zero
    const phaseCheckInterval = setInterval(adjustPolling, 2000);
    
    // Visibility-based polling optimization
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause polling when tab is hidden
        if (id) {
          clearInterval(id);
          id = null;
        }
      } else {
        // Resume polling when tab becomes visible
        startPolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return ()=>{ 
      mounted=false; 
      clearInterval(id); 
      clearInterval(phaseCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.cards, audio, volume, alias, phase, clientTimeUntilNextGame, timeUntilNextGame]);

  // Preload shield video when game starts
  React.useEffect(() => {
    if (phase === 'live') {
      preloadShieldVideo();
    }
  }, [phase]);

  // Listen for reset events from admin panel (via localStorage/storage event/custom event)
  React.useEffect(() => {
    const handleReset = () => {
      console.log('🔄 Reset event detected - refreshing page to ensure clean state');
      setTimeout(() => {
        window.location.reload();
      }, 100);
    };
    const handleStorageChange = (e) => {
      if (e.key === 'bingo-crash-reset') { handleReset(); }
    };
    const handleCustomEvent = () => { handleReset(); };
    const handleResetCheck = () => {
      try {
        const resetFlag = localStorage.getItem('bingo-crash-reset');
        if (resetFlag) {
          localStorage.removeItem('bingo-crash-reset');
          handleReset();
        }
      } catch (e) {}
    };
    handleResetCheck();
    const checkInterval = setInterval(handleResetCheck, 500);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bingo-crash-reset', handleCustomEvent);
    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bingo-crash-reset', handleCustomEvent);
    };
  }, []);

  const lastCalled = called[called.length-1];
  
  // Expose current called balls to global scope for modal access
  window.currentCalledBalls = called;

  return (
    <div key={resetKey} className={`grid ${phase === 'live' ? 'phase-live' : 'phase-setup'}`} style={{gap:14}} >
      {/* Header */}
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <h2 className="title">Crashingo</h2>
          <div className="muted">
            Wallet: <b>{wallet !== null ? wallet : 'Loading...'}</b> coins · Alias: <b>{alias || '—'}</b>
          </div>
        </div>
        <div className="row" style={{gap: 12}}>
          <div className="row">
            {!audio
              ? <button className="btn primary" onClick={async()=>{ if(await enableAudio()){ setAudio(true); boom(0.6);} }} title="Enable Sound">🔊</button>
              : (<div className="row"><span className="muted">Vol</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e)=>setVolume(Number(e.target.value))}/></div>)
            }
          </div>
        </div>
      </div>


      {/* Body */}
      <div className="grid twoCol">
        {/* Left: Purchase Panel (setup) / Caller (live) */}
        <div className="card" style={{position: 'relative', overflow: 'hidden'}}>
          {phase==='live'
            ? (<>
                <div className="muted">Caller</div>
                <div className={`bingoBallMain ${lastCalled ? (() => {
                  if (lastCalled >= 1 && lastCalled <= 5) return 'red';
                  if (lastCalled >= 6 && lastCalled <= 10) return 'green';
                  if (lastCalled >= 11 && lastCalled <= 15) return 'purple';
                  if (lastCalled >= 16 && lastCalled <= 20) return 'orange';
                  if (lastCalled >= 21 && lastCalled <= 25) return 'pink';
                  return 'red'; // fallback
                })() : ''}`}><span>{lastCalled ?? '—'}</span></div>
                
                <div className="muted" style={{marginTop:6}}>Speed: {(speedMs/1000).toFixed(1)}s · History</div>
                <div className="list" style={{marginTop:8}}>{called.slice(-8).map(n=>{
                  let colorClass = 'red'; // fallback
                  if (n >= 1 && n <= 5) colorClass = 'red';
                  else if (n >= 6 && n <= 10) colorClass = 'green';
                  else if (n >= 11 && n <= 15) colorClass = 'purple';
                  else if (n >= 16 && n <= 20) colorClass = 'orange';
                  else if (n >= 21 && n <= 25) colorClass = 'pink';
                  return <span key={n} className={`bingoBall ${colorClass}`}><span>{n}</span></span>;
                })}</div>
                {/* X/25 Counter */}
                <div 
                  className="counter" 
                  style={{
                    marginTop: 8,
                    padding: '4px 8px',
                    background: '#1f2937',
                    color: '#fff',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-block',
                    border: '1px solid #374151'
                  }}
                  onClick={() => {
                    // Create modal to show all called balls with live updates
                    const modal = document.createElement('div');
                    modal.style.cssText = `
                      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                      background: rgba(0,0,0,0.8); z-index: 1000; display: flex;
                      align-items: center; justify-content: center;
                    `;
                    
                    const content = document.createElement('div');
                    content.style.cssText = `
                      background: #1f2937; padding: 20px; border-radius: 12px;
                      max-width: 90%; max-height: 80%; overflow-y: auto;
                      border: 1px solid #374151;
                    `;
                    
                    const title = document.createElement('div');
                    title.style.cssText = `
                      color: #fff; font-size: 18px; font-weight: bold;
                      margin-bottom: 15px; text-align: center;
                    `;
                    
                    const ballsContainer = document.createElement('div');
                    ballsContainer.style.cssText = `
                      display: flex; flex-wrap: wrap; gap: 8px;
                      justify-content: center;
                    `;
                    
                    const closeBtn = document.createElement('button');
                    closeBtn.style.cssText = `
                      margin-top: 15px; padding: 8px 16px;
                      background: #374151; color: #fff; border: none;
                      border-radius: 6px; cursor: pointer; width: 100%;
                    `;
                    closeBtn.textContent = 'Close';
                    
                    // Function to update the modal content
                    const updateModal = () => {
                      // Get the current called array from the React state
                      // We need to access the current value, not the closure value
                      const currentCalled = window.currentCalledBalls || called;
                      
                      // Update title with current count
                      title.textContent = `All Called Balls (${currentCalled.length}/25)`;
                      
                      // Clear and rebuild balls container
                      ballsContainer.innerHTML = '';
                      
                      currentCalled.forEach(n => {
                        const ball = document.createElement('span');
                        let colorClass = 'red';
                        if (n >= 1 && n <= 5) colorClass = 'red';
                        else if (n >= 6 && n <= 10) colorClass = 'green';
                        else if (n >= 11 && n <= 15) colorClass = 'purple';
                        else if (n >= 16 && n <= 20) colorClass = 'orange';
                        else if (n >= 21 && n <= 25) colorClass = 'pink';
                        
                        ball.className = `bingoBall ${colorClass}`;
                        ball.innerHTML = `<span>${n}</span>`;
                        ballsContainer.appendChild(ball);
                      });
                    };
                    
                    // Initial render
                    updateModal();
                    
                    // Set up live updates - update every 2s for better performance
                    const updateInterval = setInterval(updateModal, 2000);
                    
                    // Clean up interval when modal is closed
                    const cleanup = () => {
                      clearInterval(updateInterval);
                      document.body.removeChild(modal);
                    };
                    
                    closeBtn.onclick = cleanup;
                    modal.onclick = (e) => {
                      if (e.target === modal) cleanup();
                    };
                    
                    content.appendChild(title);
                    content.appendChild(ballsContainer);
                    content.appendChild(closeBtn);
                    modal.appendChild(content);
                    document.body.appendChild(modal);
                  }}
                >
                  {called.length}/25
                </div>
              </>)
            : (<>
                {/* Scheduler Countdown Timer in Purchase Panel - Circular Progress Style */}
                {schedulerStatus?.enabled && (clientTimeUntilNextGame !== null || timeUntilNextGame !== null) && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    background: (clientTimeUntilNextGame || timeUntilNextGame) <= 5 
                      ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' 
                      : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    border: `2px solid ${(clientTimeUntilNextGame || timeUntilNextGame) <= 5 ? '#ef4444' : '#3b82f6'}`,
                    borderRadius: '8px',
                    marginBottom: '8px',
                    boxShadow: (clientTimeUntilNextGame || timeUntilNextGame) <= 5 
                      ? '0 2px 8px rgba(239, 68, 68, 0.3)' 
                      : '0 2px 8px rgba(59, 130, 246, 0.3)',
                    position: 'relative',
                    overflow: 'hidden',
                    animation: (clientTimeUntilNextGame || timeUntilNextGame) <= 5 ? 'pulse-urgent 1s ease-in-out infinite' : 'none'
                  }}>
                    {/* Text content - now on the left */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: (clientTimeUntilNextGame || timeUntilNextGame) <= 5 ? '#991b1b' : '#1e40af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '2px'
                      }}>
                        {(clientTimeUntilNextGame || timeUntilNextGame) <= 5 ? '🔥 Starting Soon!' : '⏰ Next Game'}
                      </div>
                    
                      {!canPurchaseCards && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#dc2626', 
                          fontWeight: 'bold',
                          backgroundColor: 'rgba(255, 255, 255, 0.8)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          animation: 'blink-warning 1s ease-in-out infinite'
                        }}>
                          🚫 Blocked
                        </div>
                      )}
                    </div>
                    
                    {/* Compact Circular Progress Ring - now on the right and slightly bigger */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                        {/* Background circle */}
                        <circle
                          cx="30"
                          cy="30"
                          r="24"
                          fill="none"
                          stroke={(clientTimeUntilNextGame || timeUntilNextGame) <= 5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}
                          strokeWidth="4"
                        />
                        {/* Progress circle */}
                        <circle
                          cx="30"
                          cy="30"
                          r="24"
                          fill="none"
                          stroke={(clientTimeUntilNextGame || timeUntilNextGame) <= 5 ? '#ef4444' : '#3b82f6'}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 24}`}
                          strokeDashoffset={`${2 * Math.PI * 24 * (1 - ((clientTimeUntilNextGame || timeUntilNextGame) / ((schedulerStatus?.preBuyMinutes || 1) * 60)))}`}
                          style={{
                            transition: 'stroke-dashoffset 1s linear',
                            filter: (clientTimeUntilNextGame || timeUntilNextGame) <= 5 ? 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))' : 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.4))'
                          }}
                        />
                      </svg>
                      
                      {/* Timer text in center */}
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center'
                      }}>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: 'bold', 
                          color: (clientTimeUntilNextGame || timeUntilNextGame) <= 5 ? '#dc2626' : '#1e40af',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          lineHeight: '1'
                        }}>
                          {formatTimeUntilNextGame(clientTimeUntilNextGame || timeUntilNextGame)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 1-Click/Tap Purchase Buttons */}
                <div style={{marginTop: '12px', marginBottom: '8px'}}>
                  <div className="muted" style={{marginBottom: '8px', fontSize: '13px'}}>
                    {/Mobi|Android/i.test(navigator.userAgent) ? '1-tap purchase: 4 cards' : '1-click purchase: 4 cards'}
                  </div>
                  <div className="row" style={{flexWrap:'wrap', gap:6}}>
                    <button 
                      className="btn primary" 
                      style={{background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e', fontSize: '12px', padding: '6px 10px', fontWeight: 'bold'}}
                      onClick={() => quickPurchase(4, 4)}
                      disabled={!canPurchaseCards || wallet === null}
                    >
                      Inc. shields - {(cardPrice * 4 + (cardPrice * 4) * (shieldPricePercent / 100)).toFixed(1)} coins
                    </button>
                    
					<button 
                      className="btn" 
                      style={{background: '#f0f9ff', borderColor: '#0ea5e9', color: '#0c4a6e', fontSize: '12px', padding: '6px 10px'}}
                      onClick={() => quickPurchase(4, 0)}
                      disabled={!canPurchaseCards || wallet === null}
                    >
                      No Shields - {(cardPrice * 4).toFixed(1)} coins
                    </button>
                  </div>
                </div>

                {/* Custom Purchase */}
                <div style={{marginTop: '25px', marginBottom: '8px'}}>
                  <div className="muted" style={{marginBottom: '8px', fontSize: '13px'}}>Custom Purchase</div>
                  <button className="btn primary" onClick={buySelected} disabled={selectedPool.size===0 || wallet === null}>Buy selected</button>
                </div>
                
                {/* Prize Badge below all buttons in Purchase Panel during Setup */}
                {(prizePool > 0 || (phase === 'setup' && schedulerStatus?.enabled)) && (
                  <div style={{
                    padding: '8px 16px',
                    marginTop: '12px',
                    textAlign: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#1f2937'
                  }}>
                    🏆 {prizePool.toFixed(2)} coins
                  </div>
                )}
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
                        cardPrice={cardPrice}
                        shieldPricePercent={shieldPricePercent}
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
                        cardPrice={cardPrice}
                        shieldPricePercent={shieldPricePercent}
                      />
                    )}
                  </div>
              }
            </>
          ) : (
            <>
              <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                <div className="muted">My Cards ({player.cards.length})</div>
                {phase === 'live' && (
                  <div style={{
                    padding: '8px 16px',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    color: '#1f2937'
                  }}>
                    🏆 {prizePool.toFixed(2)} coins
                  </div>
                )}
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
                        showLock={phase === 'live'}
                        cardPrice={cardPrice}
                        shieldPricePercent={shieldPricePercent}
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
        showDontShowAgain={true}
        onDontShowAgain={handleDontShowAgain}
      >
        • <b>Goal:</b> Lock your card with most Daubs before it explodes.
		{'\n'}{'\n'}• A <b>shield</b> is available to purchase per card and will protect you from the <b>first</b> "Bomb".
		{'\n'}{'\n'}• Called numbers are daubed automatically, unless...
		{'\n'}{'\n'}• ...where a called number has a <b>bomb</b>, your card explodes <i>(if not shielded)</i>.
		{'\n'}{'\n'}• At any time, tap the <b>Lock</b> icon to lock in your card and daub score.
		{'\n'}{'\n'}• Locked cards will not get new daubs and cannot explode.		
		{'\n'}{'\n'}• The game ends when all players' cards have either been locked or have exploded.	
        {'\n'}{'\n'}• <b>Winner(s)</b>: Locked-in card(s) with the most daubs. 
		{'\n'}{'\n'}• Ties split the prize equally between winning cards.
      </Modal>

      {/* Winner modal (synced across players) */}
      <Modal
        open={!!syncedWinner}
        onClose={()=>{
          // Refresh wallet before reloading page
          if (alias) {
            fetchWalletBalance().finally(() => location.reload());
          } else {
            location.reload();
          }
        }}
        title="Game Over"
        primaryText="OK"
        onPrimary={()=>{
          // Refresh wallet before reloading page
          if (alias) {
            fetchWalletBalance().finally(() => location.reload());
          } else {
            location.reload();
          }
        }}
      >
        {syncedWinner ? (
          <>
            🏆 Winner: <b>{syncedWinner.alias}</b> with <b>{syncedWinner.daubs}</b> daubs!
            {prizePool > 0 && (
              <>
                {'\n\n'}💰 Prize Won: <b style={{color: '#f59e0b', fontSize: '18px'}}>{prizePool.toFixed(2)} coins</b>
              </>
            )}
            {'\n\n'}Live cards remaining: <b>{liveCardsCount}</b>
          </>
        ) : '—'}
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
          localStorage.setItem('bingo-alias', val);
          localStorage.setItem('player_alias', val);
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
}


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));

// Preload shield breaking video when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Only preload if we're on the game page
  if (window.location.pathname.includes('/play') || window.location.pathname.includes('/bingo-v37')) {
    preloadShieldVideo();
  }
});