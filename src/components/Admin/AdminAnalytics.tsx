import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, Clock, Activity, CheckCircle, XCircle, BarChart2, Award, TrendingUp, Zap } from 'lucide-react';

// Minimal shape for games query in this page
interface GameRow {
  id: string;
  status: 'setup' | 'active' | 'paused' | 'ended';
  call_sequence: number[] | null;
  started_at?: string | null;
  ended_at?: string | null;
  title: string;
  number_range: number;
}

interface ClaimRow {
  id: string;
  game_id: string;
  pattern_id?: string | null;
  pattern_name?: string | null;
  validation_result?: string | null; // pending | valid | invalid (if exists)
  claim_timestamp?: string | null;
  validated_at?: string | null;
}

const AdminAnalytics: React.FC = () => {
  const [games, setGames] = useState<GameRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimsAvailable, setClaimsAvailable] = useState<boolean>(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Games
        const { data: gamesData, error: gamesError } = await supabase
          .from('games')
          .select('id, status, call_sequence, started_at, ended_at, title, number_range');
        if (gamesError) throw gamesError;
        setGames((gamesData as unknown as GameRow[]) || []);

        // Claims (optional)
        try {
          const { data: claimsData, error: claimsError } = await supabase
            .from('bingo_claims')
            .select('id, game_id, pattern_id, validation_result, claim_timestamp, validated_at');
          if (claimsError) throw claimsError;
          setClaims(claimsData || []);
          setClaimsAvailable(true);
        } catch (e) {
          // Table not present or columns differ; disable claims analytics
          setClaimsAvailable(false);
          setClaims([]);
        }
      } catch (e) {
        console.error('Error loading analytics:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // --- Games KPIs ---
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { setup: 0, active: 0, paused: 0, ended: 0 };
    games.forEach((g) => {
      counts[g.status] = (counts[g.status] || 0) + 1;
    });
    return counts;
  }, [games]);

  const avgCallsOverall = useMemo(() => {
    if (games.length === 0) return 0;
    const sum = games.reduce((acc, g) => acc + (Array.isArray((g as any).call_sequence) ? (g as any).call_sequence.length : 0), 0);
    return sum / Math.max(1, games.length);
  }, [games]);

  const avgCallsByRange = useMemo(() => {
    // Group by number_range as a proxy for game type
    const map: Record<string, { sum: number; count: number }> = {};
    games.forEach((g) => {
      const key = String(g.number_range);
      const calls = Array.isArray((g as any).call_sequence) ? (g as any).call_sequence.length : 0;
      if (!map[key]) map[key] = { sum: 0, count: 0 };
      map[key].sum += calls;
      map[key].count += 1;
    });
    return Object.entries(map)
      .map(([range, { sum, count }]) => ({ range, avg: count ? sum / count : 0 }))
      .sort((a, b) => Number(a.range) - Number(b.range));
  }, [games]);

  const gamesWithDuration = useMemo(() => {
    return games
      .map((g) => {
        const start = g.started_at ? new Date(g.started_at).getTime() : null;
        const end = g.ended_at ? new Date(g.ended_at).getTime() : null;
        const durationMs = start !== null && end !== null ? end - start : null;
        return { ...g, durationMs };
      })
      .filter((g) => g.durationMs !== null) as (GameRow & { durationMs: number })[];
  }, [games]);

  const fastestGames = useMemo(() => {
    return [...gamesWithDuration].sort((a, b) => a.durationMs - b.durationMs).slice(0, 5);
  }, [gamesWithDuration]);

  const slowestGames = useMemo(() => {
    return [...gamesWithDuration].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);
  }, [gamesWithDuration]);

  // --- Claims KPIs ---
  const claimsByStatus = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, valid: 0, invalid: 0 };
    (claims || []).forEach((c) => {
      const key = (c.validation_result || 'pending').toLowerCase();
      if (counts[key] === undefined) counts[key] = 0;
      counts[key] += 1;
    });
    return counts;
  }, [claims]);

  const claimsPerGame = useMemo(() => {
    const map = new Map<string, number>();
    (claims || []).forEach((c) => {
      map.set(c.game_id, (map.get(c.game_id) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([game_id, count]) => ({ game_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [claims]);

  const avgValidationTimePerGame = useMemo(() => {
    // average (validated_at - claim_timestamp) per game
    const map: Record<string, { sum: number; count: number }> = {};
    (claims || []).forEach((c) => {
      if (!c.claim_timestamp || !c.validated_at) return;
      const start = new Date(c.claim_timestamp).getTime();
      const end = new Date(c.validated_at).getTime();
      const diff = Math.max(0, end - start);
      if (!map[c.game_id]) map[c.game_id] = { sum: 0, count: 0 };
      map[c.game_id].sum += diff;
      map[c.game_id].count += 1;
    });
    return Object.entries(map)
      .map(([game_id, { sum, count }]) => ({ game_id, avgMs: sum / count }))
      .sort((a, b) => a.avgMs - b.avgMs)
      .slice(0, 10);
  }, [claims]);

  const mostClaimedPatterns = useMemo(() => {
    const map = new Map<string, number>();
    (claims || []).forEach((c) => {
      if (c.pattern_id) {
        map.set(c.pattern_id, (map.get(c.pattern_id) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([pattern_id, count]) => ({ pattern_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [claims]);

  // --- helpers ---
  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const makeDonutGradient = (sections: { color: string; value: number }[]) => {
    const total = sections.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    const stops = sections.map((s) => {
      const start = (acc / total) * 360;
      acc += s.value;
      const end = (acc / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-6 text-white">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-blue-100 mt-2">KPIs and insights across all games</p>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { 
            title: "Total Games", 
            value: games.length, 
            icon: <BarChart2 className="w-6 h-6" />,
            bg: "from-blue-500 to-cyan-500"
          },
          { 
            title: "Avg Calls/Game", 
            value: avgCallsOverall.toFixed(1), 
            icon: <TrendingUp className="w-6 h-6" />,
            bg: "from-purple-500 to-fuchsia-500"
          },
          { 
            title: "Completed Games", 
            value: statusCounts.ended || 0, 
            icon: <CheckCircle className="w-6 h-6" />,
            bg: "from-green-500 to-emerald-500"
          },
          { 
            title: "Active Now", 
            value: statusCounts.active || 0, 
            icon: <Zap className="w-6 h-6" />,
            bg: "from-amber-500 to-orange-500"
          }
        ].map((card, idx) => (
          <div 
            key={idx}
            className={`bg-gradient-to-br ${card.bg} rounded-2xl shadow-lg p-5 text-white`}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm opacity-80">{card.title}</div>
                <div className="text-3xl font-bold mt-1">{card.value}</div>
              </div>
              <div className="bg-white/20 p-2 rounded-lg">
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-500" />
            Game Status Distribution
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <div 
                className="w-40 h-40 rounded-full shadow-inner"
                style={{
                  background: makeDonutGradient([
                    { color: '#34D399', value: statusCounts.active || 0 },
                    { color: '#F59E0B', value: statusCounts.paused || 0 },
                    { color: '#EF4444', value: statusCounts.ended || 0 },
                    { color: '#9CA3AF', value: statusCounts.setup || 0 },
                  ]),
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold dark:text-white">
                  {games.length}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 min-w-[180px]">
              {[
                { label: 'Active', value: statusCounts.active || 0, color: 'bg-green-400' },
                { label: 'Paused', value: statusCounts.paused || 0, color: 'bg-yellow-500' },
                { label: 'Ended', value: statusCounts.ended || 0, color: 'bg-red-500' },
                { label: 'Setup', value: statusCounts.setup || 0, color: 'bg-gray-400' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className={`w-3 h-3 mr-2 rounded-full ${item.color}`}></span>
                  <div>
                    <div className="font-medium dark:text-white">{item.value}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-300">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Average Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center">
            <BarChart2 className="w-5 h-5 mr-2 text-purple-500" />
            Average Calls per Game Type
          </h3>
          <div className="space-y-4">
            {avgCallsByRange.map(({ range, avg }) => (
              <div key={range} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium dark:text-gray-300">Range {range}</span>
                  <span className="font-bold dark:text-white">{avg.toFixed(1)}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full"
                    style={{ width: `${Math.min(100, (avg / Math.max(1, avgCallsOverall)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {avgCallsByRange.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fastest Games */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center">
            <Award className="w-5 h-5 mr-2 text-green-500" />
            Top 5 Fastest Games
          </h3>
          <div className="space-y-3">
            {fastestGames.map((g, idx) => (
              <div 
                key={g.id} 
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg mr-3">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium dark:text-white">{g.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">ID: {g.id.slice(0, 8)}</div>
                  </div>
                </div>
                <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {formatDuration(g.durationMs)}
                </div>
              </div>
            ))}
            {fastestGames.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No completed games
              </div>
            )}
          </div>
        </div>

        {/* Slowest Games */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center">
            <Clock className="w-5 h-5 mr-2 text-amber-500" />
            Top 5 Slowest Games
          </h3>
          <div className="space-y-3">
            {slowestGames.map((g, idx) => (
              <div 
                key={g.id} 
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg mr-3">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium dark:text-white">{g.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">ID: {g.id.slice(0, 8)}</div>
                  </div>
                </div>
                <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {formatDuration(g.durationMs)}
                </div>
              </div>
            ))}
            {slowestGames.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No completed games
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Claims Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold dark:text-white flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-indigo-500" />
            Claims Analytics
          </h3>
          {!claimsAvailable && (
            <div className="flex items-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-full text-sm">
              <AlertTriangle size={16} className="mr-2"/> 
              Claims table not available
            </div>
          )}
        </div>

        {claimsAvailable && (
          <div className="space-y-8">
            {/* Claims Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5">
                <h4 className="font-bold mb-4 dark:text-white">Claims by Status</h4>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="relative">
                    <div 
                      className="w-32 h-32 rounded-full shadow-inner"
                      style={{
                        background: makeDonutGradient([
                          { color: '#60A5FA', value: claimsByStatus.pending || 0 },
                          { color: '#10B981', value: claimsByStatus.valid || 0 },
                          { color: '#EF4444', value: claimsByStatus.invalid || 0 },
                        ]),
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-bold dark:text-white">
                        {Object.values(claimsByStatus).reduce((a, b) => a + b, 0)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 min-w-[150px]">
                    {[
                      { label: 'Pending', value: claimsByStatus.pending || 0, color: 'bg-blue-400' },
                      { label: 'Valid', value: claimsByStatus.valid || 0, color: 'bg-green-500' },
                      { label: 'Invalid', value: claimsByStatus.invalid || 0, color: 'bg-red-500' }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center">
                        <span className={`w-3 h-3 mr-3 rounded-full ${item.color}`}></span>
                        <div>
                          <div className="font-medium dark:text-white">{item.value}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-300">{item.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Most Claimed Patterns */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5">
                <h4 className="font-bold mb-4 dark:text-white">Most Claimed Patterns</h4>
                <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                  {mostClaimedPatterns.map(({ pattern_id, count }, idx) => (
                    <div key={pattern_id} className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <div className="flex items-center">
                          <div className="w-6 h-6 flex items-center justify-center bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded mr-2">
                            {idx + 1}
                          </div>
                          <span className="font-medium dark:text-gray-300 truncate max-w-[120px]">
                            {pattern_id}
                          </span>
                        </div>
                        <span className="font-bold dark:text-white">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full" 
                          style={{ width: `${Math.min(100, count * 10)}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                  {mostClaimedPatterns.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      No claims data
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Claims Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Games by Claims */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5">
                <h4 className="font-bold mb-4 dark:text-white">Top Games by Claims</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {claimsPerGame.map((g, idx) => (
                    <div 
                      key={g.game_id} 
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg mr-3">
                          {idx + 1}
                        </div>
                        <div className="text-sm font-medium dark:text-gray-300 truncate max-w-[120px]">
                          {g.game_id}
                        </div>
                      </div>
                      <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {g.count}
                      </div>
                    </div>
                  ))}
                  {claimsPerGame.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      No claims data
                    </div>
                  )}
                </div>
              </div>

              {/* Validation Time */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5">
                <h4 className="font-bold mb-4 dark:text-white">Average Validation Time</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {avgValidationTimePerGame.map((g, idx) => (
                    <div 
                      key={g.game_id} 
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg mr-3">
                          {idx + 1}
                        </div>
                        <div className="text-sm font-medium dark:text-gray-300 truncate max-w-[120px]">
                          {g.game_id}
                        </div>
                      </div>
                      <div className="bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {formatDuration(g.avgMs)}
                      </div>
                    </div>
                  ))}
                  {avgValidationTimePerGame.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      No validation data
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;