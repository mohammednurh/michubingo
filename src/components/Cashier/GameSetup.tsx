import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Play, Settings, Volume2, VolumeX, AlertTriangle, X } from 'lucide-react';
import { supabase, GamePattern, CardTemplate } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import announcementAudio from '../../assets/audio/type 1.m4a';
import { useSettings } from '../../contexts/SettingsContext';

const GameSetup: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { commissionRate, minBettingAmount } = useSettings();
  
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [patterns, setPatterns] = useState<GamePattern[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  const [gameSettings, setGameSettings] = useState({
    title: '',
    numberRange: 75,
    callerMode: 'automatic' as 'manual' | 'automatic',
    autoInterval: 5,
    callerVoiceEnabled: true,
    callerVoiceType: 'female',
    bettingAmount: 10,
    lastCallsDisplay: 5,
    winningPattern: 'any_2_line',
  });

  // Pattern preview states
  const [currentPatternIndex, setCurrentPatternIndex] = useState(0);
  const [patternExamples, setPatternExamples] = useState<{ pattern: any[], name: string }[]>([]);
  const patternIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Modal state
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const modalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Announcement audio
  const announcementRef = useRef<HTMLAudioElement | null>(null);

  // Play announcement audio bundled with the app
  const playAnnouncement = async () => {
    try {
      if (!announcementRef.current) return;
      const audio = announcementRef.current;
      audio.currentTime = 0;
      await audio.play();
    } catch (err) {
      console.error('Failed to play announcement audio:', err);
      setModalMessage('Unable to play announcement. Please interact with the page and try again.');
      setModalType('error');
      if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
      modalTimeoutRef.current = setTimeout(() => setModalMessage(''), 2500);
    }
  };

  // Input state for selecting a specific card
  const [cardInput, setCardInput] = useState('');

  // Balance and profit (to enforce minimum available balance)
  const [balance, setBalance] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState(0);
  const displayedBalance = balance !== null ? balance - totalProfit : null;
  const MIN_PROFIT = commissionRate * (1 * minBettingAmount);

  // Notification overlay state
  const [insufficientNotif, setInsufficientNotif] = useState<{ visible: boolean; message: string }>(
    { visible: false, message: '' }
  );
  const insuffTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchPatterns();
    fetchCardTemplates();
    // Fetch balance for cashier
    // Prepare announcement audio
    announcementRef.current = new Audio(announcementAudio);
    announcementRef.current.preload = 'auto';
    const fetchBalance = async () => {
      if (!userProfile?.id || userProfile.role !== 'cashier') return;
      const { data, error } = await supabase
        .from('users')
        .select('subscription_price_birr')
        .eq('id', userProfile.id)
        .single();
      if (!error) setBalance(data?.subscription_price_birr ?? 0);
    };

  

    const fetchProfit = async () => {
      if (!userProfile?.id || userProfile.role !== 'cashier') return;
      const { data: games, error } = await supabase
        .from('games')
        .select('selected_cards, betting_amount_birr')
        .eq('host_id', userProfile.id)
        .in('status', ['active', 'paused', 'ended']);
      if (error) return;
      const profit = (games || []).reduce((sum, game) => {
        const playerNumber = game.selected_cards?.length || 0;
        const betAmount = game.betting_amount_birr || 0;
        return sum + playerNumber * betAmount * commissionRate;
      }, 0);
      setTotalProfit(profit);
    };
    fetchBalance();
    fetchProfit();
    return () => {
      if (patternIntervalRef.current) clearInterval(patternIntervalRef.current);
      if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
      if (insuffTimerRef.current) clearTimeout(insuffTimerRef.current);
      if (announcementRef.current) {
        announcementRef.current.pause();
        announcementRef.current.currentTime = 0;
      }
    };
  }, [commissionRate, minBettingAmount]);

  // Generate pattern examples when selected patterns change
  useEffect(() => {
    if (patterns.length > 0 && selectedPatterns.length > 0) {
      generatePatternExamples();
    } else {
      setPatternExamples([]);
      setCurrentPatternIndex(0);
    }
  }, [selectedPatterns, patterns, gameSettings.winningPattern]);

  // Set up interval for cycling through pattern examples
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

  const fetchPatterns = async () => {
    try {
      const { data, error } = await supabase
        .from('game_patterns')
        .select('*')
        .order('is_default', { ascending: false });
      if (error) throw error;

      setPatterns(data || []);
      const defaultPatterns = data?.filter(p => p.is_default).map(p => p.id) || [];
      setSelectedPatterns(defaultPatterns);
    } catch (error) {
      console.error('Error fetching patterns:', error);
    }
  };

  const fetchCardTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('card_templates')
        .select('*')
        .order('id');
      if (error) throw error;
      setCardTemplates(data || []);
    } catch (error) {
      console.error('Error fetching card templates:', error);
    }
  };

  const generatePatternExamples = () => {
    const examples: { pattern: any[], name: string }[] = [];

    // Get the currently selected winning pattern
    let currentPattern: GamePattern | undefined;
    
    if (gameSettings.winningPattern === 'any_2_line') {
      // Default "Any 2 Lines" pattern
      currentPattern = patterns.find(p => p.name === 'Any 2 Lines');
    } else {
      // Find the specific pattern by ID
      currentPattern = patterns.find(p => p.id === gameSettings.winningPattern);
    }

        if (!currentPattern) return;

    const examplePatterns: any[] = [];

    if (currentPattern.name.includes("2 Line")) {
      // Horizontal lines
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          const pattern = [];
          for (let col = 0; col < 5; col++) pattern.push({ row: i, col });
          for (let col = 0; col < 5; col++) pattern.push({ row: j, col });
          examplePatterns.push(pattern);
        }
      }
      // Vertical lines
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          const pattern = [];
          for (let row = 0; row < 5; row++) pattern.push({ row, col: i });
          for (let row = 0; row < 5; row++) pattern.push({ row, col: j });
          examplePatterns.push(pattern);
        }
      }
      // Diagonals
      const diag1 = Array.from({ length: 5 }, (_, i) => ({ row: i, col: i }));
      const diag2 = Array.from({ length: 5 }, (_, i) => ({ row: i, col: 4 - i }));
      // Horizontal + Diagonal
      for (let i = 0; i < 5; i++) {
        examplePatterns.push([...Array.from({ length: 5 }, (_, col) => ({ row: i, col })), ...diag1]);
        examplePatterns.push([...Array.from({ length: 5 }, (_, col) => ({ row: i, col })), ...diag2]);
      }
      // Vertical + Diagonal
      for (let i = 0; i < 5; i++) {
        examplePatterns.push([...Array.from({ length: 5 }, (_, row) => ({ row, col: i })), ...diag1]);
        examplePatterns.push([...Array.from({ length: 5 }, (_, row) => ({ row, col: i })), ...diag2]);
      }
      // Both diagonals
      examplePatterns.push([...diag1, ...diag2]);
    } else if (currentPattern.name.includes("1 Line")) {
      for (let i = 0; i < 5; i++) {
        examplePatterns.push(Array.from({ length: 5 }, (_, col) => ({ row: i, col })));
        examplePatterns.push(Array.from({ length: 5 }, (_, row) => ({ row, col: i })));
      }
      examplePatterns.push(Array.from({ length: 5 }, (_, i) => ({ row: i, col: i })));
      examplePatterns.push(Array.from({ length: 5 }, (_, i) => ({ row: i, col: 4 - i })));
    } else {
      // Custom patterns
      const pattern = [];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (currentPattern.pattern[row][col]) pattern.push({ row, col });
        }
      }
      examplePatterns.push(pattern);
    }

    examplePatterns.forEach(p => examples.push({ pattern: p, name: currentPattern.name }));

    setPatternExamples(examples);
    setCurrentPatternIndex(0);
  };

  const handleCardSelection = (cardId: number, showConfirmation: boolean = false) => {
    if (selectedCards.includes(cardId)) {
      // Deselect the card
      setSelectedCards(prev => prev.filter(id => id !== cardId));
      if (showConfirmation) {
        setModalMessage(`Card #${cardId} deselected`);
        setModalType('success');
        if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
        modalTimeoutRef.current = setTimeout(() => setModalMessage(''), 2000);
      }
    } else {
      // Select the card
      setSelectedCards(prev => [...prev, cardId]);
      if (showConfirmation) {
        setModalMessage(`Card #${cardId} selected successfully`);
        setModalType('success');
        if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
        modalTimeoutRef.current = setTimeout(() => setModalMessage(''), 2000);
      }
    }
  };

  const handleSelectRange = (start: number, end: number) => {
    const availableCards = cardTemplates.slice(start - 1, end).map(card => card.id);
    availableCards.forEach(cardId => handleCardSelection(cardId, false));
  };

  const handleCardInput = () => {
    const num = parseInt(cardInput);
    if (!num || !cardTemplates.find(c => c.id === num)) {
      setModalMessage(`Invalid card number`);
      setModalType('error');
      if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
      modalTimeoutRef.current = setTimeout(() => setModalMessage(''), 2000);
    } else {
      handleCardSelection(num, true); // Show confirmation for manually entered cards
    }
    setCardInput('');
  };

  const handleCardInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCardInput();
  };

  const createGame = async () => {
    if (!userProfile || selectedCards.length === 0 || selectedPatterns.length === 0) {
      alert('Please select cards and patterns before creating the game');
      return;
    }

    // Enforce minimum betting amount (from settings)
    if (gameSettings.bettingAmount < minBettingAmount) {
      alert(`Betting amount must be at least ${minBettingAmount} Birr.`);
      return;
    }

    // Enforce minimum available balance for cashier before creating a game
    if (userProfile.role === 'cashier') {
      if (displayedBalance === null || displayedBalance <= MIN_PROFIT) {
        // Show centered big notification
        setInsufficientNotif({
          visible: true,
          message:
            'Oops! You have insufficient balance. To start a game, please buy a new subscription.',
        });
        if (insuffTimerRef.current) clearTimeout(insuffTimerRef.current);
        insuffTimerRef.current = setTimeout(() => {
          setInsufficientNotif({ visible: false, message: '' });
        }, 5000);
        return;
      }
    }

    setIsCreating(true);

    try {
      const { data, error } = await supabase
        .from('games')
        .insert([{
          host_id: userProfile.id,
          title: gameSettings.title || `Game by ${userProfile.username}`,
          number_range: gameSettings.numberRange,
          selected_cards: selectedCards,
          patterns: selectedPatterns,
          betting_amount_birr: gameSettings.bettingAmount,
          caller_mode: gameSettings.callerMode,
          auto_interval_seconds: gameSettings.autoInterval,
          caller_voice_enabled: gameSettings.callerVoiceEnabled,
          caller_voice_type: gameSettings.callerVoiceType,
          last_calls_display: gameSettings.lastCallsDisplay,
          status: 'setup'
        }])
        .select()
        .single();

      if (error) throw error;
      navigate(`/cashier/game/${data.id}`);
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const PatternPreview = () => {
    if (patternExamples.length === 0) return null;

    const current = patternExamples[currentPatternIndex];
    const patternSet = new Set(current.pattern.map(pos => `${pos.row}-${pos.col}`));

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">
          Pattern Preview: <span className="text-blue-600 dark:text-blue-400">{current.name}</span>
        </h3>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPatternIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            {/* BINGO Column Headers - Perfectly aligned */}
            <div className="grid grid-cols-5 gap-x-1 w-[calc(5*2rem+4*0.25rem)] mb-1"> {/* Exact same width as grid below */}
              {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                <div 
                  key={letter}
                  className="h-8 flex items-center justify-center font-bold text-white bg-gradient-to-br from-blue-600 to-blue-400 rounded-t-lg text-sm"
                >
                  {letter}
                </div>
              ))}
            </div>

            {/* Pattern Grid - Exact column alignment */}
            <div className="grid grid-cols-5 gap-1 bg-gray-50 dark:bg-gray-700 p-1 rounded-b-lg w-[calc(5*2rem+4*0.25rem)]"> {/* Fixed width matching headers */}
              {Array.from({ length: 25 }).map((_, index) => {
                const row = Math.floor(index / 5);
                const col = index % 5;
                const isCenter = row === 2 && col === 2;
                const isHighlighted = patternSet.has(`${row}-${col}`);
                
                return (
                  <div 
                    key={index}
                    className={`w-8 h-8 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded relative ${
                      isCenter ? 'bg-gray-200 dark:bg-gray-600' : 'bg-white dark:bg-gray-800'
                    }`}
                  >
                    {isHighlighted && (
                      <motion.div
                        className="absolute inset-0 bg-green-400 dark:bg-green-500 rounded"
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

        <div className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
          Showing pattern {currentPatternIndex + 1} of {patternExamples.length}
        </div>
      </div>
    );
};


  return (
    <div className="space-y-6 relative dark:text-white">
      {/* Insufficient Balance Overlay */}
      <AnimatePresence>
        {insufficientNotif.visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-2 border-red-300"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-full bg-red-100">
                      <AlertTriangle className="text-red-600" size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-red-700">Insufficient Balance</h3>
                      <p className="mt-2 text-gray-700 dark:text-gray-300 text-base">
                        {insufficientNotif.message}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setInsufficientNotif({ visible: false, message: '' })}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                    aria-label="Close notification"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Modal */}
      <AnimatePresence>
        {modalMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`fixed top-5 right-5 z-50 px-4 py-2 rounded shadow-lg text-white ${
              modalType === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {modalMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Game</h1>
        <button
          onClick={createGame}
          disabled={isCreating || selectedCards.length === 0 || selectedPatterns.length === 0}
          className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Play size={20} />
          <span>{isCreating ? 'Creating...' : 'Create Game'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-6 flex flex-col">
          {/* Card Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 space-y-2 md:space-y-0">
                              <h2 className="text-lg font-semibold dark:text-white">Select Cards ({selectedCards.length} selected)</h2>
              <div className="flex flex-wrap space-x-2 items-center">
                <button onClick={() => handleSelectRange(1, 10)} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Select 1-10</button>
                <button onClick={() => handleSelectRange(1, 30)} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Select 1-30</button>
                <input
                  type="number"
                  placeholder="Card #"
                  value={cardInput}
                  onChange={(e) => setCardInput(e.target.value)}
                  onKeyDown={handleCardInputKey}
                  className="w-20 px-2 py-1 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
                <button
                  onClick={handleCardInput}
                  className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                >
                  Select
                </button>
                <button onClick={() => setSelectedCards([])} className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Clear All</button>
              </div>
            </div>

            <div className="grid grid-cols-10 gap-2 max-h-full overflow-y-auto">
              {cardTemplates.map(card => (
                <button
                  key={card.id}
                  onClick={() => handleCardSelection(card.id, false)} // No confirmation for clicked cards
                  className={`p-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedCards.includes(card.id) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {card.id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 dark:shadow-lg dark:shadow-gray-900/30">
          <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2 dark:text-white">
            <Settings size={20} />
            <span>Game Settings</span>
          </h2>

          {/* Winning Pattern */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Winning Pattern</label>
            <select
              value={gameSettings.winningPattern}
              onChange={(e) =>
                setGameSettings(prev => ({ ...prev, winningPattern: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="any_2_line">Any 2 Line (Default)</option>
              {patterns.map(pattern => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pattern Preview */}
          <PatternPreview />

          {/* Other Settings */}
          <div className="space-y-4">
            {/* Number Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Number Range</label>
              <select
                value={gameSettings.numberRange}
                onChange={(e) => setGameSettings(prev => ({ ...prev, numberRange: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value={75}>1-75 (Default)</option>
                <option value={90}>1-90</option>
                <option value={100}>1-100</option>
                <option value={200}>1-200</option>
              </select>
            </div>

            {/* Caller Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Caller Mode</label>
              <select
                value={gameSettings.callerMode}
                onChange={(e) => setGameSettings(prev => ({ ...prev, callerMode: e.target.value as 'manual' | 'automatic' }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="manual">Manual</option>
                <option value="automatic">Automatic (Default)</option>
              </select>
            </div>

            {/* Auto Interval */}
            {gameSettings.callerMode === 'automatic' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Auto Speed (seconds)</label>
                <select
                  value={gameSettings.autoInterval}
                  onChange={(e) => setGameSettings(prev => ({ ...prev, autoInterval: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value={2}>2 seconds</option>
                  <option value={3}>3 seconds</option>
                  <option value={4}>4 seconds</option>
                  <option value={5}>5 seconds</option>
                </select>
              </div>
            )}

            {/* Caller Voice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Caller Voice</label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setGameSettings(prev => ({ ...prev, callerVoiceEnabled: !prev.callerVoiceEnabled }))}
                  className="p-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
                >
                  {gameSettings.callerVoiceEnabled ? 
                    <Volume2 size={18} className="text-gray-800 dark:text-gray-200" /> : 
                    <VolumeX size={18} className="text-gray-800 dark:text-gray-200" />}
                </button>
                <select
                  value={gameSettings.callerVoiceType}
                  onChange={(e) => setGameSettings(prev => ({ ...prev, callerVoiceType: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
            </div>

            {/* Announcement */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Announcement</label>
              <button
                type="button"
                onClick={playAnnouncement}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-800"
              >
                Play Announcement
              </button>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Plays the announcement audio bundled in the app.</p>
            </div>

            {/* Betting Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Betting Amount (Birr)</label>
              <input
                type="number"
                value={gameSettings.bettingAmount}
                min={minBettingAmount}
                step={1}
                onChange={(e) => {
                  const raw = parseInt(e.target.value || '0');
                  const base = isNaN(minBettingAmount) ? 10 : minBettingAmount;
                  const val = Math.max(base, isNaN(raw) ? base : raw);
                  setGameSettings(prev => ({ ...prev, bettingAmount: val }));
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Minimum: {minBettingAmount} Birr</p>
            </div>

            {/* Last Calls Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Calls Display</label>
              <input
                type="number"
                value={gameSettings.lastCallsDisplay}
                onChange={(e) => setGameSettings(prev => ({ ...prev, lastCallsDisplay: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameSetup;
