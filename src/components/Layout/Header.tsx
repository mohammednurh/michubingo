import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut,
  User,
  Eye,
  EyeOff,
  PanelRightClose,
  PanelRightOpen,
  Sun,
  Moon,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDarkMode } from '../../contexts/DarkModeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../lib/supabase';

const Header: React.FC = () => {
  const { userProfile, signOut } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { commissionRate, minBettingAmount } = useSettings();

  // Kiosk mode
  const [isVisible, setIsVisible] = useState(true);

  // Balance (cashier only)
  const [showBalance, setShowBalance] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState(0);

  // Notification state
  const [notification, setNotification] = useState<{ 
    message: string; 
    type: 'warning' | 'critical' 
  } | null>(null);
  const notificationTimer = useRef<NodeJS.Timeout | null>(null);
  const lastNotificationTime = useRef<number>(0);

  // Fetch balance from DB (cashier only)
  useEffect(() => {
    const fetchBalance = async () => {
      if (!userProfile?.id || userProfile.role !== 'cashier') return;
      const { data, error } = await supabase
        .from('users')
        .select('subscription_price_birr')
        .eq('id', userProfile.id)
        .single();
      if (!error) setBalance(data?.subscription_price_birr ?? 0);
    };
    fetchBalance();
  }, [userProfile]);

  // Fetch total profit from all games (cashier only)
  useEffect(() => {
    const fetchProfit = async () => {
      if (!userProfile?.id || userProfile.role !== 'cashier') return;

      const { data: games, error } = await supabase
        .from('games')
        .select('selected_cards, betting_amount_birr')
        .eq('host_id', userProfile.id)
        .in('status', ['active', 'paused', 'ended']);

      if (error) {
        console.error(error);
        return;
      }

      const profit = (games || []).reduce((sum, game) => {
        const playerNumber = game.selected_cards?.length || 0;
        const betAmount = game.betting_amount_birr || 0;
        return sum + playerNumber * betAmount * commissionRate;
      }, 0);

      setTotalProfit(profit);
    };

    fetchProfit();
  }, [userProfile, commissionRate]);

  // Deduct total profit from balance
  const displayedBalance = balance !== null ? balance - totalProfit : null;

  // Minimum profit threshold derived from settings (commission * min 1 card * min bet)
  const MIN_PROFIT = commissionRate * (1 * minBettingAmount);

  // Check and show notifications
  useEffect(() => {
    if (userProfile?.role !== 'cashier' || balance === null) return;

    const now = Date.now();

    // Prevent spamming (1 hr interval between notifications)
    if (now - lastNotificationTime.current < 60 * 60 * 1000) return;

    const fiftyPercent = balance * 0.5;

    if (displayedBalance !== null) {
      if (displayedBalance <= MIN_PROFIT) {
        showNotification(
          `Dear ${userProfile.full_name}, you are running out of subscription. Please subscribe now.`,
          'critical'
        );
      } else if (displayedBalance <= fiftyPercent) {
        showNotification(
          `Dear ${userProfile.full_name}, you have already used 50% of your subscription. Please buy a new subscription.`,
          'warning'
        );
      }
    }
  }, [displayedBalance, balance, userProfile]);

  // Show notification function
  const showNotification = (message: string, type: 'warning' | 'critical') => {
    setNotification({ message, type });
    lastNotificationTime.current = Date.now();

    // Auto-close after 5 seconds
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    notificationTimer.current = setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-2 right-2 p-2 bg-gray-300 dark:bg-white-700 rounded-lg"
        title="Show Header (Kiosk Mode)"
      >
        <PanelRightOpen size={20} />
      </button>
    );
  }

  return (
    <>
      {/* Enhanced Notification Modal */}
      {notification && (
        <div 
          className={`fixed top-4 right-4 z-50 max-w-md w-full shadow-xl rounded-lg p-4 border-2 ${
            notification.type === 'critical' 
              ? 'bg-gradient-to-r from-red-500 to-orange-500 border-red-300 animate-pulse' 
              : 'bg-gradient-to-r from-yellow-500 to-orange-500 border-yellow-300'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-start">
              <AlertTriangle 
                size={24} 
                className="text-white mr-3 flex-shrink-0" 
              />
              <div>
                <h3 className="font-bold text-white text-lg flex items-center">
                  Subscription Alert
                </h3>
                <p className="text-white font-medium mt-2 text-base">
                  {notification.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-white hover:text-gray-200 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-yellow-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Ethiopian Bingo
              </h1>
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {/* Kiosk Mode */}
              <button
                onClick={() => setIsVisible(false)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Hide Header (Kiosk Mode)"
              >
                <PanelRightClose size={20} />
              </button>

              {/* Balance (cashier only) */}
              {userProfile?.role === 'cashier' && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Balance:
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {showBalance
                      ? displayedBalance !== null
                        ? `Birr ${displayedBalance.toFixed(2)}`
                        : 'Loading...'
                      : '••••••'}
                  </span>
                  <button
                    onClick={() => setShowBalance((prev) => !prev)}
                    className="p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    title={showBalance ? 'Hide Balance' : 'Show Balance'}
                  >
                    {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}

              {/* User info */}
              {userProfile && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <User size={16} className="text-gray-600 dark:text-gray-300" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {userProfile.full_name}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${
                        userProfile.role === 'admin'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {userProfile.role.charAt(0).toUpperCase() +
                        userProfile.role.slice(1)}
                    </span>
                  </div>

                  {/* Logout always visible */}
                  <button
                    onClick={signOut}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Sign Out"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;