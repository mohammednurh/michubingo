import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Grid, Play } from 'lucide-react';
import { supabase, CardTemplate } from '../../lib/supabase';

const PlayerInterface: React.FC = () => {
  const navigate = useNavigate();
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'card-selection' | 'game'>('splash');
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>([]);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any>(null);

  useEffect(() => {
    // Show splash screen for 3 seconds
    const timer = setTimeout(() => {
      setCurrentScreen('card-selection');
    }, 3000);

    fetchActiveGames();
    fetchCardTemplates();

    return () => clearTimeout(timer);
  }, []);

  const fetchActiveGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .in('status', ['active', 'setup'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActiveGames(data || []);
    } catch (error) {
      console.error('Error fetching active games:', error);
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

  const handleCardSelection = (cardId: number) => {
    setSelectedCards(prev =>
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const startGame = async (gameId: string) => {
    if (selectedCards.length === 0) {
      alert('Please select at least one card');
      return;
    }

    // Create player session
    const sessionToken = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { error } = await supabase
        .from('player_sessions')
        .insert([{
          game_id: gameId,
          session_token: sessionToken,
          selected_cards: selectedCards
        }]);

      if (error) throw error;

      // Navigate to game play
      navigate(`/player/game/${gameId}?session=${sessionToken}`);
    } catch (error) {
      console.error('Error creating player session:', error);
    }
  };

  if (currentScreen === 'splash') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-yellow-500 to-red-500 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-8 backdrop-blur-sm">
            <span className="text-6xl font-bold">B</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Ethiopian Bingo</h1>
          <p className="text-xl opacity-90">Get Ready to Play!</p>
          <div className="mt-8">
            <div className="inline-flex items-center space-x-2 text-lg">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'card-selection') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => navigate('/')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Select Your Cards</h1>
                  <p className="text-gray-600">Choose cards to play with</p>
                </div>
              </div>
              
              {selectedCards.length > 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {selectedCards.length} cards selected
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Available Games */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Available Games</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeGames.map((game) => (
                <div
                  key={game.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedGame?.id === game.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedGame(game)}
                >
                  <h3 className="font-medium text-gray-900">{game.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">Range: 1-{game.number_range}</p>
                  <p className="text-sm text-gray-600 mb-2">Bet: {game.betting_amount_birr} ETB</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    game.status === 'active' ? 'bg-green-100 text-green-800' :
                    game.status === 'setup' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card Selection */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Select Cards</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const range = cardTemplates.slice(0, 10).map(card => card.id);
                    setSelectedCards(range);
                  }}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  Select 1-10
                </button>
                <button
                  onClick={() => setSelectedCards([])}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-8 md:grid-cols-12 lg:grid-cols-16 gap-2 max-h-96 overflow-y-auto">
              {cardTemplates.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleCardSelection(card.id)}
                  className={`aspect-square p-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedCards.includes(card.id)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {card.id}
                </button>
              ))}
            </div>
          </div>

          {/* Start Game Button */}
          {selectedCards.length > 0 && selectedGame && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <button
                onClick={() => startGame(selectedGame.id)}
                className="w-full bg-gradient-to-r from-green-500 to-yellow-500 text-white py-4 rounded-lg font-medium hover:from-green-600 hover:to-yellow-600 transition-all flex items-center justify-center space-x-2"
              >
                <Play size={24} />
                <span>Start Playing with {selectedCards.length} Cards</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default PlayerInterface;