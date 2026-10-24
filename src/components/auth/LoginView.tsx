import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  User 
} from 'lucide-react';
import { ResetPasswordModal } from './ResetPasswordModal';

export const LoginView: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError('');
    const res = await loginWithGoogle();
    setIsGoogleLoading(false);
    if (!res.success) {
      setError(res.error || 'Innlogging feilet.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      setError('Oppgi brukernavn eller e-post');
      return;
    }
    if (!password) {
      setError('Oppgi passord');
      return;
    }

    setIsLoading(true);
    setError('');

    const res = await login(identifier, password);
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Feil brukernavn eller passord.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-base shadow-xs mx-auto mb-2">
            T1
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Tid1Din
          </h1>
        </div>

        {/* Innloggingskort */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successInfo}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Brukernavn eller e-post
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Brukernavn eller e-post"
                  autoComplete="username"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-all"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">
                  Passord
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessInfo('');
                    setIsResetPasswordOpen(true);
                  }}
                  className="text-xs text-sky-600 hover:text-sky-700 font-medium"
                >
                  Glemt passord?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
            >
              {isLoading ? 'Logger inn...' : 'Logg inn'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-200/80 w-full" />
            <span className="bg-white px-2.5 text-[11px] text-slate-400 font-medium">eller</span>
            <div className="border-t border-slate-200/80 w-full" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-medium transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{isGoogleLoading ? 'Kobler til...' : 'Logg inn med Google'}</span>
          </button>
        </div>

      </div>

      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        onPasswordResetSuccess={(resetIdentifier) => {
          setIdentifier(resetIdentifier);
          setPassword('');
          setSuccessInfo('Passordet ble tilbakestilt. Du kan nå logge inn.');
        }}
      />
    </div>
  );
};
