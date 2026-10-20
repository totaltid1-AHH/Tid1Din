import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Clock, 
  Lock, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  User
} from 'lucide-react';
import { ResetPasswordModal } from './ResetPasswordModal';

export const LoginView: React.FC = () => {
  const { login, loginWithGoogle, registerClient } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  // Registrering modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError('');
    const res = await loginWithGoogle();
    setIsGoogleLoading(false);
    if (!res.success) {
      setError(res.error || 'Google-innlogging feilet.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      setError('Vennligst oppgi brukernavn eller e-post');
      return;
    }
    if (!password) {
      setError('Vennligst oppgi passord');
      return;
    }

    setIsLoading(true);
    setError('');

    const res = await login(identifier, password);
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Innlogging feilet. Sjekk brukernavn og passord.');
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string) => {
    setIsLoading(true);
    setError('');
    const res = await login(demoEmail);
    setIsLoading(false);
    if (!res.success) {
      setError(res.error || 'Feil ved demo-innlogging');
    }
  };

  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail) {
      setError('Navn og e-post er påkrevd.');
      return;
    }

    setIsLoading(true);
    try {
      const newClient = await registerClient({
        displayName: regName,
        email: regEmail,
        phone: regPhone,
        address: regAddress,
        birthDate: regBirthDate
      });

      setIsRegisterOpen(false);
      await login(newClient.email);
    } catch (e: any) {
      setError(e.message || 'Kunne ikke registrere klient');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-sky-600/20 mx-auto">
            <Clock className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Tid1Din
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Sikkert kundeoppfølgings- og bookingsystem
          </p>
        </div>

        {/* Innloggingskort */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl shadow-slate-200/50 space-y-5">
          
          <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">Logg inn</h2>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successInfo}</span>
            </div>
          )}

          {/* Google innlogging for super-admin */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 text-slate-800 text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-3 disabled:opacity-50 group"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
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
              <span>{isGoogleLoading ? 'Kobler til Google...' : 'Logg inn med Google (Super-admin)'}</span>
            </button>
            <p className="text-[11px] text-center text-slate-400">
              Forhåndsgodkjent: <strong className="text-slate-600 font-semibold">total.tid1@gmail.com</strong>
            </p>
          </div>

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[10px] text-slate-400 uppercase font-bold tracking-wider">eller klinikkbruker</span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Brukernavn eller e-post
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="brukernavn eller e-post"
                  autoComplete="username"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Passord
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessInfo('');
                    setIsResetPasswordOpen(true);
                  }}
                  className="text-xs text-sky-600 hover:text-sky-800 font-semibold hover:underline"
                >
                  Glemt passord? (SMS)
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? 'Logger inn...' : 'Logg inn'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Hurtig-demo innlogging */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Demo-brukere (passord: demo1234)
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('total.tid1@gmail.com')}
                className="p-2.5 rounded-xl border border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50 text-left transition-colors"
              >
                <p className="font-bold text-slate-900 truncate">Total – Super-admin</p>
                <p className="text-[10px] text-indigo-700 font-semibold">Google / Flerbedrift</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('hovedadmin@dintid.no')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition-colors"
              >
                <p className="font-bold text-slate-800 truncate">Kari – Hovedadmin</p>
                <p className="text-[10px] text-indigo-600">Hovden · Full tilgang</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin.jonas@dintid.no')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-left transition-colors"
              >
                <p className="font-bold text-slate-800 truncate">Jonas – Terapeut</p>
                <p className="text-[10px] text-amber-600">Med innsyn</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin.eva@dintid.no')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 text-left transition-colors"
              >
                <p className="font-bold text-slate-800 truncate">Eva – Vikar</p>
                <p className="text-[10px] text-rose-600">Skjult navn/tlf</p>
              </button>
            </div>
          </div>

          <div className="pt-2 text-center">
            <span className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg inline-block">
              Klient-innlogging er satt på pause. Systemet er for terapeuter og klinikk.
            </span>
          </div>

        </div>

      </div>

      {/* REGISTRER NY KLIENT MODAL */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Registrer ny klient</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Du tildeles et kundenummer automatisk.
              </p>
            </div>

            <form onSubmit={handleRegisterClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Fullt navn *</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Kari Tveit"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">E-post *</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="kari@eksempel.no"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Mobiltelefon</label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="98765432"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Adresse</label>
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Gateveien 2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Fødselsdato</label>
                  <input
                    type="date"
                    value={regBirthDate}
                    onChange={(e) => setRegBirthDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-1/2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20"
                >
                  Opprett &amp; Logg inn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TILBAKESTILL PASSORD VIA SMS MODAL */}
      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        onPasswordResetSuccess={(resetIdentifier) => {
          setIdentifier(resetIdentifier);
          setPassword('');
          setSuccessInfo('Passordet ditt ble tilbakestilt! Du kan nå logge inn med ditt nye passord.');
        }}
      />

    </div>
  );
};
