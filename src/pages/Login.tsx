import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

const DEFAULT_USERNAME = 'userthenperson';
const DEFAULT_PASSWORD = 'thenperson20261234';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate a brief loading delay to feel more professional
    setTimeout(() => {
      if (username.trim() === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
        sessionStorage.setItem('isAuthenticated', 'true');
        onLogin();
      } else {
        setError('Usuário ou senha incorretos.');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-purple-900 via-slate-900 to-indigo-950 relative overflow-hidden font-sans">
      {/* Background blobs for premium depth effect */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] rounded-full bg-pink-600/20 blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-md p-8 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative z-10 mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            InstaManager
          </h1>
          <p className="text-slate-400 text-sm">Área Restrita • Faça login para acessar o painel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm transition-all duration-300">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300" htmlFor="username">
              Usuário
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <User size={18} />
              </span>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock size={18} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-purple-500/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Entrar no Painel'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500 border-t border-white/5 pt-4">
          Usuário: <code className="bg-white/5 px-1.5 py-0.5 rounded text-purple-400 font-mono">userthenperson</code> | Senha: <code className="bg-white/5 px-1.5 py-0.5 rounded text-purple-400 font-mono">thenperson20261234</code>
        </div>
      </div>
    </div>
  );
};

export default Login;
