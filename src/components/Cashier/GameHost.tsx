import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Square, RotateCcw, 
  Eye, Volume2
} from 'lucide-react';
import { Star } from "lucide-react";

import { motion, AnimatePresence } from 'framer-motion';
import BingoCheckModal from './BingoCheckModal.tsx';
import { supabase, Game, GameCall, GamePattern, CardTemplate } from '../../lib/supabase';
import { generateCallSequence, getNumberLetter, speakNumber } from '../../utils/gameUtils';
import Confetti from 'react-confetti';
import { useSettings } from '../../contexts/SettingsContext';

// removed unused BingoClaim types

const GameHost: React.FC = () => {
  
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { commissionRate } = useSettings();

  // timers
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // refs to avoid stale closures in intervals
  const callIndexRef = useRef<number>(0);
  const callSequenceRef = useRef<number[]>([]);

  // states
  const [game, setGame] = useState<Game | null>(null);
  const [patterns, setPatterns] = useState<GamePattern[]>([]);
  const [allPatterns, setAllPatterns] = useState<GamePattern[]>([]);
  const [selectedWinningPattern, setSelectedWinningPattern] = useState<string>('Any 2 Lines');
  const [patternExamples, setPatternExamples] = useState<{ pattern: {row:number; col:number}[], name: string }[]>([]);
  const [currentPatternIndex, setCurrentPatternIndex] = useState(0);
  const patternIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>([]);
  const [currentCall, setCurrentCall] = useState<GameCall | null>(null);
  const [callSequence, setCallSequence] = useState<number[]>([]);
  const [callHistory, setCallHistory] = useState<GameCall[]>([]);
  const [callIndex, setCallIndex] = useState(0);
  const [gameStatus, setGameStatus] = useState<'setup' | 'active' | 'paused' | 'ended'>('setup');
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCalling, setIsCalling] = useState(false); // to prevent concurrent calls
  const [isReshuffling, setIsReshuffling] = useState(false);
  const [newCallAnimation, setNewCallAnimation] = useState(false);
  const [reshuffleAnimation, setReshuffleAnimation] = useState(false);

  // Winner announcement

  // MANUAL CARD CHECK MODAL state
  const [showManualCheckModal, setShowManualCheckModal] = useState(false);

  // keep refs in sync with state
  useEffect(() => { callIndexRef.current = callIndex; }, [callIndex]);
  useEffect(() => { callSequenceRef.current = callSequence; }, [callSequence]);
  useEffect(() => { callSequenceRef.current = callSequence; }, []); // init

  // fetch game on mount / gameId change
  useEffect(() => {
    if (gameId) fetchGame();
    return () => {
      // cleanup any intervals
      if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // when game object changes, fetch dependent things and set sequence
  useEffect(() => {
    if (!game) return;
    fetchPatterns();
    fetchCardTemplates();
    fetchAllPatterns();

    // prefer persisted sequence if present on DB; else generate locally (but don't overwrite DB yet)
    if (Array.isArray((game as any).call_sequence) && (game as any).call_sequence.length > 0) {
      setCallSequence((game as any).call_sequence as number[]);
    } else {
      const seq = generateCallSequence(game.number_range);
      setCallSequence(seq);
    }

    setGameStatus(game.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);
  

  // manage auto-caller start/stop based on gameStatus and mode
  useEffect(() => {
    // start automatic caller if active
    if (gameStatus === 'active' && game?.caller_mode === 'automatic' && !autoIntervalRef.current) {
      startAutomatic();
    } else if (gameStatus !== 'active' && autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }

    return () => {
      if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus, game]);

  // polling to keep callHistory in sync with DB (simple, reliable)
  useEffect(() => {
    if (!gameId) return;
    // always fetch once immediately
    fetchLatestCalls();

    // clear any previous poll
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    // poll while setup/active/paused — stop when ended
    if (gameStatus !== 'ended') {
      pollRef.current = setInterval(fetchLatestCalls, 1500);
    }

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, gameStatus]);

  const BallDisplay: React.FC<{ number?: number; letter?: string; label?: string; size?: 'sm' | 'lg'; animate?: boolean }> = ({ number, letter, label, size = 'sm', animate = false }) => {
    // Define colors for each letter
    const letterColors: Record<string, string> = {
      'B': 'from-red-500 to-red-600',
      'I': 'from-blue-500 to-blue-600',
      'N': 'from-yellow-500 to-yellow-600',
      'G': 'from-green-500 to-green-600',
      'O': 'from-purple-500 to-purple-600',
    };
  
    const gradientClass = letter ? letterColors[letter] || 'from-gray-500 to-gray-600' : 'from-gray-500 to-gray-600';
    
    const sizeClasses = size === 'lg' 
      ? 'w-24 h-24 text-4xl' 
      : 'w-16 h-16 text-2xl';

    const animationClasses = animate 
      ? 'animate-bounce transform scale-110 ring-4 ring-yellow-300 ring-opacity-75'
      : '';
  
    return (
      <div className="flex flex-col items-center">
        {label && <span className="text-sm font-medium text-gray-600 mb-1">{label}</span>}
        <div className={`${sizeClasses} rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-md transition-all duration-500 ${animationClasses}`}>
          <span className="font-bold text-white">
            {letter}{number}
          </span>
        </div>
      </div>
    );
  };

  const playReshuffleSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmHgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio errors
    }
  };

  const playNumberCallSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmHgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio errors
    }
  };

  const reshuffleSequence = async () => {
    if (!game || !gameId) return;
    
    setIsReshuffling(true);
    setReshuffleAnimation(true);
    
    // Play reshuffle sound
    playReshuffleSound();
    
    const newSequence = generateCallSequence(game.number_range);
    
    try {
      const { error } = await supabase
        .from('games')
        .update({ call_sequence: newSequence })
        .eq('id', gameId);

      if (error) throw error;

      setCallSequence(newSequence);
      callSequenceRef.current = newSequence;
      
      // Reset call history if game hasn't started yet
      if (gameStatus === 'setup') {
        await supabase.from('game_calls').delete().eq('game_id', gameId);
        setCallHistory([]);
        setCallIndex(0);
        callIndexRef.current = 0;
        setCurrentCall(null);
      }
      
      // Show animation for 2 seconds
      setTimeout(() => {
        setReshuffleAnimation(false);
      }, 2000);
      
    } catch (err) {
      console.error('Error reshuffling sequence:', err);
    } finally {
      setIsReshuffling(false);
    }
  };

  /* -------------------------
     -- Fetching helpers
     ------------------------- */

  const fetchGame = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) throw error;
      setGame(data);

      // Fetch existing call history in order
      const { data: calls, error: callsError } = await supabase
        .from('game_calls')
        .select('*')
        .eq('game_id', gameId)
        .order('call_order', { ascending: true });

      if (callsError) throw callsError;
      setCallHistory(calls || []);
      setCallIndex((calls?.length) || 0);
      callIndexRef.current = (calls?.length) || 0;

      if (calls && calls.length > 0) {
        setCurrentCall(calls[calls.length - 1]);
      }
    } catch (err) {
      console.error('Error fetching game:', err);
      // navigate away if game missing
      navigate('/cashier/dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all patterns for selector (names and patterns)
  const fetchAllPatterns = async () => {
    try {
      const { data, error } = await supabase
        .from('game_patterns')
        .select('*')
        .order('is_default', { ascending: false });
      if (error) throw error;
      setAllPatterns(data || []);
      // initialize selection if not set
      if (data && data.length > 0) {
        const exists = data.some(p => p.name === selectedWinningPattern);
        if (!selectedWinningPattern || !exists) {
          setSelectedWinningPattern(data[0].name);
        }
      }
    } catch (err) {
      console.error('Error fetching all patterns:', err);
    }
  };

  const fetchPatterns = async () => {
    if (!game) return;
    try {
      const { data, error } = await supabase
        .from('game_patterns')
        .select('*')
        .in('id', game.patterns || []);

      if (error) throw error;
      setPatterns(data || []);
    } catch (err) {
      console.error('Error fetching patterns:', err);
    }
  };

  const fetchCardTemplates = async () => {
    if (!game) return;
    try {
      const { data, error } = await supabase
        .from('card_templates')
        .select('*')
        .in('id', game.selected_cards || []);

      if (error) throw error;
      setCardTemplates(data || []);
    } catch (err) {
      console.error('Error fetching card templates:', err);
    }
  };

  const fetchLatestCalls = async () => {
    if (!gameId) return;
    try {
      const { data, error } = await supabase
        .from('game_calls')
        .select('*')
        .eq('game_id', gameId)
        .order('call_order', { ascending: true });

      if (error) throw error;
      setCallHistory(data || []);
      const len = (data?.length) || 0;
      setCallIndex(len);
      callIndexRef.current = len;
      if (len > 0) {
        setCurrentCall((data as GameCall[])[len - 1]);
      } else {
        setCurrentCall(null);
      }
    } catch (err) {
      console.error('Error fetching latest calls', err);
    }
  };

  /* -------------------------
     -- Game controls
     ------------------------- */

  const startGame = async () => {
    if (!game || !gameId) return;

    // ensure there's a call sequence persisted in DB so reloads keep same order
    const sequenceToUse = (Array.isArray((game as any).call_sequence) && (game as any).call_sequence.length > 0)
      ? (game as any).call_sequence as number[]
      : (callSequence.length > 0 ? callSequence : generateCallSequence(game.number_range));

    try {
      const { error } = await supabase
        .from('games')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          call_sequence: sequenceToUse
        })
        .eq('id', gameId);

      if (error) throw error;

      setCallSequence(sequenceToUse);
      callSequenceRef.current = sequenceToUse;
      setGameStatus('active');
    } catch (err) {
      console.error('Error starting game:', err);
    }
  };

  const pauseGame = async () => {
    if (!gameId) return;
    try {
      const { error } = await supabase.from('games').update({ status: 'paused' }).eq('id', gameId);
      if (error) throw error;
      setGameStatus('paused');
    } catch (err) {
      console.error('Error pausing game:', err);
    }
  };

  const resumeGame = async () => {
    if (!gameId) return;
    try {
      const { error } = await supabase.from('games').update({ status: 'active' }).eq('id', gameId);
      if (error) throw error;
      setGameStatus('active');
    } catch (err) {
      console.error('Error resuming game:', err);
    }
  };

  const endGame = async () => {
    if (!gameId) return;
    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', gameId);

      if (error) throw error;
      setGameStatus('ended');
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    } catch (err) {
      console.error('Error ending game:', err);
    }
  };

  const restartGame = async () => {
    // local reset
    setCallSequence(generateCallSequence(game?.number_range || 75));
    callSequenceRef.current = callSequence;
    setCallHistory([]);
    setCallIndex(0);
    callIndexRef.current = 0;
    setCurrentCall(null);

    // clear calls in DB and reset game status and persisted sequence
    if (gameId) {
      try {
        await supabase.from('game_calls').delete().eq('game_id', gameId);
        await supabase.from('games').update({ status: 'setup', call_sequence: [] }).eq('id', gameId);
        setGameStatus('setup');
      } catch (err) {
        console.error('Error restarting game:', err);
      }
    }
  };

  /* -------------------------
     -- Caller / number logic
     ------------------------- */

  const startAutomatic = () => {
    if (!game || autoIntervalRef.current) return;

    // ensure we have a sequence
    if (callSequenceRef.current.length === 0) {
      const seq = generateCallSequence(game.number_range);
      setCallSequence(seq);
      callSequenceRef.current = seq;
      // optionally persist on DB when starting
    }

    autoIntervalRef.current = setInterval(() => {
      callNextNumber();
    }, (game.auto_interval_seconds || 3) * 1000);
  };

  const callNextNumber = async () => {
    if (!game || !gameId) return;
    if (isCalling) return; // prevent concurrent calls

    const seq = callSequenceRef.current;
    const idx = callIndexRef.current;

    if (!seq || idx >= seq.length) {
      // no more numbers
      return;
    }

    const number = seq[idx];
    const letter = getNumberLetter(number, game.number_range);

    setIsCalling(true);
    try {
      // Insert and return the created row from DB so we have server timestamps and id
      const { data, error } = await supabase
        .from('game_calls')
        .insert([{
          game_id: gameId!,
          number,
          letter,
          call_order: idx + 1
        }])
        .select('*')
        .single();

      if (error) throw error;

      const inserted = data as GameCall;

      // Update local state from the authoritative DB response
      setCallHistory(prev => {
        // avoid duplicates on repeated inserts/poll races
        if (prev.some(c => c.call_order === inserted.call_order)) return prev;
        return [...prev, inserted];
      });

      setCurrentCall(inserted);
      setCallIndex(prev => {
        const next = prev + 1;
        callIndexRef.current = next;
        return next;
      });

      // Play sound and show animation
      playNumberCallSound();
      setNewCallAnimation(true);
      setTimeout(() => setNewCallAnimation(false), 3000);
      
      // speak if enabled
      if (game.caller_voice_enabled) {
        speakNumber(number, letter, game.caller_voice_type);
      }

      // attempt to broadcast using channel (optional; won't break if no active listeners)
      try {
        const channel = supabase.channel(`game-${gameId}`);
        // sending is best-effort — it won't affect DB
        channel.send({
          type: 'broadcast',
          event: 'number_called',
          payload: inserted
        });
      } catch (e) {
        // ignore channel errors — polling will keep UI in sync
      }

    } catch (err) {
      console.error('Error calling number:', err);
    } finally {
      setIsCalling(false);
    }
  };

  // Winner announce helper from manual check
  const announceLocalWinner = () => {
    setShowWinnerAnimation(true);
    setTimeout(() => {
      setShowWinnerAnimation(false);
    }, 5000);
  };

  /* -------------------------
     -- Bingo board renderer (horizontal B I N G O header)
     ------------------------- */

  // memoized set if needed elsewhere
  // const calledSet = useMemo(() => new Set(callHistory.map(c => c.number)), [callHistory]);

  const renderBingoBoard = () => {
    if (!game) return null;
  
    const letters = ['B', 'I', 'N', 'G', 'O'];
    const rangeSize = Math.floor(game.number_range / 5);
    const calledSetLocal = new Set(callHistory.map(c => c.number));
    const lastCalledNumber = callHistory[callHistory.length - 1]?.number;
  
    const columns = letters.map((_, i) => {
      const min = i * rangeSize + 1;
      const max = i === 4 ? game.number_range : (i + 1) * rangeSize;
      const nums = [];
      for (let n = min; n <= max; n++) nums.push(n);
      return nums;
    });
  
    return (
      <div className="grid grid-cols-5 gap-6">
        {/* Left side (80%) - Bingo Board */}
        <div className="col-span-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="overflow-hidden">
            <table className="w-full border-none">
              <tbody>
                {letters.map((letter, rowIndex) => {
                  const columnNumbers = columns[rowIndex];
                  return (
                    <tr key={letter}>
                      {/* Letter cell - kept the gradient */}
                      <td className="w-12 h-12 text-center font-bold text-4xl text-white bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg">
                        {letter}
                      </td>
                      {/* Number cells */}
                      {columnNumbers.map((number) => {
                        const isCalled = calledSetLocal.has(number);
                        const isLastCalled = number === lastCalledNumber;
                        return (
                          <td
                            key={number}
                            className={`w-12 h-12 text-center align-middle text-4xl ${
                              isCalled
                                ? "font-bold text-black dark:text-white"
                                : "text-gray-400 dark:text-gray-500"
                            } ${
                              isLastCalled ? "animate-pulse" : ""
                            }`}
                            style={{ lineHeight: "4rem" }}
                          >
                            {number}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      
        {/* Right side (20%) - Pattern Preview */}
        <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col items-center justify-center">
          {/* Selector */}
          <div className="w-full mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Winning Pattern
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
              value={selectedWinningPattern}
              onChange={(e) => setSelectedWinningPattern(e.target.value)}
            >
              {allPatterns.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
  
          {/* Pattern Preview with BINGO headers and blue highlights */}
          <div className="w-full">
            <div className="grid grid-cols-5 gap-x-1 mb-1">
              {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                <div 
                  key={letter}
                  className="h-8 flex items-center justify-center font-bold text-white bg-gradient-to-br from-blue-600 to-blue-400 rounded-t-lg text-sm"
                >
                  {letter}
                </div>
              ))}
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedWinningPattern}-${currentPatternIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="grid grid-cols-5 gap-1 bg-gray-50 dark:bg-gray-700 p-1 rounded-b-lg">
                  {Array.from({ length: 25 }).map((_, index) => {
                    const row = Math.floor(index / 5);
                    const col = index % 5;
                    const isCenter = row === 2 && col === 2;
                    const current = patternExamples[currentPatternIndex];
                    const highlightSet = current ? new Set(current.pattern.map(pos => `${pos.row}-${pos.col}`)) : new Set();
                    const isHighlighted = highlightSet.has(`${row}-${col}`);
                    
                    return (
                      <div 
                        key={index}
                        className={`w-full aspect-square flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded relative ${
                          isCenter ? 'bg-gray-200 dark:bg-gray-600' : 'bg-white dark:bg-gray-800'
                        }`}
                      >
                        {isHighlighted && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 rounded"
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          />
                        )}
                        {isCenter && (
                          <div className="text-yellow-400 z-10">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              Showing pattern {currentPatternIndex + 1} of {patternExamples.length}
            </div>
          </div>
        </div>
      </div>
    );
  };
  /* -------------------------
     -- Pattern preview logic
     ------------------------- */
  // Regenerate examples when selection or list changes
  useEffect(() => {
    generatePatternExamples();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWinningPattern, allPatterns]);

  // Cycle through examples
  useEffect(() => {
    if (patternExamples.length === 0) return;
    if (patternIntervalRef.current) clearInterval(patternIntervalRef.current);
    patternIntervalRef.current = setInterval(() => {
      setCurrentPatternIndex(prev => (prev + 1) % patternExamples.length);
    }, 2000);
    return () => {
      if (patternIntervalRef.current) clearInterval(patternIntervalRef.current);
    };
  }, [patternExamples]);

  const generatePatternExamples = () => {
    const selected = allPatterns.find(p => p.name === selectedWinningPattern);
    const examples: { pattern: { row: number; col: number }[], name: string }[] = [];
  
    if (!selected) {
      setPatternExamples([]);
      setCurrentPatternIndex(0);
      return;
    }
  
    const pushLine = (cells: { row: number; col: number }[]) =>
      examples.push({ pattern: cells, name: selected.name });
  
    const diag1 = Array.from({ length: 5 }, (_, i) => ({ row: i, col: i }));
    const diag2 = Array.from({ length: 5 }, (_, i) => ({ row: i, col: 4 - i }));
  
    // ---------- 1 Line ----------
    if (selected.name.includes('1 Line')) {
      // Horizontal & Vertical
      for (let i = 0; i < 5; i++) {
        pushLine(Array.from({ length: 5 }, (_, col) => ({ row: i, col }))); // row
        pushLine(Array.from({ length: 5 }, (_, row) => ({ row, col: i }))); // column
      }
      // Diagonals
      pushLine([...diag1]);
      pushLine([...diag2]);
    }
  
    // ---------- 2 Line ----------
    else if (selected.name.includes('2 Line')) {
      // Horizontal + Horizontal
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          const pattern = [
            ...Array.from({ length: 5 }, (_, col) => ({ row: i, col })),
            ...Array.from({ length: 5 }, (_, col) => ({ row: j, col })),
          ];
          pushLine(pattern);
        }
      }
  
      // Vertical + Vertical
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          const pattern = [
            ...Array.from({ length: 5 }, (_, row) => ({ row, col: i })),
            ...Array.from({ length: 5 }, (_, row) => ({ row, col: j })),
          ];
          pushLine(pattern);
        }
      }
  
      // Horizontal + Vertical
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const pattern = [
            ...Array.from({ length: 5 }, (_, c) => ({ row, col: c })),
            ...Array.from({ length: 5 }, (_, r) => ({ row: r, col })),
          ];
          pushLine(pattern);
        }
      }
  
      // Horizontal + Diagonal
      for (let i = 0; i < 5; i++) {
        pushLine([...Array.from({ length: 5 }, (_, col) => ({ row: i, col })), ...diag1]);
        pushLine([...Array.from({ length: 5 }, (_, col) => ({ row: i, col })), ...diag2]);
      }
  
      // Vertical + Diagonal
      for (let i = 0; i < 5; i++) {
        pushLine([...Array.from({ length: 5 }, (_, row) => ({ row, col: i })), ...diag1]);
        pushLine([...Array.from({ length: 5 }, (_, row) => ({ row, col: i })), ...diag2]);
      }
  
      // Both diagonals
      pushLine([...diag1, ...diag2]);
    }
  
    // ---------- Full House ----------
    else if (selected.name.includes('Full House')) {
      const pattern: { row: number; col: number }[] = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) pattern.push({ row: r, col: c });
      }
      pushLine(pattern);
    }
  
    // ---------- Four Corners ----------
    else if (selected.name.includes('Four Corners')) {
      pushLine([
        { row: 0, col: 0 },
        { row: 0, col: 4 },
        { row: 4, col: 0 },
        { row: 4, col: 4 },
      ]);
    }
  
    // ---------- Cross Pattern ----------
    else if (selected.name.includes('Cross Pattern')) {
      const centerRow = Array.from({ length: 5 }, (_, c) => ({ row: 2, col: c }));
      const centerCol = Array.from({ length: 5 }, (_, r) => ({ row: r, col: 2 }));
      pushLine([...centerRow, ...centerCol]);
    }
  
    // ---------- Custom pattern (DB) ----------
    else if (Array.isArray((selected as any).pattern)) {
      const pat: boolean[][] = (selected as any).pattern;
      const cells: { row: number; col: number }[] = [];
      for (let r = 0; r < Math.min(5, pat.length); r++) {
        for (let c = 0; c < Math.min(5, pat[r].length); c++) {
          if (pat[r][c]) cells.push({ row: r, col: c });
        }
      }
      pushLine(cells);
    }
  
    setPatternExamples(examples);
    setCurrentPatternIndex(0);
  };
  
  
  /* -------------------------
     -- Render
     ------------------------- */

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!game) return <div>Game not found</div>;

  return (
    <div className="space-y-6 dark:text-white">
      {showWinnerAnimation && (
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 800}
          height={typeof window !== 'undefined' ? window.innerHeight : 600}
          numberOfPieces={250}
          recycle={false}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{game.title}</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Range: 1-{game.number_range} | Cards: {game.selected_cards.length} | 
              Bet: {game.betting_amount_birr} Birr
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {gameStatus === 'setup' && (
              <button
                onClick={startGame}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center space-x-2"
              >
                <Play size={20} />
                <span>Start Game</span>
              </button>
            )}
            
            {gameStatus === 'active' && (
              <>
                <button
                  onClick={pauseGame}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 flex items-center space-x-2"
                >
                  <Pause size={20} />
                  <span>Pause</span>
                </button>
                
                {game.caller_mode === 'manual' && (
                  <button
                    onClick={callNextNumber}
                    disabled={callIndex >= callSequence.length || isCalling}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCalling ? 'Calling…' : `Call Next (${callIndex + 1})`}
                  </button>
                )}
              </>
            )}
            
            {gameStatus === 'paused' && (
              <button
                onClick={resumeGame}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center space-x-2"
              >
                <Play size={20} />
                <span>Resume</span>
              </button>
            )}
            
            <button
              onClick={restartGame}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center space-x-2"
            >
              <RotateCcw size={20} />
              <span>Restart</span>
            </button>
            
            <button
              onClick={endGame}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center space-x-2"
            >
              <Square size={20} />
              <span>End Game</span>
            </button>
            
            <button
              onClick={reshuffleSequence}
              className={`bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center space-x-2 transition-all duration-300 ${
                reshuffleAnimation ? 'animate-pulse bg-purple-600' : ''
              }`}
              disabled={gameStatus !== 'setup' || isReshuffling}
              title={gameStatus !== 'setup' ? "Can only reshuffle before game starts" : ""}
            >
              <RotateCcw size={20} className={isReshuffling ? 'animate-spin' : ''} />
              <span>{isReshuffling ? 'Reshuffling...' : 'Reshuffle'}</span>
              {reshuffleAnimation && <Volume2 size={16} className="animate-bounce" />}
            </button>

            {/* Check Card button: only works when paused or ended */}
            <button
              onClick={() => {
                if (gameStatus === 'paused' || gameStatus === 'ended') {
                  setShowManualCheckModal(true);
                } else {
                  alert('Pause or end the game to check cards.');
                }
              }}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                (gameStatus === 'paused' || gameStatus === 'ended')
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title="Check a card against the current game rule"
              disabled={!(gameStatus === 'paused' || gameStatus === 'ended')}
            >
              <Eye size={20} />
              <span>Check Card</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Bingo Board - full width */}
        <div>
          {renderBingoBoard()}
        </div>

        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-all duration-500 ${
          reshuffleAnimation ? 'ring-4 ring-purple-300 ring-opacity-50' : ''
        }`}>
          <div className="flex gap-6">
            {/* Current Call (25% width) */}
            <div className="flex flex-col items-center w-1/4">
              <h3 className="text-lg font-semibold mb-4 dark:text-white">CURRENT CALL</h3>
              {currentCall ? (
                <BallDisplay 
                  number={currentCall.number} 
                  letter={currentCall.letter} 
                  size="lg"
                  animate={newCallAnimation}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-2xl">--</span>
                </div>
              )}
            </div>

            {/* Previous Calls (50% width) */}
            <div className="flex flex-col items-center w-2/4">
              <h3 className="text-lg font-semibold mb-4 dark:text-white">PREVIOUS 5 CALLS</h3>
              <div className="flex flex-wrap justify-center gap-2">
                {callHistory.length > 0 ? (
                  callHistory
                    .slice(-5)
                    .reverse()
                    .map((call, i) => (
                      <BallDisplay key={i} number={call.number} letter={call.letter} />
                    ))
                ) : (
                  Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"
                      >
                        <span className="text-gray-400">--</span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Right Info Panel (25% width) */}
            <div className="flex flex-col justify-center w-1/4">
              {(() => {
                const playerNumber = game.selected_cards?.length || 0;
                const totalBetAmount = playerNumber * (game.betting_amount_birr || 0);
                const profit = totalBetAmount * commissionRate;
                const winningAmount = Math.max(0, totalBetAmount - profit);
                return (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 h-full flex flex-col justify-center">
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Winning Amount</div>
                      <div className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white">{winningAmount} Birr</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Calls</div>
                      <div className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white">{callIndex}/{callSequence.length}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

      </div>

      {/* Game Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Game Status</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            gameStatus === 'active' ? 'bg-green-100 text-green-800' :
            gameStatus === 'paused' ? 'bg-yellow-100 text-yellow-800' :
            gameStatus === 'ended' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {gameStatus.charAt(0).toUpperCase() + gameStatus.slice(1)}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Progress</h3>
          <div className="flex items-center space-x-3">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(callIndex / Math.max(callSequence.length, 1)) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium">
              {callIndex}/{callSequence.length}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Duration</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {game.started_at ? 
              Math.floor((new Date().getTime() - new Date(game.started_at).getTime()) / 60000) : 0
            }m
          </p>
        </div>
      </div>

      {/* (Removed old Claim modal) */}

      {/* Manual Card Check Modal */}
      <BingoCheckModal
        isOpen={showManualCheckModal}
        onClose={() => setShowManualCheckModal(false)}
        gameId={gameId!}
        patterns={patterns}
        cards={cardTemplates}
        gameStatus={gameStatus}
        calledNumbers={callHistory.map(c => c.number)}
        onAnnounce={() => announceLocalWinner()}
      />
    </div>
  );
};

export default GameHost;
