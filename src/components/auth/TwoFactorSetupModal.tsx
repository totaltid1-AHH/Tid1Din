import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { UserProfile } from '../../types';
import { 
  generateTotpSecret, 
  generateTotpUri, 
  verifyTotpCode 
} from '../../utils/totp';
import { 
  ShieldCheck, 
  ShieldAlert, 
  QrCode, 
  KeyRound, 
  Copy, 
  Check, 
  AlertCircle, 
  X, 
  Smartphone,
  Trash2
} from 'lucide-react';

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSave: (enabled: boolean, secret?: string) => Promise<void>;
}

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({
  isOpen,
  user,
  onClose,
  onSave
}) => {
  const [secret, setSecret] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showManualKey, setShowManualKey] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && user) {
      setError('');
      setVerifyCode('');
      setCopied(false);
      
      // Bruk eksisterende hemmelighet hvis den finnes, ellers generer en ny Base32-nøkkel
      const currentSecret = user.twoFactorSecret || generateTotpSecret(16);
      setSecret(currentSecret);

      const issuer = 'Tid1Din';
      const accountName = user.username || user.email || user.displayName;
      const uri = generateTotpUri(issuer, accountName, currentSecret);

      QRCode.toDataURL(uri, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => {
          console.error('Feil ved generering av QR-kode:', err);
          setError('Kunne ikke generere QR-kode.');
        });
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) {
      setError('Vennligst oppgi 6-sifret kode fra Google Authenticator.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const isValid = await verifyTotpCode(verifyCode, secret);
      if (!isValid) {
        setError('Ugyldig kode fra Google Authenticator. Sjekk at klokkeslettet på mobilen stemmer og prøv igjen.');
        setIsSubmitting(false);
        return;
      }

      await onSave(true, secret);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Kunne ikke aktivere 2FA.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable2FA = async () => {
    if (window.confirm(`Er du sikker på at du vil deaktivere Google Authenticator 2FA for ${user.displayName}?`)) {
      setIsSubmitting(true);
      setError('');
      try {
        await onSave(false, undefined);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Kunne ikke deaktivere 2FA.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-7 max-h-[95vh] overflow-y-auto space-y-4">
        
        {/* Lukkeknapp */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1 pb-2 border-b border-slate-100">
          <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            Google Authenticator (2FA)
          </h3>
          <p className="text-xs text-slate-500">
            Tofaktor-autentisering for bruker: <strong className="text-slate-800">{user.displayName}</strong>
          </p>
        </div>

        {/* Nåværende status */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${user.twoFactorEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="font-semibold text-slate-700">
              Status: {user.twoFactorEnabled ? (
                <span className="text-emerald-700 font-bold">2FA er AKTIVERT</span>
              ) : (
                <span className="text-slate-500">Ikke aktivert</span>
              )}
            </span>
          </div>

          {user.twoFactorEnabled && (
            <button
              type="button"
              onClick={handleDisable2FA}
              disabled={isSubmitting}
              className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 hover:underline text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Deaktiver 2FA</span>
            </button>
          )}
        </div>

        {/* Feilmelding */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Trinnvis oppsett for Google Authenticator */}
        <div className="space-y-4 pt-1">
          <div className="space-y-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-sky-600" />
              1. Åpne Google Authenticator på mobilen din
            </p>
            <p className="pl-5 text-slate-500">
              Trykk på <strong className="text-slate-700">+</strong> og velg <strong className="text-slate-700">Skann en QR-kode</strong>.
            </p>
          </div>

          {/* QR-kode visning */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <p className="text-xs font-semibold text-slate-700">2. Skann denne QR-koden:</p>
            {qrDataUrl ? (
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                <img 
                  src={qrDataUrl} 
                  alt="Google Authenticator QR-kode" 
                  className="w-44 h-44 object-contain"
                />
              </div>
            ) : (
              <div className="w-44 h-44 flex items-center justify-center bg-slate-100 rounded-xl">
                <span className="text-xs text-slate-400">Laster QR-kode...</span>
              </div>
            )}

            {/* Manuell nøkkel */}
            <div className="w-full text-center">
              <button
                type="button"
                onClick={() => setShowManualKey(!showManualKey)}
                className="text-xs text-sky-600 hover:text-sky-800 font-semibold hover:underline"
              >
                {showManualKey ? 'Skjul manuell nøkkel' : 'Kan du ikke skanne? Vis manuell oppsettnøkkel'}
              </button>

              {showManualKey && (
                <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-mono font-bold tracking-widest text-slate-800 text-[11px] break-all">
                    {secret}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center gap-1 text-[11px] font-semibold flex-shrink-0 ml-2"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Kopiert' : 'Kopier'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bekreft kode fra appen */}
          <form onSubmit={handleVerifyAndEnable} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                3. Tast inn 6-sifret kode fra Google Authenticator:
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.3em] font-mono text-xl font-bold py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1 text-center">
                Dette bekrefter at appen er korrekt konfigurert før 2FA lagres.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={isSubmitting || verifyCode.length < 6}
                className="w-2/3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Verifiserer...' : user.twoFactorEnabled ? 'Oppdater & Bekreft 2FA' : 'Aktiver Google Authenticator'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};
