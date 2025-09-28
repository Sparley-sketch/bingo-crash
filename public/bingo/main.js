
(function(){
  const RANGES = [
    [1,7], [8,14], [15,21], [22,28], [29,35], [36,42]
  ];
  const CALL_INTERVAL_MS = 800;
  let state = {
    locked:false,
    shieldChosen:false,
    shieldUsed:false,
    card:[],      // 6 numbers
    bombs:new Set(), // hidden bomb numbers
    calls:[],     // sequence of called numbers
    timer:null,
    roundActive:false,
  };

  const el = {
    lockBtn: document.getElementById('lockBtn'),
    lockIcon: document.getElementById('lockIcon'),
    lockLabel: document.getElementById('lockLabel'),
    randomizeBtn: document.getElementById('randomizeBtn'),
    restartBtn: document.getElementById('restartBtn'),
    shieldToggle: document.getElementById('shieldToggle'),
    card: document.getElementById('card'),
    calls: document.getElementById('calls'),
    status: document.getElementById('status'),
  };

  function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function drawUnique(range, count, exclude=new Set()){
    const [a,b]=range; const picked=new Set();
    while(picked.size<count){
      const n = Math.floor(Math.random()*(b-a+1))+a;
      if(!picked.has(n) && !exclude.has(n)) picked.add(n);
    }
    return [...picked];
  }

  function makeCard(){
    // one number from each range
    const result=[];
    const used = new Set();
    for(const r of RANGES){
      const [n] = drawUnique(r,1,used);
      used.add(n); result.push(n);
    }
    state.card = result;
    renderCard();
  }

  function seedBombs(){
    // ~15% of numbers 1..42 are bombs
    state.bombs.clear();
    const all = Array.from({length:42}, (_,i)=>i+1);
    const bombCount = Math.max(4, Math.floor(all.length*0.15));
    while(state.bombs.size < bombCount){
      state.bombs.add(all[Math.floor(Math.random()*all.length)]);
    }
  }

  function renderCard(){
    el.card.innerHTML = '';
    state.card.forEach(n=>{
      const div=document.createElement('div');
      div.className='cell';
      if(state.calls.includes(n)) div.classList.add('hit');
      if(state.bombs.has(n)) div.classList.add('bomb'); // hidden indicator UX only
      if(state.calls.includes(n) && state.bombs.has(n)) div.classList.add('exploded');
      div.textContent=String(n);
      el.card.appendChild(div);
    });
  }

  function renderCalls(newNum){
    const d=document.createElement('div');
    d.className='ball';
    d.textContent=String(newNum);
    if(state.bombs.has(newNum)) d.classList.add('bombed');
    d.classList.add('new');
    el.calls.prepend(d);
    setTimeout(()=>d.classList.remove('new'), 600);
  }

  function setStatus(text, kind){
    el.status.className='status-line ' + (kind||'');
    el.status.textContent=text;
  }

  function setLocked(v){
    state.locked = v;
    if(v){
      el.lockIcon.className='icon lock-closed';
      el.lockLabel.textContent='Locked';
      el.randomizeBtn.disabled = true;
      el.shieldToggle && (el.shieldToggle.disabled=true);
    }else{
      el.lockIcon.className='icon lock-open';
      el.lockLabel.textContent='Lock';
      el.randomizeBtn.disabled = false;
      el.shieldToggle && (el.shieldToggle.disabled=false);
    }
  }

  function restart(){
    clearInterval(state.timer); state.timer=null;
    state.calls=[];
    state.roundActive=false;
    state.shieldUsed=false;
    setLocked(false);
    seedBombs();
    renderCard();
    el.calls.innerHTML='';
    setStatus('Waiting to start…');
  }

  function startRound(){
    if(state.roundActive) return;
    state.roundActive=true;
    const pool = new Set(Array.from({length:42}, (_,i)=>i+1));
    setStatus('Round started. Good luck!', 'ok');
    state.timer = setInterval(()=>{
      if(pool.size===0){ clearInterval(state.timer); setStatus('All numbers called. Round over.', 'warn'); return; }
      const arr=[...pool]; const pick = arr[Math.floor(Math.random()*arr.length)];
      pool.delete(pick);
      state.calls.push(pick);
      if(state.card.includes(pick) && state.bombs.has(pick)){
        if(state.shieldChosen && !state.shieldUsed){
          state.shieldUsed=true;
          setStatus(`Shield absorbed a bomb on ${pick}!`, 'ok');
        }else{
          renderCalls(pick);
          renderCard();
          clearInterval(state.timer);
          setStatus(`💥 Boom! ${pick} was a bomb. Round over.`, 'bad');
          return;
        }
      }
      renderCalls(pick);
      renderCard();
      if(state.card.every(n=>state.calls.includes(n))){
        clearInterval(state.timer);
        setStatus('🎉 Bingo! You completed the line.', 'ok');
      }
    }, 800);
  }

  document.getElementById('lockBtn').addEventListener('click', ()=>{
    if(!state.locked){
      state.shieldChosen = !!document.getElementById('shieldToggle').checked;
      setLocked(true);
      startRound();
    }else{
      if(!state.roundActive){
        setLocked(false);
      }
    }
  });

  document.getElementById('randomizeBtn').addEventListener('click', ()=>{
    if(state.locked) return;
    makeCard();
  });
  document.getElementById('restartBtn').addEventListener('click', ()=> restart());
  document.getElementById('shieldToggle').addEventListener('change', (e)=>{
    if(state.roundActive) return;
    state.shieldChosen = !!e.target.checked;
  });

  setLocked(false);
  makeCard();
  seedBombs();
  setStatus('Pick shield (optional), lock your card to start.');
})();
