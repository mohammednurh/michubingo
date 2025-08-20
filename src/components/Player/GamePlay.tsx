import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Trophy, RotateCcw } from 'lucide-react';
import { supabase, Game, GameCall, CardTemplate, GamePattern } from '../../lib/supabase';
import { checkLinePatterns, validateBingo } from '../../utils/gameUtils';
import Confetti from 'react-confetti';

const GamePlay: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionToken = searchParams.get('session');

  const [game, setGame] = useState<Game | null>(null);
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>([]);
  const [patterns, setPatterns] = useState<GamePattern[]>([]);
  const [markedNumbers, setMarkedNumbers] = useState<{ [cardId: number]: number[] }>({});
  const [currentCall, setCurrentCall] = useState<GameCall | null>(null);
  const [callHistory, setCallHistory] = useState<GameCall[]>([]);
  const [gameStatus, setGameStatus] = useState<'setup' | 'active' | 'paused' | 'ended'>('setup');
  const [autoMark, setAutoMark] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [winner, setWinner] = useState<{ cardId: number; patterns: string[] } | null>(null);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const [playerSession, setPlayerSession] = useState<any>(null);

  useEffect(() => {
    if (gameId && sessionToken) {
      fetchGameData();
      fetchPlayerSession();
    }
  }, [gameId, sessionToken]);

  useEffect(() => {
    if (gameId) {
      subscribeToGameUpdates();
    }
    
    return () => {
      supabase.removeAllChannels();
    };
  }, [gameId]);

  useEffect(() => {
    if (currentCall && autoMark) {
      markNumberOnAllCards(currentCall.number);
    }
  }, [currentCall, autoMark]);

  const fetchGameData = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;
      setGame(gameData);
      setGameStatus(gameData.status);

      // Fetch patterns
      const { data: patternsData, error: patternsError } = await supabase
        .from('game_patterns')
        .select('*')
        .in('id', gameData.patterns);

      if (patternsError) throw patternsError;
      setPatterns(patternsData || []);

      // Fetch call history
      const { data: callsData, error: callsError } = await supabase
        .from('game_calls')
        .select('*')
        .eq('game_id', gameId)
        .order('call_order');

      if (callsError) throw callsError;
      setCallHistory(callsData || []);
      
      if (callsData && callsData.length > 0) {
        setCurrentCall(callsData[callsData.length - 1]);
      }

    } catch (error) {
      console.error('Error fetching game data:', error);
    }
  };

  const fetchPlayerSession = async () => {
    try {
      const { data, error } = await supabase
        .from('player_sessions')
        .select('*')
        .eq('session_token', sessionToken!)
        .single();

      if (error) throw error;
      setPlayerSession(data);

      // Fetch selected cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('card_templates')
        .select('*')
        .in('id', data.selected_cards);

      if (cardsError) throw cardsError;
      setCardTemplates(cardsData || []);

      // Initialize marked numbers for each card
      const initialMarked: { [cardId: number]: number[] } = {};
      data.selected_cards.forEach((cardId: number) => {
        initialMarked[cardId] = [];
      });
      setMarkedNumbers(initialMarked);

    } catch (error) {
      console.error('Error fetching player session:', error);
    }
  };

  const subscribeToGameUpdates = () => {
    const channel = supabase.channel(`game-${gameId}`)
      .on('broadcast', { event: 'number_called' }, (payload) => {
        const call = payload.payload as GameCall;
        setCurrentCall(call);
        setCallHistory(prev => [...prev, call]);
      })
      .on('broadcast', { event: 'game_status_changed' }, (payload) => {
        setGameStatus(payload.payload.status);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const markNumberOnAllCards = (number: number) => {
    setMarkedNumbers(prev => {
      const updated = { ...prev };
      cardTemplates.forEach(card => {
        // Check if this card contains the number
        const hasNumber = card.numbers.some(row => row.includes(number));
        if (hasNumber && !updated[card.id].includes(number)) {
          updated[card.id] = [...updated[card.id], number];
          
          // Check for bingo after marking
          setTimeout(() => checkForBingo(card.id, [...updated[card.id], number]), 100);
        }
      });
      return updated;
    });
  };

  const toggleMark = (cardId: number, number: number) => {
    if (number === 0) return; // Can't mark free space

    setMarkedNumbers(prev => ({
      ...prev,
      [cardId]: prev[cardId].includes(number)
        ? prev[cardId].filter(n => n !== number)
        : [...prev[cardId], number]
    }));

    // If marking manually, mark on all other cards too (linked marking)
    if (!autoMark) {
      markNumberOnAllCards(number);
    }
  };

  const checkForBingo = (cardId: number, marked: number[]) => {
    const card = cardTemplates.find(c => c.id === cardId);
    if (!card) return;

    const winningPatterns: string[] = [];

    // Check each pattern
    patterns.forEach(pattern => {
      if (validateBingo(card.numbers, marked, pattern.pattern)) {
        winningPatterns.push(pattern.name);
      }
    });

    // Also check line patterns
    const linePatterns = checkLinePatterns(card.numbers, marked);
    winningPatterns.push(...linePatterns);

    if (winningPatterns.length > 0) {
      setWinner({ cardId, patterns: winningPatterns });
      setShowWinnerAnimation(true);
      
      // Submit bingo claim
      submitBingoClaim(cardId, marked, winningPatterns);
      
      // Hide animation after 5 seconds
      setTimeout(() => {
        setShowWinnerAnimation(false);
      }, 5000);
    }
  };

  const submitBingoClaim = async (cardId: number, marked: number[], patterns: string[]) => {
    if (!playerSession || !gameId) return;

    try {
      const { error } = await supabase
        .from('bingo_claims')
        .insert([{
          game_id: gameId,
          player_session_id: playerSession.id,
          card_id: cardId,
          pattern_id: patterns[0], // Use first pattern for now
          marked_numbers: marked,
          validation_result: 'pending'
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error submitting bingo claim:', error);
    }
  };

  const renderCard = (card: CardTemplate) => {
    const marked = markedNumbers[card.id] || [];
    
    return (
      <div key={card.id} className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg">Card {card.id}</h3>
          {winner?.cardId === card.id && (
            <div className="flex items-center space-x-1 text-yellow-600">
              <Trophy size={20} />
              <span className="font-bold">WINNER!</span>
            </div>
          )}
        </div>
        
        {/* BINGO Header */}
        <div className="grid grid-cols-5 gap-1 mb-2">
          {['B', 'I', 'N', 'G', 'O'].map(letter => (
            <div key={letter} className="bg-gradient-to-r from-green-500 to-yellow-500 text-white font-bold text-center py-2 rounded">
              {letter}
            </div>
          ))}
        </div>
        
        {/* Card Grid */}
        <div className="grid grid-cols-5 gap-1">
          {card.numbers.map((row, rowIndex) =>
            row.map((number, colIndex) => {
              const isMarked = number === 0 || marked.includes(number);
              const isFreeSpace = rowIndex === 2 && colIndex === 2 && number === 0;
              const isRecentCall = currentCall && currentCall.number === number;
              
              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => !isFreeSpace && toggleMark(card.id, number)}
                  disabled={isFreeSpace}
                  className={`aspect-square flex items-center justify-center text-sm font-medium rounded transition-all ${
                    isFreeSpace 
                      ? 'bg-gray-200 text-gray-500' 
                      : isMarked
                        ? 'bg-green-500 text-white'
                        : isRecentCall
                          ? 'bg-yellow-300 text-gray-900 ring-2 ring-yellow-500'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {isFreeSpace ? 'FREE' : number}
                </button>
              );
            })
          )}
        </div>
        
        {winner?.cardId === card.id && (
          <div className="mt-3 p-2 bg-yellow-100 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Winning Patterns:</strong> {winner.patterns.join(', ')}
            </p>
          </div>
        )}
      </div>
    );
  };

  if (!game || !playerSession) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showWinnerAnimation && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          numberOfPieces={200}
          recycle={false}
        />
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/player')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{game.title}</h1>
              <p className="text-sm text-gray-600">
                {cardTemplates.length} cards • Range: 1-{game.number_range}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAutoMark(!autoMark)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                autoMark 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Auto-Mark: {autoMark ? 'ON' : 'OFF'}
            </button>
            
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            
            <button
              onClick={() => {
                const confirmed = confirm('Clear all marks? This cannot be undone.');
                if (confirmed) {
                  const clearedMarks: { [cardId: number]: number[] } = {};
                  cardTemplates.forEach(card => {
                    clearedMarks[card.id] = [];
                  });
                  setMarkedNumbers(clearedMarks);
                  setWinner(null);
                }
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Current Call & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <h2 className="text-lg font-semibold mb-3">Current Call</h2>
            {currentCall ? (
              <div className="space-y-2">
                <div className="w-20 h-20 mx-auto bg-gradient-to-r from-green-500 to-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {currentCall.letter}{currentCall.number}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Call #{currentCall.call_order}
                </p>
              </div>
            ) : (
              <div className="text-gray-500">Waiting for calls...</div>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-3">Game Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  gameStatus === 'active' ? 'bg-green-100 text-green-800' :
                  gameStatus === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                  gameStatus === 'ended' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {gameStatus.charAt(0).toUpperCase() + gameStatus.slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Calls:</span>
                <span>{callHistory.length}</span>
              </div>
              <div className="flex justify-between">
                <span>My Cards:</span>
                <span>{cardTemplates.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Winner Alert */}
        {winner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-center space-x-3">
              <Trophy size={24} className="text-yellow-600" />
              <div>
                <h3 className="font-bold text-yellow-800">🎉 BINGO! Congratulations!</h3>
                <p className="text-yellow-700">
                  Card {winner.cardId} completed: {winner.patterns.join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cardTemplates.map(card => renderCard(card))}
        </div>

        {/* Last Calls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Recent Calls</h3>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {callHistory
              .slice(-20)
              .reverse()
              .map((call) => (
                <div
                  key={call.call_order}
                  className="bg-gray-100 rounded p-2 text-center"
                >
                  <div className="font-medium text-sm">
                    {call.letter}{call.number}
                  </div>
                  <div className="text-xs text-gray-500">
                    #{call.call_order}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePlay;