
(function(){
  const RANGES = [
    [1,7], [8,14], [15,21], [22,28], [29,35], [36,42]
  ];
  const MAX_CARDS = 4;

  let CALL_INTERVAL_MS = 800;

  const state = {
    locked:false,
    shieldChosen:false,
    shieldUsed:false,
    roundActive:false,
    activeIndex:0,
    cards:[],
    bombs:new Set(),
    calls:[],
    timer:null,
    oneUp:true
  };

  const el = {
    lockBtn: document.getElementById('lockBtn'),
    lockIcon: document.getElementById('lockIcon'),
    lockLabel: document.getElementById('lockLabel'),
    randomizeBtn: document.getElementById('randomizeBtn'),
    restartBtn: document.getElementById('restartBtn'),
    shieldToggle: document.getElementById('shieldToggle'),
    oneUpBtn: document.getElementById('oneUpBtn'),
    fourUpBtn: document.getElementById('fourUpBtn'),
    speedRange: document.getElementById('speedRange'),
    speedLabel: document.getElementById('speedLabel'),
    cardsGrid: document.getElementById('cardsGrid'),
    calls: document.getElementById('calls'),
    status: document.getElementById('status')
  };

  function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function drawUnique(range, count, exclude=new Set()){
    const [a,b] = range; const out = new Set();
    while(out.size<count){
      const n = randInt(a,b);
      if(!out.has(n) && !exclude.has(n)) out.add(n);
    }
    return [...out];
  }
  function makeCard(){
    const used = new Set();
    return RANGES.map(r=>{
      const [n] = drawUnique(r,1,used);
      used.add(n); return n;
    });
  }
  function seedCards(){
    state.cards = Array.from({length:MAX_CARDS}, ()=>makeCard());
  }
  function seedBombs(){
    state.bombs.clear();
    const all = Array.from({length:42}, (_,i)=>i+1);
    const bombCount = Math.max(4, Math.floor(all.length*0.15));
    while(state.bombs.size < bombCount){
      state.bombs.add(all[randInt(0,all.length-1)]);
    }
  }
  function setStatus(text, kind){
    el.status.className = 'status-line ' + (kind||'');
    el.status.textContent = text;
  }
  function setLocked(v){
    state.locked = v;
    if(v){
      el.lockIcon.className='icon lock-closed';
      el.lockLabel.textContent='Locked';
      el.randomizeBtn.disabled = true;
      el.shieldToggle.disabled = true;
    }else{
      el.lockIcon.className='icon lock-open';
      el.lockLabel.textContent='Lock';
      el.randomizeBtn.disabled = false;
      el.shieldToggle.disabled = false;
    }
  }
  function restart(){
    clearInterval(state.timer); state.timer=null;
    state.calls=[]; state.roundActive=false; state.shieldUsed=false;
    setLocked(false);
    seedBombs();
    render();
    el.calls.innerHTML='';
    setStatus('Pick shield (optional), select a card, then lock to start.');
  }
  function renderCards(){
    el.cardsGrid.innerHTML = '';
    state.cards.forEach((card, idx)=>{
      const box = document.createElement('div');
      box.className = 'cardBox' + (idx===state.activeIndex ? ' active' : '');
      box.tabIndex = 0;
      box.addEventListener('click', ()=>{
        if(state.locked) return;
        state.activeIndex = idx;
        renderCards();
      });
      const row = document.createElement('div');
      row.className='card-row';
      card.forEach(n=>{
        const cell = document.createElement('div');
        cell.className='cell';
        if(state.calls.includes(n)) cell.classList.add('hit');
        if(state.bombs.has(n)) cell.classList.add('bomb');
        if(state.calls.includes(n) && state.bombs.has(n)) cell.classList.add('exploded');
        cell.textContent = String(n);
        row.appendChild(cell);
      });
      box.appendChild(row);
      el.cardsGrid.appendChild(box);
    });
    document.body.classList.toggle('oneup', state.oneUp);
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
  function render(){ renderCards(); }

  function startRound(){
    if(state.roundActive) return;
    state.roundActive = true;
    const pool = new Set(Array.from({length:42}, (_,i)=>i+1));
    setStatus('Round started. Good luck!', 'ok');
    state.timer = setInterval(()=>{
      if(pool.size===0){ clearInterval(state.timer); setStatus('All numbers called. Round over.', 'warn'); return; }
      const arr=[...pool]; const pick = arr[randInt(0,arr.length-1)];
      pool.delete(pick);
      state.calls.push(pick);

      // Explosion logic for active card only
      const activeCard = state.cards[state.activeIndex];
      if(activeCard.includes(pick) && state.bombs.has(pick)){
        if(state.shieldChosen && !state.shieldUsed){
          state.shieldUsed = true;
          setStatus(`Shield absorbed a bomb on ${pick}!`, 'ok');
        }else{
          renderCalls(pick); render();
          clearInterval(state.timer);
          setStatus(`💥 Boom! ${pick} was a bomb. Round over.`, 'bad');
          return;
        }
      }
      renderCalls(pick); render();

      // win condition: all 6 numbers on the active card called (without explosion)
      if(activeCard.every(n=>state.calls.includes(n))){
        clearInterval(state.timer);
        setStatus('🎉 Bingo! You completed the line.', 'ok');
      }
    }, CALL_INTERVAL_MS);
  }

  // Wire UI
  el.lockBtn.addEventListener('click', ()=>{
    if(!state.locked){
      state.shieldChosen = !!el.shieldToggle.checked;
      setLocked(true);
      startRound();
    }else{
      if(!state.roundActive){
        setLocked(false);
      }
    }
  });
  el.randomizeBtn.addEventListener('click', ()=>{
    if(state.locked) return;
    state.cards[state.activeIndex] = makeCard();
    render();
  });
  el.restartBtn.addEventListener('click', ()=> restart());

  el.oneUpBtn.addEventListener('click', ()=>{
    state.oneUp = true;
    el.oneUpBtn.classList.add('active');
    el.fourUpBtn.classList.remove('active');
    render();
  });
  el.fourUpBtn.addEventListener('click', ()=>{
    state.oneUp = false;
    el.fourUpBtn.classList.add('active');
    el.oneUpBtn.classList.remove('active');
    render();
  });

  el.speedRange.addEventListener('input', (e)=>{
    CALL_INTERVAL_MS = Number(e.target.value);
    document.getElementById('speedLabel').textContent = CALL_INTERVAL_MS + ' ms';
  });

  // Init
  seedCards(); seedBombs(); setLocked(false); render();
  setStatus('Pick shield (optional), select a card, then lock to start.');
})();
