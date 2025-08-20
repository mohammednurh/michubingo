import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import AuthContainer from './components/Auth/AuthContainer';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import UserManagement from './components/Admin/UserManagement';
import GameSetup from './components/Cashier/GameSetup';
import GameHost from './components/Cashier/GameHost';
import PlayerInterface from './components/Player/PlayerInterface';
import GamePlay from './components/Player/GamePlay';
import BingoCards from './components/Admin/BingoCards';
import GameHistory from './components/Cashier/GameHistory';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminGameHistory from './components/Admin/AdminGameHistory';
import AdminAnalytics from './components/Admin/AdminAnalytics';
import AdminSettings from './components/Admin/AdminSettings';

const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: string }> = ({ 
  children, 
  role 
}) => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <AuthContainer />;
  }

  if (role && userProfile.role !== role) {
    return <Navigate to={userProfile.role === 'admin' ? '/admin/dashboard' : '/cashier/dashboard'} />;
  }

  return <>{children}</>;
};

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};


const CashierDashboard = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900">Cashier Dashboard</h1>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">My Active Games</h3>
        <p className="text-3xl font-bold text-green-600">2</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Games Hosted</h3>
        <p className="text-3xl font-bold text-blue-600">15</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Players</h3>
        <p className="text-3xl font-bold text-yellow-600">89</p>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <DarkModeProvider>
      <AuthProvider>
        <SettingsProvider>
        <Router>
          <Routes>
            {/* Player Routes (No Auth Required) */}
            <Route path="/player" element={<PlayerInterface />} />
            <Route path="/player/game/:gameId" element={<GamePlay />} />
            
            {/* Admin Routes */}
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute role="admin">
                  <DashboardLayout>
                    <AdminDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/analytics" 
              element={
                <ProtectedRoute role="admin">
                  <DashboardLayout>
                    <AdminAnalytics />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/settings" 
              element={
                <ProtectedRoute role="admin">
                  <DashboardLayout>
                    <AdminSettings />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/games" 
              element={
                <ProtectedRoute role="admin">
                  <DashboardLayout>
                    <AdminGameHistory />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute role="admin">
                  <DashboardLayout>
                    <UserManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
              <Route 
              path="/admin/bingo-cards" 
              element={
                <ProtectedRoute role="admin">
                  <DashboardLayout>
                    <BingoCards />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/*" 
              element={
                <ProtectedRoute role="admin">
                  <DashboardLayout>
                    <div>Admin feature coming soon...</div>
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            {/* Cashier Routes */}
            <Route 
              path="/cashier/dashboard" 
              element={
                <ProtectedRoute role="cashier">
                  <DashboardLayout>
                    <CashierDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cashier/create-game" 
              element={
                <ProtectedRoute role="cashier">
                  <DashboardLayout>
                    <GameSetup />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cashier/game/:gameId" 
              element={
                <ProtectedRoute role="cashier">
                  <DashboardLayout>
                    <GameHost />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cashier/history" 
              element={
                <ProtectedRoute role="cashier">
                  <DashboardLayout>
                    <GameHistory />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cashier/*" 
              element={
                <ProtectedRoute role="cashier">
                  <DashboardLayout>
                    <div>Cashier feature coming soon...</div>
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            {/* Auth Routes */}
            <Route path="/login" element={<AuthContainer />} />
            
            {/* Default Redirects */}
            <Route path="/" element={<DefaultRoute />} />
          </Routes>
        </Router>
        </SettingsProvider>
      </AuthProvider>
    </DarkModeProvider>
  );
}

const DefaultRoute: React.FC = () => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <AuthContainer />;
  }

  // Redirect authenticated users to their appropriate dashboard
  if (userProfile.role === 'admin') {
    return <Navigate to="/admin/dashboard" />;
  } else if (userProfile.role === 'cashier') {
    return <Navigate to="/cashier/dashboard" />;
  }

  return <Navigate to="/player" />;
};

export default App;