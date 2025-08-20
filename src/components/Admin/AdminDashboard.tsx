import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Gamepad2, 
  Calendar, 
  TrendingUp, 
  DollarSign,
  Activity,
  Trophy,
  Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DashboardStats {
  totalUsers: number;
  totalActiveGames: number;
  totalTodayGames: number;
  totalRevenue: number;
}

interface CashierStats {
  id: string;
  full_name: string;
  totalGames: number;
  profit: number;
  activeGames: number;
}

interface GamesByStatus {
  active: number;
  paused: number;
  ended: number;
  setup: number;
}

interface RevenueByMonth {
  month: string;
  revenue: number;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalActiveGames: 0,
    totalTodayGames: 0,
    totalRevenue: 0
  });
  const [cashierStats, setCashierStats] = useState<CashierStats[]>([]);
  const [gamesByStatus, setGamesByStatus] = useState<GamesByStatus>({
    active: 0,
    paused: 0,
    ended: 0,
    setup: 0
  });
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueByMonth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBasicStats(),
        fetchCashierStats(),
        fetchGamesByStatus(),
        fetchRevenueByMonth()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBasicStats = async () => {
    try {
      // Total Users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Total Active Games
      const { count: totalActiveGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Total Today Games
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count: totalTodayGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      // Total Revenue (20% of subscription prices)
      const { data: users } = await supabase
        .from('users')
        .select('subscription_price_birr');

      const totalRevenue = (users || []).reduce((sum, user) => {
        return sum + (user.subscription_price_birr || 0) * 0.2;
      }, 0);

      setStats({
        totalUsers: totalUsers || 0,
        totalActiveGames: totalActiveGames || 0,
        totalTodayGames: totalTodayGames || 0,
        totalRevenue
      });
    } catch (error) {
      console.error('Error fetching basic stats:', error);
    }
  };

  const fetchCashierStats = async () => {
    try {
      // Get all cashiers
      const { data: cashiers } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'cashier');

      if (!cashiers) return;

      const cashierStatsPromises = cashiers.map(async (cashier) => {
        // Total games by cashier
        const { data: games } = await supabase
          .from('games')
          .select('selected_cards, betting_amount_birr, status')
          .eq('host_id', cashier.id);

        const totalGames = games?.length || 0;
        const activeGames = games?.filter(g => g.status === 'active').length || 0;
        
        // Calculate profit (20% of total bet amounts)
        const profit = (games || []).reduce((sum, game) => {
          const playerNumber = game.selected_cards?.length || 0;
          const betAmount = game.betting_amount_birr || 0;
          return sum + (playerNumber * betAmount * 0.2);
        }, 0);

        return {
          id: cashier.id,
          full_name: cashier.full_name,
          totalGames,
          profit,
          activeGames
        };
      });

      const cashierStatsData = await Promise.all(cashierStatsPromises);
      setCashierStats(cashierStatsData);
    } catch (error) {
      console.error('Error fetching cashier stats:', error);
    }
  };

  const fetchGamesByStatus = async () => {
    try {
      const { data: games } = await supabase
        .from('games')
        .select('status');

      const statusCounts = (games || []).reduce((acc, game) => {
        acc[game.status as keyof GamesByStatus] = (acc[game.status as keyof GamesByStatus] || 0) + 1;
        return acc;
      }, { active: 0, paused: 0, ended: 0, setup: 0 });

      setGamesByStatus(statusCounts);
    } catch (error) {
      console.error('Error fetching games by status:', error);
    }
  };

  const fetchRevenueByMonth = async () => {
    try {
      // Get games from last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: games } = await supabase
        .from('games')
        .select('created_at, selected_cards, betting_amount_birr')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      const monthlyRevenue: { [key: string]: number } = {};

      (games || []).forEach(game => {
        const date = new Date(game.created_at);
        const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        
        const playerNumber = game.selected_cards?.length || 0;
        const betAmount = game.betting_amount_birr || 0;
        const revenue = playerNumber * betAmount * 0.2;

        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + revenue;
      });

      const revenueData = Object.entries(monthlyRevenue).map(([month, revenue]) => ({
        month,
        revenue
      }));

      setRevenueByMonth(revenueData);
    } catch (error) {
      console.error('Error fetching revenue by month:', error);
    }
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }> = ({ title, value, icon, color, subtitle }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${color.replace('border-l-', 'bg-').replace('-500', '-100')} ${color.replace('border-l-', 'text-').replace('-500', '-600')}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  const BarChart: React.FC<{ data: CashierStats[]; title: string; dataKey: 'totalGames' | 'profit' }> = ({ 
    data, 
    title, 
    dataKey 
  }) => {
    const maxValue = Math.max(...data.map(item => item[dataKey]));
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        <div className="space-y-4">
          {data.map((cashier, index) => (
            <div key={cashier.id} className="flex items-center space-x-3">
              <div className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {cashier.full_name}
              </div>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative">
                <div
                  className={`h-4 rounded-full ${
                    index % 4 === 0 ? 'bg-blue-500' :
                    index % 4 === 1 ? 'bg-green-500' :
                    index % 4 === 2 ? 'bg-yellow-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${maxValue > 0 ? (cashier[dataKey] / maxValue) * 100 : 0}%` }}
                />
              </div>
              <div className="w-16 text-sm font-semibold text-gray-900 dark:text-white text-right">
                {dataKey === 'profit' ? `${cashier[dataKey].toFixed(0)} Birr` : cashier[dataKey]}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PieChart: React.FC<{ data: GamesByStatus }> = ({ data }) => {
    const total = Object.values(data).reduce((sum, value) => sum + value, 0);
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Games by Status</h3>
        <div className="flex items-center justify-center">
          <div className="relative w-48 h-48">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {Object.entries(data).map(([status, count], index) => {
                const percentage = total > 0 ? (count / total) * 100 : 0;
                const strokeDasharray = `${percentage} ${100 - percentage}`;
                const strokeDashoffset = Object.entries(data)
                  .slice(0, index)
                  .reduce((offset, [, prevCount]) => offset - (total > 0 ? (prevCount / total) * 100 : 0), 0);
                
                return (
                  <circle
                    key={status}
                    cx="50"
                    cy="50"
                    r="15.915"
                    fill="transparent"
                    stroke={colors[index]}
                    strokeWidth="8"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                  />
                );
              })}
            </svg>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {Object.entries(data).map(([status, count], idx) => (
            <div key={status} className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: colors[idx] }} />
              <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                {status}: {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const LineChart: React.FC<{ data: RevenueByMonth[] }> = ({ data }) => {
    const maxRevenue = Math.max(...data.map(item => item.revenue));
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend (Last 6 Months)</h3>
        <div className="h-64 flex items-end justify-between space-x-2">
          {data.map((item) => (
            <div key={item.month} className="flex flex-col items-center flex-1">
              <div
                className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-md"
                style={{ height: `${maxRevenue > 0 ? (item.revenue / maxRevenue) * 200 : 0}px` }}
              />
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center">
                {item.month}
              </div>
              <div className="text-xs font-semibold text-gray-900 dark:text-white">
                {item.revenue.toFixed(0)} Birr
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <button
          onClick={fetchDashboardData}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
        >
          <Activity size={20} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={<Users size={24} />}
          color="border-l-blue-500"
          subtitle="Registered users"
        />
        <StatCard
          title="Active Games"
          value={stats.totalActiveGames}
          icon={<Gamepad2 size={24} />}
          color="border-l-green-500"
          subtitle="Currently running"
        />
        <StatCard
          title="Today's Games"
          value={stats.totalTodayGames}
          icon={<Calendar size={24} />}
          color="border-l-yellow-500"
          subtitle="Games created today"
        />
        <StatCard
          title="Total Revenue"
          value={`${stats.totalRevenue.toFixed(2)} Birr`}
          icon={<DollarSign size={24} />}
          color="border-l-purple-500"
          subtitle="20% of subscriptions"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart 
          data={cashierStats} 
          title="Games by Cashier" 
          dataKey="totalGames" 
        />
        <BarChart 
          data={cashierStats} 
          title="Profit by Cashier" 
          dataKey="profit" 
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PieChart data={gamesByStatus} />
        <LineChart data={revenueByMonth} />
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cashier Performance Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cashier Performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cashier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Games
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Active
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Profit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {cashierStats.map((cashier) => (
                  <tr key={cashier.id}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {cashier.full_name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {cashier.totalGames}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        cashier.activeGames > 0 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {cashier.activeGames}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">
                      {cashier.profit.toFixed(2)} Birr
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <Trophy className="text-blue-600" size={20} />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Top Cashier
                </span>
              </div>
              <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
                {cashierStats.length > 0 
                  ? cashierStats.reduce((prev, current) => 
                      prev.totalGames > current.totalGames ? prev : current
                    ).full_name
                  : 'N/A'
                }
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <TrendingUp className="text-green-600" size={20} />
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Total Games
                </span>
              </div>
              <span className="text-sm font-bold text-green-900 dark:text-green-100">
                {cashierStats.reduce((sum, cashier) => sum + cashier.totalGames, 0)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <Clock className="text-purple-600" size={20} />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  Last Updated
                </span>
              </div>
              <span className="text-sm font-bold text-purple-900 dark:text-purple-100">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
