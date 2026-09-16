import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Clock, 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  UserPlus, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, registerClient } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Registrering modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Vennligst oppgi en e-postadresse');
      return;
    }

    setIsLoading(true);
    setError('');

    const res = await login(email, password);
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Innlogging feilet. Vennligst sjekk opplysningene.');
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
      // Logg inn med den nye klienten
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
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">Logg inn</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              2FA Beskyttet
            </span>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                E-postadresse / Brukernavn
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din.epost@eksempel.no"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Passord
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
              {isLoading ? 'Logger inn...' : 'Fortsett med 2FA'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Hurtig-demo innlogging for enkel test */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Hurtigvalg for testing:
              </span>
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('hovedadmin@dintid.no')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition-colors"
              >
                <p className="font-bold text-slate-800 truncate">Hovedadmin</p>
                <p className="text-[10px] text-indigo-600">Full tilgang</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin.jonas@dintid.no')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-left transition-colors"
              >
                <p className="font-bold text-slate-800 truncate">Terapeut (Admin)</p>
                <p className="text-[10px] text-amber-600">Med innsyn</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin.eva@dintid.no')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 text-left transition-colors"
              >
                <p className="font-bold text-slate-800 truncate">Vikar (Admin)</p>
                <p className="text-[10px] text-rose-600">Skjult navn/tlf</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('ola.hansen@eksempel.no')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-left transition-colors"
              >
                <p className="font-bold text-slate-800 truncate">Ola Hansen</p>
                <p className="text-[10px] text-emerald-600">Klient #1000</p>
              </button>
            </div>
          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setIsRegisterOpen(true)}
              className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
            >
              Ny klient? Registrer deg her &rarr;
            </button>
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
                Du vil automatisk bli tildelt et kundenummer som starter på 1000.
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
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Mobiltelefon (for SMS-varsler)</label>
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
                  Opprett & Logg inn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
