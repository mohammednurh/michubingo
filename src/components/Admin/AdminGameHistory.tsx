import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, Eye, Filter } from 'lucide-react';
import { supabase, Game } from '../../lib/supabase';

interface GameHistoryData extends Game {
  playerNumber: number;
  totalCalls: number;
  totalBetAmount: number;
  profit: number;
  cashierName: string; // <--- add this

}

type DateFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';

const AdminGameHistory: React.FC = () => {
  // Default: Daily
  const [dateFilter, setDateFilter] = useState<DateFilter>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [games, setGames] = useState<GameHistoryData[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchGames();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, selectedDate]);

  const getDateRange = () => {
    const now = new Date(selectedDate);
    let startDate: Date;
    let endDate: Date;

    switch (dateFilter) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'weekly': {
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
        break;
      }
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
    }

    return { startDate, endDate };
  };

  const fetchGames = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
  
      // 1. Fetch games
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .in('status', ['active', 'paused', 'ended'])
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });
      if (gamesError) throw gamesError;
  
      // 2. Fetch all hosts (users with role 'cashier')
      const { data: cashiersData, error: cashiersError } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'cashier');
      if (cashiersError) throw cashiersError;
  
      // 3. Map host full_name to each game
      const processed: GameHistoryData[] = (gamesData || []).map((game: any) => {
        const playerNumber = game.selected_cards?.length || 0;
        const totalCalls = Array.isArray(game.call_sequence) ? game.call_sequence.length : 0;
        const totalBetAmount = playerNumber * (game.betting_amount_birr || 0);
        const profit = totalBetAmount * 0.2;
  
        const host = cashiersData?.find((c: any) => String(c.id) === String(game.host_id));
  
        return {
          ...game,
          playerNumber,
          totalCalls,
          totalBetAmount,
          profit,
          cashierName: host?.full_name || 'Unknown', // now uses host_id
        };
      });
  
      setGames(processed);
    } catch (e) {
      console.error('Error fetching admin games:', e);
    } finally {
      setLoading(false);
    }
  };
  

  const currentPageItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return games.slice(start, end);
  }, [games, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(games.length / itemsPerPage) || 1;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      ended: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const totals = useMemo(() => {
    const totalBetAmount = games.reduce((s, g) => s + g.totalBetAmount, 0);
    const totalProfit = games.reduce((s, g) => s + g.profit, 0);
    const totalPlayers = games.reduce((s, g) => s + g.playerNumber, 0);
    return { totalBetAmount, totalProfit, totalPlayers };
  }, [games]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (dateFilter === 'yearly') {
      const year = parseInt(value, 10);
      if (!isNaN(year)) {
        const d = new Date(selectedDate);
        d.setFullYear(year);
        setSelectedDate(d);
      }
    } else {
      setSelectedDate(new Date(value));
    }
  };

  const getDateInputType = () => {
    switch (dateFilter) {
      case 'daily':
      case 'weekly':
        return 'date';
      case 'monthly':
        return 'month';
      case 'yearly':
        return 'number';
    }
  };

  const getDateInputValue = () => {
    const date = selectedDate;
    switch (dateFilter) {
      case 'daily':
        return date.toISOString().split('T')[0];
      case 'weekly': {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        return startOfWeek.toISOString().split('T')[0];
      }
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'yearly':
        return String(date.getFullYear());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Games History</h1>
          <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2">
            <Download size={20} />
            <span>Export</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
          </div>

          <div className="flex space-x-2">
            {(['daily', 'weekly', 'monthly', 'yearly'] as DateFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  dateFilter === filter
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <Calendar size={20} className="text-gray-500" />
            <input
              type={getDateInputType()}
              value={getDateInputValue()}
              onChange={handleDateChange}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              min={dateFilter === 'yearly' ? '2020' : undefined}
              max={dateFilter === 'yearly' ? String(new Date().getFullYear()) : undefined}
            />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Games</h3>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{games.length}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-600 dark:text-green-400">Total Players</h3>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">{totals.totalPlayers}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-purple-600 dark:text-purple-400">Total Bet Amount</h3>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{totals.totalBetAmount} Birr</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-orange-600 dark:text-orange-400">Total Profit</h3>
            <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{totals.totalProfit.toFixed(2)} Birr</p>
          </div>
        </div>
      </div>

      {/* Games Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No games found for the selected period.</p>
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Game Host</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bet Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Calls</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Bet Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Profit (20%)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {currentPageItems.map((game) => (
                    <tr key={game.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDate(game.created_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{game.cashierName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Range: 1-{game.number_range}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{game.betting_amount_birr} Birr</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{game.playerNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{game.totalCalls}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{game.totalBetAmount} Birr</td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(game.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">{game.profit.toFixed(2)} Birr</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => window.open(`/cashier/game/${game.id}`, '_blank')}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="View Game"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>) )}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(currentPage * itemsPerPage, games.length)}</span>{' '}
                      of <span className="font-medium">{games.length}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium ${
                          currentPage === 1
                            ? 'text-gray-300 dark:text-gray-500 cursor-not-allowed'
                            : 'text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="sr-only">Previous</span>
                        &larr;
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                        <button
                          key={number}
                          onClick={() => setCurrentPage(number)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === number
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {number}
                        </button>
                      ))}

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium ${
                          currentPage === totalPages
                            ? 'text-gray-300 dark:text-gray-500 cursor-not-allowed'
                            : 'text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="sr-only">Next</span>
                        &rarr;
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminGameHistory;
