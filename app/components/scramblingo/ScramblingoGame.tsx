'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GAME_TYPES } from '@/lib/gameConstants';
import { LetterMapper } from '@/lib/scramblingo/gameLogic';

interface ScramblingoCard {
  id: string;
  letters: string[];
  numbers: number[];
  daubs: number;
  daubed_positions: boolean[];
  completed: boolean;
}

interface ScramblingoProps {
  alias?: string;
  walletBalance?: number;
  roundId?: string;
}

export default function Scramblingo({ alias, walletBalance = 1000, roundId }: ScramblingoProps) {
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
  const [purchasedCards, setPurchasedCards] = useState<ScramblingoCard[]>([]);
  const [draggedLetter, setDraggedLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeUntilStart, setTimeUntilStart] = useState<number | null>(null);
  const [calledLetters, setCalledLetters] = useState<string[]>([]);
  const [gamePhase, setGamePhase] = useState<'setup' | 'live' | 'ended'>('setup');
  const [cardPrice, setCardPrice] = useState<number>(10);
  const [multiBuyQty, setMultiBuyQty] = useState<number>(1);
  const [walletLocal, setWalletLocal] = useState<number>(walletBalance || 0);
  const [processedCalls, setProcessedCalls] = useState<number>(0);
  const [winnerInfo, setWinnerInfo] = useState<{ alias: string; daubs: number } | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [winnerDetail, setWinnerDetail] = useState<{ total: number; aliases: string[]; singleLetters?: string[]; cardId?: string } | null>(null);
  const [prizePool, setPrizePool] = useState<number>(0);
  const [winnerPreviewLetters, setWinnerPreviewLetters] = useState<string[] | null>(null);
  const [winnerPreviewId, setWinnerPreviewId] = useState<string | null>(null);
  const [playersNearWin, setPlayersNearWin] = useState<number>(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const computedPot = Math.floor(((purchasedCards?.length || 0) * (cardPrice || 0)) * 0.65);
  const displayPot = Number.isFinite(prizePool) && prizePool > 0 ? prizePool : computedPot;

  // Avoid re-opening popup after user acknowledged
  const winnerAckRef = useRef(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupHoldUntilRef = useRef<number | null>(null);
  
  // Track viewport width for responsive letter button sizing
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 769);
  
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    
    if (typeof window !== 'undefined') {
      setViewportWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Hard close popup whenever phase changes away from 'ended'
  useEffect(() => {
    if (gamePhase !== 'ended') {
      // Keep popup visible during the hold window (up to 20s) unless user acknowledged
      const now = Date.now();
      const holdUntil = popupHoldUntilRef.current || 0;
      const withinHold = holdUntil && now < holdUntil;
      if (!withinHold && showWinner) {
        setShowWinner(false);
        setWinnerDetail(null);
        setWinnerInfo(null);
      }
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
        popupTimerRef.current = null;
      }
    }
  }, [gamePhase]);

  const handleWinnerOk = async () => {
    // Close immediately and mark acknowledged, then transition in background
    setShowWinner(false);
    setWinnerDetail(null);
    setWinnerInfo(null);
    winnerAckRef.current = true;
    try {
      await fetch('/api/round/transition', { method: 'POST' });
      await fetchGameStatus();
    } catch {}
  };

  // Keep local wallet in sync with prop when it changes from server
  useEffect(() => {
    if (typeof walletBalance === 'number') {
      setWalletLocal(walletBalance);
    }
  }, [walletBalance]);

  // Track previous phase to detect transitions back to setup
  const prevPhaseRef = useRef<typeof gamePhase>(gamePhase);

  // Reset all client-side state when returning to setup
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (gamePhase === 'setup' && prev !== 'setup') {
      setCalledLetters([]);
      setSelectedLetters([]);
      setDraggedLetter(null);
      setPurchasedCards([]);
    }
    prevPhaseRef.current = gamePhase;
  }, [gamePhase]);

  // During live, clear any pre-buy selections so the board shows only called letters
  useEffect(() => {
    if (gamePhase === 'live') {
      setSelectedLetters([]);
      setDraggedLetter(null);
    }
  }, [gamePhase]);

  // Show message if no round ID is available
  if (!roundId) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        background: '#0f1220',
        color: '#fff',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <h2>No Active Round</h2>
          <p>Please wait for a round to start or contact an administrator.</p>
        </div>
      </div>
    );
  }

  const allLetters = LetterMapper.getAllLetters();
  const maxCards = 200;
  const cardSize = 6;

  useEffect(() => {
    if (roundId) {
      loadCards();
    }
  }, [roundId]);

  useEffect(() => {
    // Poll for game status
    const interval = setInterval(() => {
      fetchGameStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchGameStatus = async () => {
    try {
      const response = await fetch(`/api/game/status?alias=${encodeURIComponent(alias || '')}&ts=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      
      if (data.roundState?.phase) {
        setGamePhase(data.roundState.phase);
      }
      
      if (data.roundState?.called) {
        // Convert called numbers to letters
        const letters = data.roundState.called.map((num: number) => LetterMapper.numberToLetter(num));
        setCalledLetters(letters);

        // Auto-daub new calls during live
        if (data.roundState?.phase === 'live') {
          const newCount = letters.length;
          if (newCount > processedCalls) {
            for (let i = processedCalls; i < newCount; i++) {
              const newLetter = letters[i];
              await daubForLetter(newLetter);
            }
            setProcessedCalls(newCount);
          }
          
          // Get players near win from server (includes all players)
          const serverNearWin = data.roundState?.players_near_win || 0;
          setPlayersNearWin(serverNearWin);

          // Update live winner preview using server prediction if available
          try {
            const pred = Array.isArray((data as any).predictedWinnerCards) ? (data as any).predictedWinnerCards : [];
            if (pred.length > 0) {
              const mine = pred.find((p:any)=>p.player_alias === alias);
              const single = pred.length === 1 ? pred[0] : null;
              const chosen = (mine && Array.isArray(mine.letters) && mine.letters.length===6) ? mine.letters : (single?.letters?.length===6 ? single.letters : null);
              if (chosen) {
                setWinnerPreviewLetters(chosen);
                setWinnerPreviewId((mine?.id || single?.id) ?? null);
                if (!winnerDetail) {
                  const aliases: string[] = Array.from(new Set(pred.map((c:any)=>c.player_alias).filter((a: any): a is string => Boolean(a) && typeof a === 'string')));
                  setWinnerDetail({ total: pred.length, aliases, singleLetters: chosen, cardId: (mine?.id || single?.id) ?? undefined });
                }
              }
            }
          } catch {}
        } else if (data.roundState?.phase === 'setup') {
          // Reset processed count on new round
          if (processedCalls !== 0) setProcessedCalls(0);
          setWinnerPreviewLetters(null);
          setWinnerPreviewId(null);
        } else if (data.roundState?.phase === 'ended') {
          // Final reconciliation to ensure the last call is visually daubed
          // Use numeric mapping to avoid letter case mismatches
          const calledNums = (data.roundState.called || []) as number[];
          const calledSet = new Set(calledNums.map(n => Number(n)));
          setPurchasedCards(prev => prev.map(card => {
            const next = { ...card } as any;
            const lettersArr = Array.isArray(card.letters) ? card.letters : [];
            const numbersArr = Array.isArray(card.numbers) ? card.numbers.map(Number) : [];
            const len = Math.max(lettersArr.length, numbersArr.length);
            const dp = [...(card.daubed_positions || new Array(len).fill(false))];
            let daubs = 0;
            for (let idx = 0; idx < len; idx++) {
              const num = Number(numbersArr[idx] ?? LetterMapper.letterToNumber?.(lettersArr[idx]));
              const isCalled = calledSet.has(num);
              dp[idx] = Boolean(dp[idx] || isCalled);
              if (dp[idx]) daubs++;
            }
            next.daubed_positions = dp;
            next.daubs = daubs;
            next.completed = daubs >= len && len > 0;
            return next;
          }));
          // Keep preview letters if already known
        }
      }
      
      // Calculate time until start
      if (data.schedulerStatus?.timeUntilNextGame) {
        setTimeUntilStart(data.schedulerStatus.timeUntilNextGame);
      }

      if (data.pricing?.cardPrice != null) {
        setCardPrice(Number(data.pricing.cardPrice));
      }

      if (typeof data.roundState?.prize_pool === 'number') {
        setPrizePool(Number(data.roundState.prize_pool));
      }

      // Winner popup when ended
      if (data.roundState?.phase === 'ended') {
        if (data.roundState?.winner) setWinnerInfo(data.roundState.winner);
        if (!winnerAckRef.current && !showWinner) {
          setShowWinner(true); // show immediately to ensure visibility
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }
        // Start/refresh a 20s hold window so brief phase flips don't hide the popup
        popupHoldUntilRef.current = Date.now() + 20000;
        // Fetch completed cards to enrich popup
        // First, try predicted winners provided by server during setup
        if (Array.isArray(data.predictedWinnerCards) && data.predictedWinnerCards.length > 0) {
          const minePred = data.predictedWinnerCards.find((c:any)=>c.player_alias === alias);
          const single = data.predictedWinnerCards.length === 1 ? data.predictedWinnerCards[0] : null;
          const letters = (minePred?.letters?.length === 6 ? minePred.letters : (single?.letters?.length === 6 ? single.letters : undefined));
          if (letters) {
            const aliases: string[] = Array.from(new Set(data.predictedWinnerCards.map((c:any)=>c.player_alias).filter((a: any): a is string => Boolean(a) && typeof a === 'string')));
            setWinnerDetail({ total: data.predictedWinnerCards.length, aliases, singleLetters: letters });
          }
        }
        if (!winnerDetail) {
        try {
          const r = await fetch('/api/scramblingo/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_completed', roundId })
          });
          const j = await r.json();
          if (r.ok && Array.isArray(j?.cards)) {
            const total = j.cards.length || 0;
            if (total > 0) {
              const aliases: string[] = Array.from(new Set(j.cards.map((c:any)=>c.player_alias).filter((a: any): a is string => Boolean(a) && typeof a === 'string')));
              // prefer my winning card; fallback to only card if single winner
              let singleLetters: string[] | undefined;
              let singleId: string | undefined;
              const normalizeLetters = (c:any) => {
                if (Array.isArray(c?.letters) && c.letters.length === 6) return c.letters as string[];
                if (Array.isArray(c?.numbers) && c.numbers.length === 6) return (c.numbers as number[]).map((n:number)=>LetterMapper.numberToLetter(Number(n)));
                return undefined;
              };
              const mine = j.cards.find((c:any) => c.player_alias === alias);
              if (mine) { singleLetters = normalizeLetters(mine); singleId = mine.id; }
              if (!singleLetters && total === 1) { singleLetters = normalizeLetters(j.cards[0]); singleId = j.cards[0]?.id; }
              // As a last resort, if still empty, try pulling freshly from server-owned called list
              if (!singleLetters && Array.isArray(data.roundState?.called)) {
                const calledSet = new Set((data.roundState.called || []).map((n:number)=>LetterMapper.numberToLetter(Number(n))));
                // Prefer a local card that is fully covered by called letters
                const winnerLocal = purchasedCards.find(c => Array.isArray(c?.letters) && c.letters.length === 6 && c.letters.every(l => calledSet.has(l)));
                if (winnerLocal) { singleLetters = winnerLocal.letters; singleId = winnerLocal.id as any; }
                // Otherwise, fall back to any local card (single player scenario)
                if (!singleLetters) {
                  const anyLocal = purchasedCards.find(c => Array.isArray(c?.letters) && c.letters.length === 6);
                  if (anyLocal) { singleLetters = anyLocal.letters; singleId = anyLocal.id as any; }
                }
              }
              setWinnerDetail({ total, aliases, singleLetters, cardId: singleId });
            } else {
              // No cards returned from API (edge). Try local completed card.
              const localWin = purchasedCards.find(c => c?.completed && Array.isArray(c.letters) && c.letters.length === 6);
              if (localWin) {
                setWinnerDetail({ total: 1, aliases: [alias || ''], singleLetters: localWin.letters, cardId: localWin.id as any });
              } else {
                setWinnerDetail(null);
              }
            }
            // No auto-close; user confirms with OK
          }
        } catch {}
        }
      } else if (data.roundState?.phase !== 'ended') {
        // Reset acknowledgement when we return to setup so next round can show popup again
        winnerAckRef.current = false;
        if (showWinner) {
          setShowWinner(false);
          setWinnerDetail(null);
          setWinnerInfo(null);
        }
      }
    } catch (error) {
      console.error('Error fetching game status:', error);
    }
  };

  // Auto-daub helper: apply called letter to all purchased cards
  const daubForLetter = async (letter: string): Promise<boolean> => {
    let hadMatch = false;
    const tasks = purchasedCards.map(async (card) => {
      const idx = card.letters.indexOf(letter);
      if (idx === -1) return;
      if (card.daubed_positions?.[idx]) return;
      hadMatch = true;
      // Optimistic local update so last daub is visible immediately
      setPurchasedCards(prev => prev.map(c => {
        if (c.id !== card.id) return c;
        const next = { ...c, daubed_positions: [...(c.daubed_positions || [])], daubs: (c.daubs || 0) } as any;
        next.daubed_positions[idx] = true;
        next.daubs = (next.daubs || 0) + 1;
        next.completed = next.daubs >= cardSize;
        if (next.completed) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }
        return next;
      }));
      try {
        const res = await fetch('/api/scramblingo/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'daub_letter', cardId: card.id, calledLetter: letter })
        });
        const j = await res.json();
        if (res.ok && j?.card) {
          setPurchasedCards(prev => prev.map(c => c.id === card.id ? j.card : c));
        }
      } catch (e) {
        console.error('Failed to daub letter', letter, 'for card', card.id, e);
      }
    });
    await Promise.allSettled(tasks);
    return hadMatch;
  };
  
  // Sort cards: completed first, then by daubs (descending)
  // Re-sort whenever purchasedCards changes or game phase changes
  const sortedCards = useMemo(() => {
    if (purchasedCards.length === 0) return [];
    try {
      // Create a copy and ensure daubs is a number
      const cardsWithNumbers = purchasedCards.map(c => {
        const daubs = typeof c.daubs === 'number' 
          ? c.daubs 
          : (Array.isArray(c.daubed_positions) ? c.daubed_positions.filter(Boolean).length : 0);
        const completed = c.completed || daubs >= cardSize;
        return { ...c, daubs, completed };
      });
      
      const sorted = cardsWithNumbers.sort((a, b) => {
        // Completed cards first
        if (a.completed && !b.completed) return -1;
        if (!a.completed && b.completed) return 1;
        // Then by daubs (descending) - most likely to win first
        const daubsA = a.daubs || 0;
        const daubsB = b.daubs || 0;
        if (daubsB !== daubsA) return daubsB - daubsA;
        // Stable sort: maintain original order if daubs are equal
        return 0;
      });
      
      console.log('🔄 Sorting cards:', sorted.map(c => ({ id: c.id?.substring(0, 8), daubs: c.daubs, completed: c.completed })));
      return sorted;
    } catch (e) {
      console.error('Error sorting cards:', e);
      return purchasedCards; // Return unsorted if error
    }
  }, [purchasedCards, gamePhase, cardSize]);

  // Keep phase strictly driven by server to avoid UI flicker between phases

  const loadCards = async () => {
    if (!roundId || !alias) return;
    
    try {
      const response = await fetch('/api/scramblingo/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_cards', playerId: alias, roundId })
      });
      
      const data = await response.json();
      if (data.success) {
        setPurchasedCards(data.cards || []);
      }
    } catch (error) {
      console.error('Error loading cards:', error);
    }
  };

  // If the round id changes, clear any previous round UI artifacts immediately
  useEffect(() => {
    setCalledLetters([]);
    setSelectedLetters([]);
    setDraggedLetter(null);
    setPurchasedCards([]);
  }, [roundId]);

  const handleLetterClick = (letter: string) => {
    if (selectedLetters.includes(letter)) {
      // Remove letter
      setSelectedLetters(prev => prev.filter(l => l !== letter));
    } else if (selectedLetters.length < cardSize) {
      // Add letter
      setSelectedLetters(prev => [...prev, letter]);
    }
  };

  const handleDragStart = (e: React.DragEvent, letter: string) => {
    if (!selectedLetters.includes(letter) && selectedLetters.length < cardSize) {
      setDraggedLetter(letter);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragEnd = () => {
    setDraggedLetter(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedLetter && !selectedLetters.includes(draggedLetter)) {
      const newLetters = [...selectedLetters];
      if (newLetters[index]) {
        // Replace existing letter
        newLetters[index] = draggedLetter;
      } else {
        // Add to empty slot
        newLetters.push(draggedLetter);
      }
      setSelectedLetters(newLetters.slice(0, cardSize));
    }
    setDraggedLetter(null);
  };

  const handleRandomCard = () => {
    const randomLetters = [];
    const available = allLetters.filter(l => !selectedLetters.includes(l));
    
    while (randomLetters.length < cardSize && available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length);
      randomLetters.push(available[randomIndex]);
      available.splice(randomIndex, 1);
    }
    
    setSelectedLetters(randomLetters);
  };

  const handleReset = () => {
    setSelectedLetters([]);
  };

  const handleBuy = async () => {
    if (!alias || !roundId) {
      alert('Please set an alias first');
      return;
    }

    if (selectedLetters.length !== cardSize) {
      alert(`Please select exactly ${cardSize} letters`);
      return;
    }

    // Check purchase window (last 8 seconds)
    if (timeUntilStart !== null && timeUntilStart <= 8) {
      alert('Purchase window closed! Game starting in less than 8 seconds.');
      return;
    }

    // Check card limit
    if (purchasedCards.length >= maxCards) {
      alert(`Maximum card limit reached (${maxCards} cards)`);
      return;
    }

    console.log('🎮 Scramblingo - Attempting to purchase card for roundId:', roundId);
    console.log('🎮 Scramblingo - Selected letters:', selectedLetters);
    console.log('🎮 Scramblingo - Player alias:', alias);
    setLoading(true);
    try {
      const response = await fetch('/api/scramblingo/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create_card',
          playerId: alias,
          roundId,
          letters: selectedLetters
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setPurchasedCards(prev => [...prev, data.card]);
        setSelectedLetters([]);
        // Silent success – no popup
        console.log('Scramblingo: Card purchased successfully');
        // Optimistically update wallet locally
        setWalletLocal(prev => Math.max(0, (prev || 0) - cardPrice));
      } else {
        alert('Failed to purchase card: ' + data.error);
      }
    } catch (error) {
      console.error('Error purchasing card:', error);
      alert('Error purchasing card');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyRandomMultiple = async () => {
    if (!alias || !roundId) return;
    if (timeUntilStart !== null && timeUntilStart <= 8) return;
    setLoading(true);
    try {
      const res = await fetch('/api/scramblingo/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_random_bulk', playerId: alias, roundId, qty: multiBuyQty })
      });
      const j = await res.json();
      if (res.ok && Array.isArray(j?.cards)) {
        setPurchasedCards(prev => [...j.cards, ...prev]);
        setWalletLocal(prev => Math.max(0, (prev || 0) - cardPrice * (j.cards.length || 0)));
      }
    } catch (e) {
      console.error('Multi buy error', e);
    } finally {
      setLoading(false);
    }
  };

  const isLetterAvailable = (letter: string) => {
    return !selectedLetters.includes(letter);
  };

  const isLetterCalled = (letter: string) => {
    return calledLetters.includes(letter);
  };

  const getCardProgress = (card: ScramblingoCard) => {
    const daubs = typeof card.daubs === 'number' 
      ? card.daubs 
      : (Array.isArray(card.daubed_positions) ? card.daubed_positions.filter(Boolean).length : 0);
    return (daubs / cardSize) * 100;
  };

  const renderLetterButton = (letter: string) => {
    const inSetup = gamePhase === 'setup';
    const isSelected = inSetup && selectedLetters.includes(letter);
    const isAvailable = inSetup && isLetterAvailable(letter);
    const isCalled = isLetterCalled(letter);
    
    // Use responsive sizing: smaller on mobile, larger on desktop
    const isDesktop = viewportWidth >= 769;
    const buttonSize = isDesktop ? '44px' : '26px';
    const fontSize = isDesktop ? '14px' : '10px';
    const padding = isDesktop ? '4px' : '2px';
    
    return (
      <button
        key={letter}
        className={`letter-btn ${isSelected ? 'selected' : ''} ${(!inSetup) ? 'disabled' : (!isAvailable ? 'disabled' : '')} ${isCalled ? 'called' : ''}`}
        onClick={inSetup ? () => handleLetterClick(letter) : undefined}
        onDragStart={inSetup ? (e) => handleDragStart(e, letter) : undefined}
        onDragEnd={inSetup ? handleDragEnd : undefined}
        draggable={inSetup && isAvailable && selectedLetters.length < cardSize}
        disabled={!inSetup || (!isAvailable && !isSelected)}
        style={{
          width: buttonSize,
          height: buttonSize,
          minWidth: buttonSize,
          minHeight: buttonSize,
          maxWidth: buttonSize,
          maxHeight: buttonSize,
          padding: padding,
          background: isCalled ? '#ff6b6b' : (isSelected ? '#4CAF50' : '#16213e'),
          color: 'white',
          border: `2px solid ${isCalled ? '#ee5a6f' : (isSelected ? '#45a049' : '#0f3460')}`,
          borderRadius: '6px',
          cursor: (!inSetup || (!isAvailable && !isSelected)) ? 'not-allowed' : 'pointer',
          fontSize: fontSize,
          fontWeight: 'bold',
          transition: 'all 0.2s',
          opacity: (!inSetup || (!isAvailable && !isSelected)) ? 0.5 : 1,
          boxSizing: 'border-box'
        }}
      >
        {letter}
      </button>
    );
  };

  const renderCardSlot = (index: number) => {
    const letter = selectedLetters[index];
    const isCalled = letter && isLetterCalled(letter);
    
    return (
      <div
        key={index}
        className={`card-slot ${letter ? 'filled' : 'empty'} ${isCalled ? 'daubed' : ''}`}
        onDrop={(e) => handleDrop(e, index)}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onClick={() => {
          if (letter) {
            // Remove letter on click
            setSelectedLetters(prev => prev.filter((_, i) => i !== index));
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '60px',
          minWidth: '60px',
          maxWidth: '60px',
          height: '60px',
          minHeight: '60px',
          maxHeight: '60px',
          flexShrink: 0,
          flexGrow: 0,
          fontSize: '24px',
          fontWeight: 'bold',
          color: 'white',
          cursor: 'pointer',
          transition: 'all 0.2s',
          background: letter ? '#1e40af' : '#16213e',
          border: letter ? '3px solid #3b82f6' : '3px dashed #0f3460',
          borderRadius: '12px',
          boxSizing: 'border-box'
        }}
      >
        {letter || ''}
      </div>
    );
  };

  const renderPurchasedCard = (card: ScramblingoCard, index: number) => {
    const progress = getCardProgress(card);
    // Calculate actual daubs from daubed_positions array if daubs field is missing
    const actualDaubs = typeof card.daubs === 'number' 
      ? card.daubs 
      : (Array.isArray(card.daubed_positions) ? card.daubed_positions.filter(Boolean).length : 0);
    const isCompleted = card.completed || actualDaubs >= cardSize;
    
    // Show badge during live phase when 4 or 5 letters are daubed
    const almostThere = (gamePhase === 'live' && !isCompleted && actualDaubs >= 4) 
      ? (actualDaubs === 5 ? '1tg' : actualDaubs === 4 ? '2tg' : null)
      : null;
    
    // Debug logging for badges
    if (gamePhase === 'live' && actualDaubs >= 4) {
      console.log('🏷️ Badge check:', { cardId: card.id?.substring(0, 8), actualDaubs, isCompleted, almostThere, gamePhase });
    }
    
    return (
      <div 
        key={card.id} 
        className={`purchased-card ${card.completed ? 'completed' : ''}`}
      >
        <div className="card-header">
          <span className="card-id">Card #{index + 1}</span>
          <span className="card-progress">
            {actualDaubs}/{cardSize} {isCompleted ? '· FULL' : ''}
            {almostThere && (
              <span style={{
                marginLeft: '8px',
                padding: '2px 8px',
                background: almostThere === '1tg' ? '#ff6b6b' : '#ffa500',
                color: 'white',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold',
                animation: 'pulse 1s infinite'
              }}>
                {almostThere === '1tg' ? '1TG' : '2TG'}!
              </span>
            )}
          </span>
        </div>
        <div
          className="purchased-card-slots"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 56px)',
            gap: '4px',
            marginBottom: '10px',
            justifyContent: 'start'
          }}
        >
          {card.letters.map((letter, index) => {
            const isDaubed = !!card.daubed_positions[index];
            const isCalled = calledLetters.includes(letter);
            const classes = ['pc-slot'];
            if (letter) classes.push('filled');
            if (isCalled) classes.push('called');
            if (isDaubed) classes.push('daubed');
            return (
              <div
                key={index}
                className={classes.join(' ')}
                style={{
                  width: '56px',
                  minWidth: '56px',
                  maxWidth: '56px',
                  height: '56px',
                  minHeight: '56px',
                  maxHeight: '56px',
                  flexShrink: 0,
                  flexGrow: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  fontSize: '22px',
                  fontWeight: 'bold',
                  // Show green when called or daubed; red only used on global letter board
                  background: (isDaubed || isCalled) ? '#4CAF50' : (letter ? '#1e40af' : '#16213e'),
                  border: (isDaubed || isCalled) ? '3px solid #45a049' : (letter ? '3px solid #3b82f6' : '3px dashed #0f3460'),
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              >
                {letter}
              </div>
            );
          })}
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        {isCompleted && <div className="winner-badge">🎉 Winner!</div>}
      </div>
    );
  };

  // Show builder only when the round phase is explicitly 'setup'
  const inPrebuy = (gamePhase === 'setup');

  return (
    <div className="scramblingo-game">
      <div className="game-header">
        <h2>🎮 Scramblingo</h2>
        <div className="game-info">
          <span>Wallet: {walletLocal} coins</span>
          <span>Alias: {alias || '—'}</span>
          <span>Pot: <b>{displayPot}</b></span>
          {timeUntilStart !== null && gamePhase !== 'live' && (
            <span className={timeUntilStart <= 8 ? 'warning' : ''}>
              {timeUntilStart > 0 ? `Start in: ${timeUntilStart}s` : 'Game starting...'}
            </span>
          )}
          {gamePhase === 'live' && (
            <span>· Called: <b>{calledLetters.length}</b>/52</span>
          )}
          {gamePhase === 'live' && playersNearWin > 0 && (
            <span style={{ color: '#ff6b6b', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
              🔥 {playersNearWin} {playersNearWin === 1 ? 'player' : 'players'} {playersNearWin === 1 ? 'is' : 'are'} one letter away!
            </span>
          )}
        </div>
      </div>
      
      {/* Confetti Animation */}
      {showConfetti && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9999
        }}>
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: '-10px',
                width: '10px',
                height: '10px',
                background: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da'][Math.floor(Math.random() * 6)],
                animation: `confettiFall ${2 + Math.random() * 3}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            />
          ))}
        </div>
      )}

      {/* Letter board should remain visible during the game */}
      <div className="letter-grid" style={{ pointerEvents: inPrebuy ? 'auto' : 'none' }}>
        <h3>{inPrebuy ? 'Select Letters' : 'Letters'}</h3>
        <div className="letters-container">
          {allLetters.map(renderLetterButton)}
        </div>
      </div>

      {inPrebuy && (
        <>
          <div className="card-section">
            <h3>Your Card</h3>
            <div style={{ color: '#b6c0ff', marginBottom: '8px' }}>Price: <b>{cardPrice}</b> coins</div>
            <div className="card-container">
              {Array.from({ length: cardSize }).map((_, index) => renderCardSlot(index))}
            </div>
            <div className="card-actions">
              <button onClick={handleRandomCard} className="random-btn">
                🎲 Random My Card!
              </button>
              <button onClick={handleReset} className="reset-btn">
                Reset
              </button>
              <button 
                onClick={handleBuy} 
                disabled={loading || selectedLetters.length !== cardSize || (timeUntilStart !== null && timeUntilStart <= 8)}
                className="buy-btn"
              >
                {loading ? 'Buying...' : 'BUY'}
              </button>
            </div>
            <div className="multi-buy-row">
              <label className="multi-label">Quick buy:</label>
              <select
                value={multiBuyQty}
                onChange={e => setMultiBuyQty(parseInt(e.target.value))}
                className="multi-select"
              >
                <option value={1}>1</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
              <button
                onClick={handleBuyRandomMultiple}
                disabled={loading || (timeUntilStart !== null && timeUntilStart <= 8)}
                className="random-btn large"
              >
                Buy Random ×{multiBuyQty}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Removed live winning card preview per request */}

      <div className="purchased-cards-section">
        <h3>Your Cards ({purchasedCards.length}/{maxCards})</h3>
        {/* Remove duplicate called letters bar during live to avoid redundancy */}
        <div className="cards-grid">
          {sortedCards.length === 0 ? (
            <div className="no-cards">
              <p>No cards purchased yet. Build your card above!</p>
            </div>
          ) : (
            sortedCards.map((card, idx) => renderPurchasedCard(card, idx))
          )}
        </div>
      </div>

      {showWinner && gamePhase === 'ended' && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'radial-gradient(1200px 600px at 50% -10%, rgba(76,175,80,.25), rgba(0,0,0,.65))',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          padding: 16
        }}>
          <div style={{
            position: 'relative',
            width: 460,
            maxWidth: '92vw',
            color: '#fff',
            padding: 24,
            borderRadius: 16,
            background: 'linear-gradient(180deg, rgba(17,25,54,.98), rgba(17,25,54,.92))',
            boxShadow: '0 20px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06) inset',
            border: '1px solid rgba(76,175,80,.6)'
          }}>
            <div style={{
              position:'absolute', inset: -2, borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(76,175,80,.65), rgba(59,130,246,.55))',
              filter: 'blur(20px)', opacity:.25, pointerEvents:'none'
            }} />

            <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 26, lineHeight: 1, filter:'drop-shadow(0 3px 6px rgba(0,0,0,.4))' }}>🏆</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: .3 }}>Winner</div>
            </div>

            <div style={{ fontSize: 17, marginBottom: 14, display:'flex', gap:8, alignItems:'baseline' }}>
              <span style={{ fontWeight: 700 }}>{(winnerDetail?.aliases?.[0] || winnerInfo?.alias || '—')}</span>
              <span style={{ opacity:.8 }}>– Pot:</span>
              <span style={{ fontWeight: 800, color:'#4CAF50' }}>{Number.isFinite(prizePool) ? prizePool : 0}</span>
            </div>

            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, opacity:.9 }}>Winning card:</div>
            { (()=>{
                let idToShow = winnerDetail?.cardId || winnerPreviewId;
                if (!idToShow && Array.isArray(winnerPreviewLetters) && winnerPreviewLetters.length===6) {
                  const match = purchasedCards.find(c => Array.isArray(c?.letters) && c.letters.length===6 && c.letters.join(',')===winnerPreviewLetters.join(','));
                  if (match) idToShow = match.id as any;
                }
                return idToShow ? (
                  <div style={{ fontSize: 12, marginBottom: 8, color:'#9ecbff', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace' }}>
                    Card ID: {idToShow}
                  </div>
                ) : null;
              })() }
            {(() => { const displayLetters = (winnerDetail?.singleLetters && winnerDetail.singleLetters.length===6) ? winnerDetail.singleLetters : (winnerPreviewLetters && winnerPreviewLetters.length===6 ? winnerPreviewLetters : null); return displayLetters ? (
              <div style={{ display:'flex', gap:10, marginBottom: 18 }}>
                {displayLetters.map((l, idx) => (
                  <div key={idx} style={{
                    width:44, height:44, borderRadius:10,
                    background:'linear-gradient(180deg, #1e40af, #173182)',
                    border:'1px solid rgba(59,130,246,.5)',
                    boxShadow:'inset 0 1px 0 rgba(255,255,255,.08), 0 6px 16px rgba(0,0,0,.35)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:20, fontWeight:900
                  }}>
                    {l}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 14, opacity:.9, marginBottom:18 }}>
                {winnerDetail && winnerDetail.total && winnerDetail.total > 1
                  ? `${winnerDetail.total} winning cards by players: ${winnerDetail.aliases.join(', ')}`
                  : '—'}
              </div>
            ) })()}

            {/* Removed preview during game in popup per request */}

            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button className="buy-btn" onClick={handleWinnerOk} style={{ padding:'12px 22px', fontWeight:800 }}>OK</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scramblingo-game {
          padding: 12px;
          max-width: 100%;
          width: 100%;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          color: white;
        }

        .game-header h2 {
          margin: 0;
          font-size: 20px;
        }

        .game-info {
          display: flex;
          gap: 12px;
          font-size: 12px;
          align-items: center;
        }

        .game-info .warning {
          color: #ffd700;
          font-weight: bold;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .letter-grid {
          margin-bottom: 16px;
          background: #1a1a2e;
          padding: 12px;
          border-radius: 12px;
          max-width: 100%;
          overflow-x: hidden;
        }

        .letter-grid h3 {
          color: white;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .letters-container {
          display: grid;
          grid-template-columns: repeat(13, 1fr);
          gap: 4px;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        .letter-btn {
          padding: 2px;
          background: #16213e;
          color: white;
          border: 2px solid #0f3460;
          border-radius: 6px;
          cursor: pointer;
          font-size: 10px;
          font-weight: bold;
          transition: all 0.2s;
          aspect-ratio: 1;
          width: 26px;
          height: 26px;
          min-width: 26px;
          min-height: 26px;
          max-width: 26px;
          max-height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .letter-btn:hover:not(.disabled) {
          background: #0f3460;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }

        /* Desktop: larger letter buttons */
        @media (min-width: 769px) {
          .letter-btn {
            width: 44px !important;
            height: 44px !important;
            min-width: 44px !important;
            min-height: 44px !important;
            max-width: 44px !important;
            max-height: 44px !important;
            font-size: 14px !important;
            padding: 4px !important;
          }
        }

        .letter-btn.selected {
          background: #4CAF50;
          border-color: #45a049;
        }

        .letter-btn.disabled {
          background: #333;
          color: #666;
          cursor: not-allowed;
          opacity: 0.5;
        }

        .letter-btn.called {
          background: #ff6b6b;
          border-color: #ee5a6f;
          animation: calledPulse 0.5s;
        }

        @keyframes calledPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .card-section {
          background: #1a1a2e;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .card-section h3 {
          color: white;
          margin-bottom: 12px;
          font-size: 16px;
        }

        .card-container {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          justify-content: center;
          flex-wrap: wrap;
          max-width: 100%;
          overflow-x: hidden;
        }

        .card-slot {
          width: 60px !important;
          min-width: 60px !important;
          max-width: 60px !important;
          height: 60px !important;
          min-height: 60px !important;
          max-height: 60px !important;
          flex-shrink: 0 !important;
          flex-grow: 0 !important;
          background: #16213e;
          border: 3px dashed #0f3460;
          border-width: 3px !important;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px !important;
          font-weight: bold;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .card-slot.empty {
          border-color: #0f3460;
        }

        .card-slot.filled {
          background: #1e40af;
          border: 3px solid #3b82f6;
        }

        .card-slot.daubed {
          background: #4CAF50;
          border-color: #45a049;
          animation: daubPulse 0.5s;
        }

        @keyframes daubPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .card-slot:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }

        .card-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .random-btn, .reset-btn, .buy-btn {
          padding: 10px 18px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          transition: all 0.2s;
        }

        .random-btn.large { font-size: 15px; padding: 10px 20px; }

        .multi-buy-row {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: center;
          margin-top: 8px;
        }
        .multi-label { color: #b6c0ff; font-size: 14px; }
        .multi-select {
          appearance: none;
          background: #0c1020;
          color: #fff;
          border: 2px solid #2b6cff;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 18px;
          min-width: 100px;
          text-align: center;
        }

        .random-btn {
          background: #667eea;
          color: white;
        }

        .reset-btn {
          background: #666;
          color: white;
        }

        .buy-btn {
          background: #4CAF50;
          color: white;
          font-size: 20px;
          padding: 15px 40px;
        }

        .buy-btn:disabled {
          background: #666;
          cursor: not-allowed;
        }

        .random-btn:hover, .reset-btn:hover, .buy-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }

        .purchased-cards-section {
          background: #1a1a2e;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        @media (min-width: 769px) {
          .purchased-cards-section {
            padding: 20px;
            margin-bottom: 24px;
          }
        }

        .purchased-cards-section h3 {
          color: white;
          margin-bottom: 16px;
          font-size: 16px;
        }

        @media (min-width: 769px) {
          .purchased-cards-section h3 {
            margin-bottom: 20px;
            font-size: 18px;
          }
        }

        .called-letters {
          background: #16213e;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 12px;
          color: white;
        }

        .called-letter {
          display: inline-block;
          background: #ff6b6b;
          color: white;
          padding: 4px 10px;
          margin: 0 3px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 16px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        @media (min-width: 769px) {
          .cards-grid {
            gap: 20px;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          }
          .purchased-card {
            margin-bottom: 20px;
          }
        }

        .purchased-card {
          background: #16213e;
          border-radius: 10px;
          padding: 12px;
          border: 2px solid #0f3460;
        }

        .purchased-card.completed {
          border-color: #4CAF50;
          background: #1a5f1a;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          color: white;
          font-size: 12px;
        }

        .card-progress {
          font-weight: bold;
          color: #4CAF50;
        }

        .purchased-card-slots {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 6px;
          margin-bottom: 8px;
          justify-content: start;
          max-width: 100%;
          overflow-x: hidden;
        }

        .pc-slot {
          width: clamp(36px, 10vw, 56px);
          height: clamp(36px, 10vw, 56px);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-size: clamp(18px, 4vw, 26px);
          font-weight: bold;
          background: #16213e;
          border: 3px dashed #0f3460;
          color: white;
        }

        .pc-slot.filled {
          background: #1e40af;
          border: 3px solid #3b82f6;
        }

        .pc-slot.called {
          background: #ff6b6b;
          border-color: #ee5a6f;
        }

        .pc-slot.daubed {
          background: #4CAF50;
          border-color: #45a049;
          animation: daubPulse 0.5s;
        }

        .progress-bar {
          width: 100%;
          height: 6px;
          background: #0f3460;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #45a049);
          transition: width 0.3s;
        }

        .winner-badge {
          text-align: center;
          color: #ffd700;
          font-weight: bold;
          font-size: 14px;
          margin-top: 6px;
        }

        .no-cards {
          text-align: center;
          padding: 24px;
          color: #666;
          grid-column: 1 / -1;
        }
        
        /* Mobile optimizations */
        @media (max-width: 768px) {
          .card-section { padding: 6px; margin-bottom: 10px; }
          .card-section h3 { font-size: 12px; margin-bottom: 6px; }
          .card-container { gap: 2px; margin-bottom: 6px; flex-wrap: nowrap; justify-content: flex-start; }
        }
        
        @media (max-width: 480px) {
          .scramblingo-game { padding: 4px; }
          .game-header { margin-bottom: 6px; padding: 6px; }
          .game-header h2 { font-size: 14px; }
          .game-info { gap: 4px; font-size: 9px; }
          .purchased-cards-section { padding: 6px; }
          .purchased-cards-section h3 { font-size: 12px; margin-bottom: 6px; }
          .cards-grid { grid-template-columns: 1fr; gap: 6px; }
          .purchased-card { padding: 4px; }
          .purchased-card-slots { gap: 2px; }
          .purchased-card-slots .pc-slot { width: clamp(28px, 7vw, 32px); height: clamp(28px, 7vw, 32px); font-size: clamp(12px, 3vw, 14px); }
          .letter-grid { padding: 6px; margin-bottom: 10px; }
          .letter-grid h3 { font-size: 12px; margin-bottom: 6px; }
          .letters-container { gap: 1px; }
          .letter-btn { padding: 0px; font-size: 6px; min-width: 0; min-height: 0; border-width: 1px; }
          .card-section { padding: 6px; margin-bottom: 10px; }
          .card-section h3 { font-size: 12px; margin-bottom: 6px; }
          .card-container { gap: 2px; margin-bottom: 6px; flex-wrap: nowrap; justify-content: flex-start; }
          .card-slot,
          .card-slot.empty,
          .card-slot.filled,
          .card-slot.daubed {
            width: 26px !important;
            height: 26px !important;
            min-width: 26px !important;
            max-width: 26px !important;
            min-height: 26px !important;
            max-height: 26px !important;
            font-size: 12px !important;
            border-width: 1px !important;
          }
          .card-actions { gap: 4px; flex-wrap: wrap; }
          .random-btn, .reset-btn, .buy-btn { padding: 4px 8px; font-size: 10px; }
          .random-btn.large { font-size: 11px; padding: 4px 10px; }
          .multi-buy-row { gap: 3px; margin-top: 4px; }
          .multi-buy-row input { padding: 3px; font-size: 10px; width: 40px; }
          .card-section > div[style*="marginBottom"] { margin-bottom: 4px !important; font-size: 10px !important; }
        }
        
        /* Very small screens (320px - 375px) */
        @media (max-width: 375px) {
          .letters-container { gap: 0px; }
          .letter-btn { padding: 0px; font-size: 6px; }
          .letter-grid { padding: 4px; }
          .card-slot,
          .card-slot.empty,
          .card-slot.filled,
          .card-slot.daubed {
            width: 24px !important;
            height: 24px !important;
            min-width: 24px !important;
            max-width: 24px !important;
            min-height: 24px !important;
            max-height: 24px !important;
            font-size: 10px !important;
          }
          .card-container { gap: 2px; }
          .random-btn, .reset-btn, .buy-btn { padding: 3px 6px; font-size: 9px; }
          .game-header h2 { font-size: 12px; }
          .game-info { font-size: 8px; }
          .card-section h3, .letter-grid h3, .purchased-cards-section h3 { font-size: 11px; }
        }
        
        /* Common iPhone sizes (390px - 430px) */
        @media (min-width: 390px) and (max-width: 430px) {
          .letters-container { gap: 1px; }
          .letter-btn { padding: 0px; font-size: 6px; }
          .card-slot,
          .card-slot.empty,
          .card-slot.filled,
          .card-slot.daubed {
            width: 28px !important;
            height: 28px !important;
            min-width: 28px !important;
            max-width: 28px !important;
            min-height: 28px !important;
            max-height: 28px !important;
            font-size: 13px !important;
          }
          .card-container { gap: 2px; }
        }
        
        /* Larger phones (412px+) */
        @media (min-width: 412px) and (max-width: 480px) {
          .letters-container { gap: 1px; }
          .letter-btn { padding: 0px; font-size: 7px; }
          .card-slot,
          .card-slot.empty,
          .card-slot.filled,
          .card-slot.daubed {
            width: 30px !important;
            height: 30px !important;
            min-width: 30px !important;
            max-width: 30px !important;
            min-height: 30px !important;
            max-height: 30px !important;
            font-size: 14px !important;
          }
          .card-container { gap: 3px; }
        }
        
        /* Desktop: ensure card slots stay 60px on larger screens - MUST BE LAST */
        @media (min-width: 769px) {
          .card-slot,
          .card-slot.empty,
          .card-slot.filled,
          .card-slot.daubed {
            width: 60px !important;
            min-width: 60px !important;
            max-width: 60px !important;
            height: 60px !important;
            min-height: 60px !important;
            max-height: 60px !important;
            font-size: 24px !important;
            border-width: 3px !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}