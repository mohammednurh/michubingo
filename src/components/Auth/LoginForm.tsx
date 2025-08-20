import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, LogIn, Sparkles, Smartphone, Laptop, User, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LoginFormProps {
  onSwitchToSignup: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState({ email: false, password: false });

  const { signIn, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // signIn successful, wait for userProfile to be loaded
    // Then navigate based on role
  };

  // Watch userProfile, redirect when it's available after successful login
  useEffect(() => {
    if (userProfile) {
      if (userProfile.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (userProfile.role === 'cashier') {
        navigate('/cashier/create-game');
      } else {
        // default or unknown role redirect (optional)
        navigate('/');
      }
    }
  }, [userProfile, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20 animate-pulse"
            style={{
              width: `${Math.random() * 200 + 100}px`,
              height: `${Math.random() * 200 + 100}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: `radial-gradient(circle, ${i % 2 === 0 ? 'rgb(167, 139, 250)' : 'rgb(253, 230, 138)'}, transparent)`,
              animationDuration: `${Math.random() * 10 + 15}s`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white opacity-10"
            style={{
              width: `${Math.random() * 10 + 2}px`,
              height: `${Math.random() * 10 + 2}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `float ${Math.random() * 20 + 10}s infinite ease-in-out`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md">
        {/* Glass morphism container */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
          {/* Decorative header */}
          <div className="relative h-2 bg-gradient-to-r from-violet-600 to-amber-500">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-amber-500 opacity-70 animate-pulse"></div>
          </div>
          
          <div className="p-8">
            {/* Logo and title section */}
            <div className="text-center mb-8">
              <div className="relative inline-flex mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-amber-500 rounded-full blur opacity-30 animate-pulse"></div>
                <div className="relative w-16 h-16 bg-gradient-to-r from-violet-600 to-amber-500 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-white font-bold text-2xl">B</span>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Ethiopian Bingo</h1>
              <p className="text-gray-300">Sign in to continue your experience</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-400/10 backdrop-blur border border-red-400/20 rounded-xl p-4 text-red-200 text-sm flex items-start">
                  <Shield className="flex-shrink-0 mr-2 mt-0.5" size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="relative">
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className={`relative transition-all duration-300 ${isFocused.email ? 'transform scale-[1.01]' : ''}`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/30 to-amber-500/30 rounded-xl blur opacity-0 transition-opacity duration-300 hover:opacity-50"></div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsFocused({...isFocused, email: true})}
                    onBlur={() => setIsFocused({...isFocused, email: false})}
                    className="relative w-full px-4 py-3 bg-gray-800/60 border border-gray-700/50 rounded-xl focus:ring-2 focus:ring-amber-400/50 focus:border-transparent placeholder-gray-500 text-white"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div className="relative">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className={`relative transition-all duration-300 ${isFocused.password ? 'transform scale-[1.01]' : ''}`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/30 to-amber-500/30 rounded-xl blur opacity-0 transition-opacity duration-300 hover:opacity-50"></div>
                  <div className="relative flex items-center">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setIsFocused({...isFocused, password: true})}
                      onBlur={() => setIsFocused({...isFocused, password: false})}
                      className="w-full px-4 py-3 pr-12 bg-gray-800/60 border border-gray-700/50 rounded-xl focus:ring-2 focus:ring-amber-400/50 focus:border-transparent placeholder-gray-500 text-white"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-gray-400 hover:text-amber-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden group bg-gradient-to-r from-violet-600 to-amber-500 text-white py-3.5 rounded-xl font-medium transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                {loading ? (
                  <div className="relative flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="relative flex items-center space-x-2">
                    <LogIn size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                    <span>Sign In</span>
                  </div>
                )}
                <Sparkles className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" size={16} />
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={onSwitchToSignup}
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors duration-300 hover:underline"
              >
                Don't have an account? Sign up
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700/30">
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-4">Access from any device</p>
                <div className="flex justify-center space-x-6">
                  <div className="flex items-center text-gray-400">
                    <Smartphone size={16} className="mr-1" />
                    <span className="text-xs">Mobile</span>
                  </div>
                  <div className="flex items-center text-gray-400">
                    <Laptop size={16} className="mr-1" />
                    <span className="text-xs">Desktop</span>
                  </div>
                  <div className="flex items-center text-gray-400">
                    <User size={16} className="mr-1" />
                    <span className="text-xs">Tablet</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
      `}</style>
    </div>
  );
};

export default LoginForm;