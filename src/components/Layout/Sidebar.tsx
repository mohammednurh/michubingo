import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Play, Users, BarChart3, Settings, 
  TowerControl as GameController2, Trophy, History, Grid, 
  ChevronLeft, ChevronRight 
} from 'lucide-react'; // added chevrons for toggle
import { useAuth } from '../../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { userProfile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const adminMenuItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/games', icon: History, label: 'Game History' },
    { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/admin/bingo-cards', icon: Grid, label: 'Bingo Cards' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const cashierMenuItems = [
    { to: '/cashier/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/cashier/create-game', icon: Play, label: 'Create Game' },
    { to: '/cashier/active-games', icon: GameController2, label: 'Active Games' },
    { to: '/cashier/history', icon: History, label: 'My Games' },
  ];

  const menuItems = userProfile?.role === 'admin' ? adminMenuItems : cashierMenuItems;

  return (
    <div
      className={`bg-white dark:bg-gray-900 min-h-screen shadow-sm border-r border-gray-200 dark:border-gray-700 flex flex-col 
        ${collapsed ? 'w-16' : 'w-64'} 
        transition-width duration-300 relative`}
      style={{ transitionProperty: 'width' }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-4 right-[-12px] bg-white dark:bg-white-800 border border-gray-300 dark:border-gray-600 rounded-full p-1 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      <div className={`p-6 flex-grow overflow-y-auto`}>
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-r-4 border-green-500'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <item.icon size={20} />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Player Access */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700">
        <NavLink
          to="/player"
          className={`flex items-center justify-center space-x-2 w-full px-4 py-3 bg-gradient-to-r from-green-500 to-yellow-500 text-white rounded-lg hover:from-green-600 hover:to-yellow-600 transition-all shadow-md ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Trophy size={20} />
          {!collapsed && <span className="font-medium">Player Mode</span>}
        </NavLink>
      </div>
    </div>
  );
};

export default Sidebar;
