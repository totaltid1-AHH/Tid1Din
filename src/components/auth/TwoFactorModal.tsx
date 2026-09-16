import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, KeyRound, AlertCircle, X } from 'lucide-react';

export const TwoFactorModal: React.FC = () => {
  const { is2FAModalOpen, pendingUser, verify2FA, cancel2FA } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!is2FAModalOpen || !pendingUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Vennligst skriv inn 2FA-koden');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const success = await verify2FA(code);
    setIsSubmitting(false);

    if (!success) {
      setError('Ugyldig 2FA-kode. Prøv igjen.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8">
        
        <button
          onClick={cancel2FA}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">2-faktor autentisering</h3>
          <p className="text-sm text-slate-600 mt-1">
            Tid1Din krever ekstra sikkerhetsbekreftelse for å beskytte sensitive pasient- og klientdata.
          </p>
          <p className="text-xs font-semibold text-slate-500 mt-2 bg-slate-50 py-1.5 px-3 rounded-lg inline-block border border-slate-200">
            Logget inn som: <span className="text-slate-800">{pendingUser.displayName}</span>
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Engangskode (6 siffer)
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-800 placeholder:text-slate-300"
              />
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-4 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Testkode: <strong className="text-sky-700 font-mono">123456</strong></span>
            <button
              type="button"
              onClick={() => setCode('123456')}
              className="text-sky-600 hover:text-sky-800 font-semibold hover:underline"
            >
              Fyll ut testkode
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={cancel2FA}
              className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-1/2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-md shadow-sky-600/20 transition-all text-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Verifiserer...' : 'Bekreft & Logg inn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
