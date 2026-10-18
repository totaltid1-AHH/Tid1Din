import React, { useState } from 'react';
import { dbService } from '../../services/db';
import { smsService } from '../../services/sms';
import { UserProfile } from '../../types';
import { 
  KeyRound, 
  Smartphone, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Eye, 
  EyeOff, 
  RefreshCw,
  ShieldCheck
} from 'lucide-react';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordResetSuccess?: (identifier: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  onPasswordResetSuccess
}) => {
  const [step, setStep] = useState<'input_identifier' | 'verify_and_new_password' | 'success'>('input_identifier');
  
  // Trinn 1: Søk etter bruker
  const [identifier, setIdentifier] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Trinn 2: Verifisering & nytt passord
  const [matchedUser, setMatchedUser] = useState<UserProfile | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeExpiresAt, setCodeExpiresAt] = useState<number>(0);
  const [isSimulatedSms, setIsSimulatedSms] = useState(false);

  const [inputCode, setInputCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    // Tilbakestill tilstand ved lukking
    setStep('input_identifier');
    setIdentifier('');
    setError('');
    setMatchedUser(null);
    setInputCode('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  // Masker telefonnummer for personvern, f.eks. "98822000" -> "+47 98 •• •• 00"
  const maskPhone = (phone?: string) => {
    if (!phone) return 'ukjent nummer';
    const clean = phone.replace(/\s+/g, '');
    if (clean.length === 8) {
      return `+47 ${clean.substring(0, 2)} •• •• ${clean.substring(6)}`;
    }
    return `+47 ••• •• ${clean.slice(-3)}`;
  };

  // Generer en 6-sifret kode og send SMS
  const sendVerificationSms = async (user: UserProfile) => {
    if (!user.phone) {
      throw new Error(`Brukeren ${user.displayName} har ikke registrert mobilnummer i systemet. Kontakt klinikkadmin for manuell tilbakestilling.`);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutter gyldighet

    const message = `Tid1Din: Din engangskode for å tilbakestille passord er ${code}. Koden er gyldig i 10 minutter.`;
    const res = await smsService.sendSms(user.phone, message, 'custom');

    setGeneratedCode(code);
    setCodeExpiresAt(expires);
    setIsSimulatedSms(res.status === 'simulated');
    setMatchedUser(user);
    setStep('verify_and_new_password');
  };

  // Håndter innsending av brukernavn / telefon / e-post
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Vennligst oppgi brukernavn, e-post eller mobilnummer');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const users = await dbService.getUsers(true);
      const cleanIdent = identifier.trim().toLowerCase();
      const cleanPhoneSearch = cleanIdent.replace(/\s+/g, '').replace(/^\+47/, '');

      const found = users.find(u => {
        const emailMatch = u.email && u.email.toLowerCase() === cleanIdent;
        const usernameMatch = u.username && u.username.toLowerCase() === cleanIdent;
        const phoneMatch = u.phone && u.phone.replace(/\s+/g, '').replace(/^\+47/, '') === cleanPhoneSearch;
        return emailMatch || usernameMatch || phoneMatch;
      });

      if (!found) {
        setError('Fant ingen bruker med dette brukernavnet, e-posten eller mobilnummeret.');
        setIsSearching(false);
        return;
      }

      await sendVerificationSms(found);
    } catch (err: any) {
      setError(err.message || 'Kunne ikke sende SMS-engangskode.');
    } finally {
      setIsSearching(false);
    }
  };

  // Send koden på nytt
  const handleResendCode = async () => {
    if (!matchedUser) return;
    setIsSearching(true);
    setError('');
    try {
      await sendVerificationSms(matchedUser);
    } catch (err: any) {
      setError(err.message || 'Kunne ikke sende koden på nytt.');
    } finally {
      setIsSearching(false);
    }
  };

  // Fullfør passord-reset
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedUser) return;

    if (!inputCode.trim()) {
      setError('Vennligst oppgi 6-sifret kode fra SMS.');
      return;
    }

    if (Date.now() > codeExpiresAt) {
      setError('Engangskoden er utløpt (gyldig i 10 minutter). Be om ny kode.');
      return;
    }

    if (inputCode.trim() !== generatedCode) {
      setError('Feil engangskode. Sjekk SMS-en og prøv igjen.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Det nye passordet må være på minst 6 tegn.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passordene stemmer ikke overens.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const updatedUser: UserProfile = {
        ...matchedUser,
        password: newPassword,
        updatedAt: new Date().toISOString()
      };

      await dbService.saveUser(updatedUser);
      await dbService.logAction(
        { uid: matchedUser.uid, email: matchedUser.email, role: matchedUser.role },
        'password_reset_sms',
        `Passord tilbakestilt via SMS-verifisering for ${matchedUser.displayName}`
      );

      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Kunne ikke oppdatere passord.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    const ident = matchedUser?.username || matchedUser?.email || '';
    handleClose();
    if (onPasswordResetSuccess && ident) {
      onPasswordResetSuccess(ident);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 space-y-4">
        
        {/* Lukkeknapp */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TITTEL / HEADER */}
        <div className="text-center space-y-1.5 pb-2 border-b border-slate-100">
          <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner">
            <Smartphone className="w-6 h-6" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            Tilbakestill passord via SMS
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {step === 'input_identifier' && 'Oppgi ditt brukernavn, e-post eller mobilnummer for å motta en engangskode.'}
            {step === 'verify_and_new_password' && 'Oppgi koden mottatt på SMS og velg ditt nye passord.'}
            {step === 'success' && 'Ditt nye passord er lagret og klart til bruk.'}
          </p>
        </div>

        {/* FEILMELDING */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* TRINN 1: IDENTIFISER BRUKER */}
        {step === 'input_identifier' && (
          <form onSubmit={handleRequestCode} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Brukernavn, e-post eller mobilnummer
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="f.eks. jonas eller 98822000"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Koden sendes til mobilnummeret som er registrert på kontoen din.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={isSearching}
                className="w-2/3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSearching ? 'Søker & sender...' : 'Send SMS-kode'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* TRINN 2: VERIFISER KODE & OPPGI NYTT PASSORD */}
        {step === 'verify_and_new_password' && matchedUser && (
          <form onSubmit={handleResetSubmit} className="space-y-3.5 pt-1">
            
            {/* Informasjon om mottaker */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <p>
                Bruker: <strong className="text-slate-800">{matchedUser.displayName}</strong>
              </p>
              <p>
                SMS sendt til: <strong className="text-slate-800">{maskPhone(matchedUser.phone)}</strong>
              </p>
            </div>

            {/* DEMO / SIMULERINGSHINT HVIS IKKE LIVE GATEWAY-NØKKEL ER LAGT INN */}
            {isSimulatedSms && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between">
                <span>Demo-modus: Simulert SMS-kode: <strong className="font-mono text-sm font-bold text-amber-900">{generatedCode}</strong></span>
                <button
                  type="button"
                  onClick={() => setInputCode(generatedCode)}
                  className="text-[11px] font-bold text-amber-900 underline hover:text-amber-950 ml-2"
                >
                  Fyll ut
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                6-sifret engangskode fra SMS
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  required
                  maxLength={6}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.3em] font-mono text-xl font-bold py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Nytt passord (minst 6 tegn)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Gjenta nytt passord
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isSearching}
                className="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 hover:underline"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
                <span>Send kode på nytt</span>
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('input_identifier')}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Tilbake
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Lagrer passord...' : 'Lagre nytt passord'}
              </button>
            </div>
          </form>
        )}

        {/* TRINN 3: SUKSESS */}
        {step === 'success' && (
          <div className="space-y-4 pt-2 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-900">
                Passordet er oppdatert!
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Ditt nye passord er lagret og du kan nå logge inn med din bruker og det nye passordet.
              </p>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Gå til innlogging</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
