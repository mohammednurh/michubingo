import React, { useState, useEffect } from 'react';
import { X, Check, Lock, Unlock, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { supabase, GamePattern, CardTemplate, BingoClaim } from '../../lib/supabase';

interface BingoCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  patterns: GamePattern[];
  cards: CardTemplate[];
  gameStatus: string;
  calledNumbers: number[];
  onAnnounce: () => void;
}

interface PatternCheckResult {
  pattern: GamePattern;
  isWinning: boolean;
  matchedPositions: [number, number][];
}

const BingoCheckModal: React.FC<BingoCheckModalProps> = ({
  isOpen,
  onClose,
  gameId,
  patterns,
  cards,
  gameStatus,
  calledNumbers,
  onAnnounce
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [selectedCard, setSelectedCard] = useState<CardTemplate | null>(null);
  const [checkResults, setCheckResults] = useState<PatternCheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [hasWinningPattern, setHasWinningPattern] = useState(false);
  const [existingClaim, setExistingClaim] = useState<BingoClaim | null>(null);
  const [markedNumbers, setMarkedNumbers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [winningPattern, setWinningPattern] = useState<PatternCheckResult | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [noWinMessage, setNoWinMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCardNumber('');
      setSelectedCard(null);
      setCheckResults([]);
      setHasWinningPattern(false);
      setExistingClaim(null);
      setMarkedNumbers([]);
      setError(null);
      setWinningPattern(null);
      setNotification(null);
      setLockedMessage(null);
      setNoWinMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (notification) {
      timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [notification]);

  const playSound = (message: string) => {
    if ('speechSynthesis' in window) {
      const speech = new SpeechSynthesisUtterance(message);
      speech.volume = 1;
      speech.rate = 1;
      speech.pitch = 1;
      window.speechSynthesis.speak(speech);
    }
  };

  const handleCheck = async () => {
    if (!cardNumber.trim()) {
      setError('Please enter a card number');
      return;
    }
    
    setIsChecking(true);
    setError(null);
    setWinningPattern(null);
    setNotification(null);
    setLockedMessage(null);
    setNoWinMessage(null);
    
    try {
      const cardId = parseInt(cardNumber);
      const card = cards.find(c => c.id === cardId);
      
      if (!card) {
        const notFoundMsg = `Card number ${cardNumber} was not found in this game. Please check the card number and try again.`;
        setNotification({
          type: 'error',
          message: notFoundMsg
        });
        playSound(`Card number ${cardNumber} not found. Please check the number and try again.`);
        setIsChecking(false);
        return;
      }
      
      setSelectedCard(card);
      
      // Check for existing claim
      const { data, error: claimError } = await supabase
        .from('bingo_claims')
        .select('*')
        .eq('game_id', gameId)
        .eq('card_id', cardId)
        .order('claim_timestamp', { ascending: false })
        .limit(1);
      
      if (claimError) throw claimError;
      
      if (data && data.length > 0) {
        setExistingClaim(data[0]);
        
        // Show locked card message
        if (data[0].validation_result === 'invalid') {
          const lockedMsg = `Card ${cardNumber} has been permanently locked and cannot be used for further claims in this game.`;
          setLockedMessage(lockedMsg);
          playSound(`Card ${cardNumber} is already locked and cannot be used.`);
          setTimeout(() => setLockedMessage(null), 5000);
        } else {
          playSound(`Card ${cardNumber} already has a claim registered. Please wait for verification.`);
        }
        
        setIsChecking(false);
        return;
      }
      
      // Check patterns
      const results = await checkAllPatterns(card, calledNumbers);
      setCheckResults(results);
      
      const winningResults = results.filter(r => r.isWinning);
      const hasWin = winningResults.length > 0;
      setHasWinningPattern(hasWin);
      
      if (hasWin) {
        const winningResult = winningResults[0];
        setWinningPattern(winningResult);
        const winMsg = `Congratulations! Card number ${card.id} has won the game with the ${winningResult.pattern.name} pattern!`;
        playSound(winMsg);
        await saveWinningClaim(winningResult);
      } else {
        // Show no winning pattern message
        const noWinMsg = `No winning pattern found for card ${card.id}. Keep playing - you need ${75 - calledNumbers.length} more numbers to complete a blackout!`;
        setNoWinMessage(noWinMsg);
        playSound(`Sorry, card number ${card.id} has not won the game yet. Keep playing!`);
      }
      
      // Calculate marked numbers
      const cardNumbers = card.numbers.flat().filter(n => n !== 0);
      const marked = cardNumbers.filter(n => calledNumbers.includes(n));
      setMarkedNumbers(marked);
      
    } catch (err) {
      console.error('Error checking card:', err);
      const errorMsg = 'Error checking card. Please try again.';
      setNotification({
        type: 'error',
        message: errorMsg
      });
      playSound('Error verifying card. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const checkAllPatterns = async (card: CardTemplate, called: number[]): Promise<PatternCheckResult[]> => {
    const results: PatternCheckResult[] = [];
    
    for (const pattern of patterns) {
      const result = checkPattern(card, called, pattern);
      results.push(result);
    }
    
    return results;
  };

  const checkPattern = (card: CardTemplate, called: number[], pattern: GamePattern): PatternCheckResult => {
    const cardGrid = card.numbers;
    const matchedPositions: [number, number][] = [];
    
    if (pattern.name === 'Any 2 Lines') {
      return checkAnyTwoLines(card, called, pattern);
    }
    
    let requiredMatches = 0;
    let actualMatches = 0;
    
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (pattern.pattern[row][col]) {
          requiredMatches++;
          const cardNumber = cardGrid[row][col];
          
          if (row === 2 && col === 2 && cardNumber === 0) {
            actualMatches++;
            matchedPositions.push([row, col]);
          } else if (called.includes(cardNumber)) {
            actualMatches++;
            matchedPositions.push([row, col]);
          }
        }
      }
    }
    
    return {
      pattern,
      isWinning: actualMatches === requiredMatches,
      matchedPositions
    };
  };

  const checkAnyTwoLines = (card: CardTemplate, called: number[], pattern: GamePattern): PatternCheckResult => {
    const cardGrid = card.numbers;
    const lines: { type: string; positions: [number, number][] }[] = [];
    
    // Horizontal lines
    for (let row = 0; row < 5; row++) {
      const positions: [number, number][] = [];
      let isComplete = true;
      
      for (let col = 0; col < 5; col++) {
        const cardNumber = cardGrid[row][col];
        if (row === 2 && col === 2 && cardNumber === 0) {
          positions.push([row, col]);
        } else if (called.includes(cardNumber)) {
          positions.push([row, col]);
        } else {
          isComplete = false;
          break;
        }
      }
      
      if (isComplete) lines.push({ type: `horizontal-${row}`, positions });
    }
    
    // Vertical lines
    for (let col = 0; col < 5; col++) {
      const positions: [number, number][] = [];
      let isComplete = true;
      
      for (let row = 0; row < 5; row++) {
        const cardNumber = cardGrid[row][col];
        if (row === 2 && col === 2 && cardNumber === 0) {
          positions.push([row, col]);
        } else if (called.includes(cardNumber)) {
          positions.push([row, col]);
        } else {
          isComplete = false;
          break;
        }
      }
      
      if (isComplete) lines.push({ type: `vertical-${col}`, positions });
    }
    
    // Diagonal 1 (top-left to bottom-right)
    let positions: [number, number][] = [];
    let isComplete = true;
    for (let i = 0; i < 5; i++) {
      const cardNumber = cardGrid[i][i];
      if (i === 2 && cardNumber === 0) {
        positions.push([i, i]);
      } else if (called.includes(cardNumber)) {
        positions.push([i, i]);
      } else {
        isComplete = false;
        break;
      }
    }
    if (isComplete) lines.push({ type: 'diagonal-1', positions });
    
    // Diagonal 2 (top-right to bottom-left)
    positions = [];
    isComplete = true;
    for (let i = 0; i < 5; i++) {
      const cardNumber = cardGrid[i][4 - i];
      if (i === 2 && cardNumber === 0) {
        positions.push([i, 4 - i]);
      } else if (called.includes(cardNumber)) {
        positions.push([i, 4 - i]);
      } else {
        isComplete = false;
        break;
      }
    }
    if (isComplete) lines.push({ type: 'diagonal-2', positions });
    
    const isWinning = lines.length >= 2;
    const allMatchedPositions = lines.slice(0, 2).flatMap(line => line.positions);
    
    return {
      pattern,
      isWinning,
      matchedPositions: isWinning ? allMatchedPositions : []
    };
  };

  const lockCard = async () => {
    if (!selectedCard) return;

    setIsLocking(true);
    try {
      const { error } = await supabase
        .from('bingo_claims')
        .insert([{
          game_id: gameId,
          card_id: selectedCard.id,
          pattern_id: patterns[0].id, // Use first pattern as placeholder
          marked_numbers: markedNumbers,
          validation_result: 'invalid'
        }]);

      if (error) throw error;

      setExistingClaim({
        id: 'temp',
        game_id: gameId,
        card_id: selectedCard.id,
        pattern_id: patterns[0].id,
        marked_numbers: markedNumbers,
        claim_timestamp: new Date().toISOString(),
        validation_result: 'invalid'
      });
      
      const lockMsg = `Card ${selectedCard.id} has been successfully locked and cannot be used for further claims.`;
      setNotification({
        type: 'success',
        message: lockMsg
      });
      playSound(`Card ${selectedCard.id} locked successfully.`);
      
      // Clear no win message
      setNoWinMessage(null);
    } catch (err) {
      console.error('Error locking card:', err);
      setNotification({
        type: 'error',
        message: 'Error locking card. Please try again.'
      });
      playSound('Error locking card. Please try again.');
    } finally {
      setIsLocking(false);
    }
  };

  const saveWinningClaim = async (winningResult: PatternCheckResult) => {
    if (!selectedCard) return;

    try {
      const { error } = await supabase
        .from('bingo_claims')
        .insert([{
          game_id: gameId,
          card_id: selectedCard.id,
          pattern_id: winningResult.pattern.id,
          marked_numbers: markedNumbers,
          validation_result: 'valid'
        }]);

      if (error) throw error;

      setExistingClaim({
        id: 'temp',
        game_id: gameId,
        card_id: selectedCard.id,
        pattern_id: winningResult.pattern.id,
        marked_numbers: markedNumbers,
        claim_timestamp: new Date().toISOString(),
        validation_result: 'valid'
      });
      
      onAnnounce();
    } catch (err) {
      console.error('Error saving winning claim:', err);
      setNotification({
        type: 'error',
        message: 'Error saving winning claim. Please try again.'
      });
      playSound('Error saving winning claim. Please try again.');
    }
  };

  const renderCard = () => {
    if (!selectedCard) return null;

    return (
      <div className="mt-6 w-full">
        {/* Locked card message */}
        {lockedMessage && (
          <div className="mb-4 animate-fade-in">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 dark:border-yellow-600 p-4 flex justify-between items-center">
              <div className="flex items-center">
                <AlertCircle className="text-yellow-700 dark:text-yellow-400 mr-3" size={24} />
                <span className="text-yellow-700 dark:text-yellow-300 font-bold text-lg">{lockedMessage}</span>
              </div>
              <button 
                onClick={() => setLockedMessage(null)}
                className="text-yellow-700 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-200"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        )}
        
        {/* No win message */}
        {noWinMessage && (
          <div className="mb-4">
            <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-600 p-4">
              <div className="flex items-center">
                <AlertCircle className="text-red-700 dark:text-red-400 mr-3" size={24} />
                <span className="text-red-700 dark:text-red-300 font-bold text-lg">{noWinMessage}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-lg dark:text-white">Card {selectedCard.id}</h4>
          {winningPattern && (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-full flex items-center">
              <CheckCircle className="mr-2" size={20} />
              <span className="font-semibold">WINNER!</span>
            </div>
          )}
        </div>
        
        {/* Full-width card grid */}
        <div className="grid grid-cols-5 gap-1 w-full">
          {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
            <div 
              key={letter} 
              className="h-16 bg-blue-600 text-white font-bold flex items-center justify-center text-xl"
            >
              {letter}
            </div>
          ))}
          
          {selectedCard.numbers.map((row, rowIndex) =>
            row.map((number, colIndex) => {
              const isCalled = calledNumbers.includes(number) || (rowIndex === 2 && colIndex === 2 && number === 0);
              const isMatched = checkResults.some(result => 
                result.isWinning && result.matchedPositions.some(([r, c]) => r === rowIndex && c === colIndex)
              );
              
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`h-16 flex items-center justify-center text-base font-bold ${
                    rowIndex === 2 && colIndex === 2 && number === 0
                      ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 border-2 border-yellow-600' 
                      : isMatched
                      ? 'bg-gradient-to-br from-green-300 to-green-500 text-green-900 border-2 border-green-600' 
                      : isCalled
                      ? 'bg-gradient-to-br from-blue-200 to-blue-400 text-blue-900 border-2 border-blue-500' 
                      : 'bg-gradient-to-br from-gray-100 to-gray-300 text-gray-700 dark:from-gray-700 dark:to-gray-800 dark:text-gray-300 border border-gray-400 dark:border-gray-600' 
                  }`}
                >
                  {rowIndex === 2 && colIndex === 2 && number === 0 ? 'FREE' : number}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold dark:text-white">Bingo Card Verification</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={28} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Card Number Input */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                Enter Card Number
              </label>
              <div className="flex gap-4">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/, ''))}
                  placeholder="Card number..."
                  className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
                />
                <button
                  onClick={handleCheck}
                  disabled={isChecking}
                  className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-800 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-800 dark:hover:from-blue-800 dark:hover:to-indigo-900 disabled:opacity-70 flex items-center justify-center text-lg font-semibold transition-colors duration-200"
                >
                  {isChecking ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Checking...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Check className="mr-2" size={24} />
                      Check Card
                    </span>
                  )}
                </button>
              </div>
              {error && (
                <div className="mt-3 flex items-center text-red-600 dark:text-red-400">
                  <AlertCircle className="mr-2" size={20} />
                  <span className="font-medium">{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notification System */}
          {notification && (
            <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4 ${
              notification.type === 'error' ? 'animate-fade-in' : ''
            }`}>
              <div className={`p-4 rounded-lg flex items-center justify-between shadow-lg ${
                notification.type === 'success' 
                  ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 border-2 border-emerald-300 dark:border-emerald-600' 
                  : notification.type === 'error'
                  ? 'bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900 dark:to-rose-900 border-2 border-rose-300 dark:border-rose-600'
                  : 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border-2 border-blue-300 dark:border-blue-600'
              }`}>
                <div className="flex items-center">
                  {notification.type === 'success' ? (
                    <CheckCircle className="text-emerald-600 dark:text-emerald-400 mr-3" size={24} />
                  ) : notification.type === 'error' ? (
                    <AlertCircle className="text-rose-600 dark:text-rose-400 mr-3" size={24} />
                  ) : (
                    <Info className="text-blue-600 dark:text-blue-400 mr-3" size={24} />
                  )}
                  <span className={`font-bold ${
                    notification.type === 'success' 
                      ? 'text-emerald-700 dark:text-emerald-300 text-xl' 
                      : notification.type === 'error'
                      ? 'text-rose-700 dark:text-rose-300 text-xl' 
                      : 'text-blue-700 dark:text-blue-300'
                  }`}>
                    {notification.message}
                  </span>
                </div>
                <button 
                  onClick={() => setNotification(null)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
          )}

          {/* Existing Claim Status */}
          {existingClaim && existingClaim.validation_result !== 'invalid' && (
            <div className={`p-4 rounded-lg relative ${
              existingClaim.validation_result === 'valid' 
                ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-emerald-300 dark:border-emerald-600' 
                : 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border-2 border-amber-300 dark:border-amber-600'
            }`}>
              <button 
                onClick={() => setExistingClaim(null)}
                className="absolute top-2 right-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
              <div className="flex items-center space-x-3 pr-6">
                {existingClaim.validation_result === 'valid' ? (
                  <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={24} />
                ) : (
                  <AlertCircle className="text-amber-600 dark:text-amber-400" size={24} />
                )}
                <div>
                  <span className="font-bold text-lg dark:text-white">
                    {existingClaim.validation_result === 'valid' 
                      ? `WINNING CARD #${selectedCard?.id || ''}` 
                      : 'PENDING CLAIM'
                    }
                  </span>
                  <p className="text-gray-700 dark:text-gray-300 mt-1">
                    {existingClaim.validation_result === 'valid' 
                      ? 'This card has already been verified as a winner.'
                      : 'This card has a claim that needs verification.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card Display - Full width */}
          {selectedCard && renderCard()}

          {/* Action Buttons */}
          {selectedCard && !existingClaim && !winningPattern && (
            <div className="flex justify-center gap-4">
              {!hasWinningPattern && (
                <button
                  onClick={lockCard}
                  disabled={isLocking}
                  className="bg-gradient-to-r from-red-600 to-rose-700 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-rose-800 disabled:opacity-70 flex items-center text-lg font-semibold"
                >
                  {isLocking ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Locking...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Lock className="mr-2" size={24} />
                      <span>Lock Card</span>
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Pattern Results */}
          {checkResults.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold border-b pb-2 dark:text-white dark:border-gray-700">Pattern Verification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {checkResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border-2 ${
                      result.isWinning
                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-emerald-300 dark:border-emerald-600'
                        : 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/30 dark:to-slate-900/30 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between">
                      <div>
                        <h4 className={`text-lg font-bold ${result.isWinning ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {result.pattern.name}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">{result.pattern.description}</p>
                      </div>
                      <div className="flex items-center">
                        {result.isWinning ? (
                          <div className="flex items-center bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-full">
                            <CheckCircle className="mr-1" size={20} />
                            <span className="font-semibold">Winner!</span>
                          </div>
                        ) : (
                          <div className="flex items-center bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 px-3 py-1 rounded-full">
                            <X className="mr-1" size={20} />
                            <span>Not Matched</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Pattern Preview */}
                    <div className="mt-4">
                      <div className="grid grid-cols-5 gap-1 w-fit">
                        {result.pattern.pattern.map((row, rowIndex) => 
                          row.map((cell, colIndex) => (
                            <div
                              key={`${rowIndex}-${colIndex}`}
                              className={`w-8 h-8 flex items-center justify-center ${
                                cell 
                                  ? result.matchedPositions.some(([r, c]) => r === rowIndex && c === colIndex)
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-red-400 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700'
                              }`}
                            >
                              {cell ? '✓' : ''}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Game Info */}
          <div className="bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900/30 dark:to-gray-900/30 p-5 rounded-xl border border-gray-300 dark:border-gray-700">
            <h4 className="font-bold text-lg mb-3 dark:text-white">Game Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-base">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <span className="font-semibold text-gray-600 dark:text-gray-400">Game Status:</span>
                <span className={`ml-2 font-bold ${
                  gameStatus === 'active' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
                }`}>
                  {gameStatus.toUpperCase()}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <span className="font-semibold text-gray-600 dark:text-gray-400">Numbers Called:</span>
                <span className="ml-2 font-bold text-blue-700 dark:text-blue-500">{calledNumbers.length}</span>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <span className="font-semibold text-gray-600 dark:text-gray-400">Card Marked:</span>
                <span className="ml-2 font-bold text-purple-700 dark:text-purple-500">{markedNumbers.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BingoCheckModal;