import React, { useState } from 'react';
import { dbService } from '../../services/db';
import { smsService } from '../../services/sms';
import { hashPassword, verifyPassword } from '../../utils/crypto';
import { UserProfile } from '../../types';
import { 
  Smartphone, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Eye, 
  EyeOff, 
  RefreshCw,
  KeyRound,
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
  const [resetId, setResetId] = useState<string>('');
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [localFallbackCode, setLocalFallbackCode] = useState<string | null>(null);

  const [inputCode, setInputCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep('input_identifier');
    setIdentifier('');
    setError('');
    setResetId('');
    setMaskedPhone('');
    setUserDisplayName('');
    setLocalFallbackCode(null);
    setInputCode('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  // Masker telefonnummer for personvern
  const maskPhone = (phone?: string) => {
    if (!phone) return 'ukjent nummer';
    const clean = phone.replace(/\s+/g, '');
    if (clean.length === 8) {
      return `+47 ${clean.substring(0, 2)} •• •• ${clean.substring(6)}`;
    }
    return `+47 ••• •• ${clean.slice(-3)}`;
  };

  // Trinn 1: Send forespørsel om engangskode
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Vennligst oppgi brukernavn, e-post eller mobilnummer');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      // 1. Prøv først backend Cloud Function /api/request-password-reset
      let serverRes: Response | null = null;
      const endpoints = [
        '/api/request-password-reset',
        'https://us-central1-tid1din.cloudfunctions.net/requestPasswordReset'
      ];

      for (const url of endpoints) {
        try {
          serverRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: identifier.trim() })
          });
          if (serverRes && (serverRes.ok || serverRes.status === 400 || serverRes.status === 404)) {
            break;
          }
        } catch {
          // Prøv neste endpoint
        }
      }

      if (serverRes && serverRes.ok) {
        const data = await serverRes.json();
        setResetId(data.resetId);
        setMaskedPhone(data.maskedPhone || 'din registrerte mobil');
        setUserDisplayName(data.displayName || 'Bruker');
        setStep('verify_and_new_password');
        return;
      } else if (serverRes && (serverRes.status === 400 || serverRes.status === 404)) {
        const data = await serverRes.json().catch(() => ({}));
        setError(data.error || 'Fant ingen bruker med dette brukernavnet eller e-posten.');
        return;
      }

      // 2. Lokal fallback (hvis Cloud Function ikke er tilgjengelig, f.eks. lokalt utviklingsmiljø)
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
        return;
      }

      if (!found.phone) {
        setError(`Brukeren ${found.displayName} har ikke registrert mobilnummer. Kontakt klinikkadministrator.`);
        return;
      }

      // Generer en sikker engangskode lokalt
      const codeArray = new Uint32Array(1);
      window.crypto.getRandomValues(codeArray);
      const code = (100000 + (codeArray[0] % 900000)).toString();

      const smsSettings = await dbService.getSmsSettings();
      const appName = smsSettings.treatmentPlace || smsSettings.sender || 'Tid1Din';
      const msg = `${appName}: Din engangskode for å tilbakestille passord er ${code}. Gyldig i 10 minutter.`;

      await smsService.sendSms(found.phone, msg, 'custom');

      setResetId(`local_${found.uid}_${Date.now()}`);
      setMaskedPhone(maskPhone(found.phone));
      setUserDisplayName(found.displayName);
      
      // I lokalt utviklingsmiljø (DEV) lagres fallback-koden i minnet
      if (import.meta.env.DEV) {
        setLocalFallbackCode(code);
      }
      setStep('verify_and_new_password');
    } catch (err: any) {
      setError(err.message || 'Kunne ikke sende SMS-engangskode.');
    } finally {
      setIsSearching(false);
    }
  };

  // Trinn 2: Fullfør passord-reset
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputCode.trim()) {
      setError('Vennligst oppgi 6-sifret kode fra SMS.');
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
      // 1. Send verifisering til server dersom ikke lokal fallback
      if (!resetId.startsWith('local_')) {
        let verifyRes: Response | null = null;
        const endpoints = [
          '/api/verify-password-reset',
          'https://us-central1-tid1din.cloudfunctions.net/verifyPasswordReset'
        ];

        for (const url of endpoints) {
          try {
            verifyRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resetId,
                code: inputCode.trim(),
                newPassword
              })
            });
            if (verifyRes && (verifyRes.ok || verifyRes.status === 400 || verifyRes.status === 404)) {
              break;
            }
          } catch {
            // Prøv neste endpoint
          }
        }

        if (verifyRes && verifyRes.ok) {
          setStep('success');
          return;
        } else if (verifyRes) {
          const data = await verifyRes.json().catch(() => ({}));
          setError(data.error || 'Feil engangskode. Vennligst sjekk SMS-en og prøv igjen.');
          return;
        }
      }

      // 2. Lokal fallback verifisering
      if (localFallbackCode && inputCode.trim() !== localFallbackCode) {
        setError('Feil engangskode. Sjekk SMS-en og prøv igjen.');
        return;
      }

      const uid = resetId.replace(/^local_/, '').split('_')[0];
      const user = await dbService.getUserById(uid);
      if (!user) {
        setError('Brukeren ble ikke funnet.');
        return;
      }

      const hashedPassword = await hashPassword(newPassword);
      const updatedUser: UserProfile = {
        ...user,
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      };

      await dbService.saveUser(updatedUser);
      await dbService.logAction(
        { uid: user.uid, email: user.email, role: user.role },
        'password_reset_sms',
        `Passord tilbakestilt via SMS-verifisering for ${user.displayName}`
      );

      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Kunne ikke oppdatere passord.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    handleClose();
    if (onPasswordResetSuccess && identifier) {
      onPasswordResetSuccess(identifier);
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
            {step === 'input_identifier' && 'Oppgi ditt brukernavn, e-post eller mobilnummer for å motta en sikker engangskode.'}
            {step === 'verify_and_new_password' && 'Oppgi koden mottatt på SMS og velg ditt nye passord.'}
            {step === 'success' && 'Ditt nye passord er lagret og kryptert.'}
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
                Koden sendes til mobilnummeret som er registrert på din konto.
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
                {isSearching ? 'Sender SMS...' : 'Send SMS-kode'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* TRINN 2: VERIFISER KODE & OPPGI NYTT PASSORD */}
        {step === 'verify_and_new_password' && (
          <form onSubmit={handleResetSubmit} className="space-y-3.5 pt-1">
            
            {/* Informasjon om mottaker */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              {userDisplayName && (
                <p>
                  Bruker: <strong className="text-slate-800">{userDisplayName}</strong>
                </p>
              )}
              <p>
                SMS sendt til: <strong className="text-slate-800">{maskedPhone}</strong>
              </p>
            </div>

            {/* Kun synlig i lokalt utviklingsmiljø dersom Cloud Functions ikke kjører */}
            {import.meta.env.DEV && localFallbackCode && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between">
                <span>Lokal test-kode: <strong className="font-mono text-sm font-bold text-amber-900">{localFallbackCode}</strong></span>
                <button
                  type="button"
                  onClick={() => setInputCode(localFallbackCode)}
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
                {isSubmitting ? 'Oppdaterer...' : 'Lagre nytt passord'}
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
                Ditt nye passord er lagret og kryptert. Du kan nå logge inn med din bruker og det nye passordet.
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
