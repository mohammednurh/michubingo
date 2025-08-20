import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, ChevronLeft, ChevronRight, Star } from 'lucide-react';

type CardTemplate = {
  id: number;
  card_id: string;
  numbers: number[][];
};

const BingoCards: React.FC = () => {
  const [cards, setCards] = useState<CardTemplate[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentRange, setCurrentRange] = useState<[number, number]>([1, 200]);
  const cardsPerPage = 20;

  // Colors for B-I-N-G-O circles
  const bingoColors = [
    'bg-red-500 dark:bg-red-600',     // B
    'bg-blue-500 dark:bg-blue-600',    // I
    'bg-purple-500 dark:bg-purple-600',  // N
    'bg-green-500 dark:bg-green-600',   // G
    'bg-orange-500 dark:bg-orange-600',  // O
  ];

  // Card header gradient colors
  const headerGradients = [
    'from-indigo-600 to-purple-600',
    'from-blue-600 to-cyan-500',
    'from-green-600 to-emerald-500',
    'from-red-600 to-pink-500',
    'from-yellow-600 to-amber-500',
  ];

  useEffect(() => {
    async function fetchCards() {
      setLoading(true);
      const { data, error } = await supabase
        .from('card_templates')
        .select('id, card_id, numbers')
        .order('id', { ascending: true }); // Sort by id to ensure proper sequence
      
      if (error) {
        console.error('Error fetching cards:', error.message);
      } else if (data) {
        setCards(data);
        setFilteredCards(data);
      }
      setLoading(false);
    }
    fetchCards();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCards(cards);
    } else {
      const filtered = cards.filter(card => 
        card.card_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCards(filtered);
    }
  }, [searchTerm, cards]);

  const handleRangeChange = useCallback((start: number, end: number) => {
    setCurrentRange([start, end]);
  }, []);

  const totalPages = Math.ceil(filteredCards.length / cardsPerPage);
  const currentPage = Math.floor(currentRange[0] / cardsPerPage) + 1;

  // Get cards in the current range (1-200 shows all by default)
  const displayedCards = currentRange[1] === 200 
    ? filteredCards 
    : filteredCards.slice(currentRange[0] - 1, currentRange[1]);

  const goToPreviousPage = () => {
    if (currentRange[0] > 1) {
      const newStart = Math.max(1, currentRange[0] - cardsPerPage);
      const newEnd = newStart + cardsPerPage - 1;
      setCurrentRange([newStart, newEnd]);
    }
  };

  const goToNextPage = () => {
    if (currentRange[1] < filteredCards.length) {
      const newStart = currentRange[0] + cardsPerPage;
      const newEnd = Math.min(filteredCards.length, newStart + cardsPerPage - 1);
      setCurrentRange([newStart, newEnd]);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
    </div>
  );

  return (
    <div className="p-6 dark:bg-gray-900 dark:text-gray-100">
      {/* Modern Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Bingo Cards Collection</h1>
            <p className="text-gray-600 dark:text-gray-300">Browse and manage all available bingo cards</p>
          </div>
          
          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search cards..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-400 dark:focus:border-indigo-400 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleRangeChange(1, 200)}
              className={`px-4 py-2 rounded-lg ${currentRange[1] === 200 ? 'bg-indigo-600 dark:bg-indigo-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700'}`}
            >
              Show All (1-200)
            </button>
            
            <button
              onClick={goToPreviousPage}
              disabled={currentRange[0] <= 1}
              className={`p-2 rounded-lg ${currentRange[0] <= 1 ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700'}`}
            >
              <ChevronLeft size={20} />
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageStart = i * cardsPerPage + 1;
              const pageEnd = Math.min((i + 1) * cardsPerPage, 200);
              return (
                <button
                  key={i}
                  onClick={() => handleRangeChange(pageStart, pageEnd)}
                  className={`px-4 py-2 rounded-lg ${currentRange[0] === pageStart && currentRange[1] !== 200 ? 'bg-indigo-600 dark:bg-indigo-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700'}`}
                >
                  {pageStart}-{pageEnd}
                </button>
              );
            })}
            
            <button
              onClick={goToNextPage}
              disabled={currentRange[1] >= filteredCards.length || currentRange[1] === 200}
              className={`p-2 rounded-lg ${currentRange[1] >= filteredCards.length || currentRange[1] === 200 ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700'}`}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {currentRange[1] === 200 
              ? `Showing all ${filteredCards.length} cards` 
              : `Showing cards ${currentRange[0]}-${Math.min(currentRange[1], filteredCards.length)}`}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {!displayedCards.length ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">No cards found matching your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedCards.map(({ id, card_id, numbers }, index) => {
            const cardNumber = parseInt(card_id.split('_')[1]);
            const gradientIndex = (cardNumber - 1) % headerGradients.length;
            
            return (
              <div
                key={id}
                className="border rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow transform hover:-translate-y-1 dark:border-gray-700"
              >
                {/* Card header with gradient background */}
                <div className={`bg-gradient-to-r ${headerGradients[gradientIndex]} p-3 text-center`}>
                  <h2 className="text-lg font-semibold text-white">{card_id}</h2>
                </div>
                
                <div className="p-4">
                  {/* B-I-N-G-O letters in circles */}
                  <div className="grid grid-cols-5 gap-2 mb-3 text-center">
                    {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
                      <div 
                        key={letter} 
                        className={`flex items-center justify-center w-10 h-10 mx-auto rounded-full 
                          ${bingoColors[index]} text-white font-bold text-lg`}
                      >
                        {letter}
                      </div>
                    ))}
                  </div>
                  
                  {/* Bingo numbers grid */}
                  <div className="grid grid-cols-5 gap-2 text-center font-mono">
                    {numbers.map((row, rowIndex) =>
                      row.map((num, colIndex) => (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={`border rounded p-2 text-lg font-bold select-none
                            ${
                              rowIndex === 2 && colIndex === 2
                                ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-200 cursor-default flex items-center justify-center'
                                : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }
                            ${bingoColors[colIndex].split(' ')[0].replace('bg', 'border')} border-2
                          `}
                        >
                          {rowIndex === 2 && colIndex === 2 ? (
                            <Star className="w-5 h-5 fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400" />
                          ) : num === 0 ? '' : num}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BingoCards;