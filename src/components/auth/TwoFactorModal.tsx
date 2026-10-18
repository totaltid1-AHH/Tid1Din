import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext';
import { generateTotpUri } from '../../utils/totp';
import { ShieldCheck, KeyRound, AlertCircle, X, QrCode, Copy, Check } from 'lucide-react';

export const TwoFactorModal: React.FC = () => {
  const { is2FAModalOpen, pendingUser, verify2FA, cancel2FA } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (is2FAModalOpen && pendingUser) {
      setCode('');
      setError('');
      setShowQr(false);

      if (pendingUser.twoFactorSecret) {
        const issuer = 'Tid1Din';
        const account = pendingUser.username || pendingUser.email || pendingUser.displayName;
        const uri = generateTotpUri(issuer, account, pendingUser.twoFactorSecret);
        QRCode.toDataURL(uri, {
          width: 180,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' }
        })
          .then(url => setQrDataUrl(url))
          .catch(e => console.error('Kunne ikke lage QR-kode i 2FA-modal:', e));
      }
    }
  }, [is2FAModalOpen, pendingUser]);

  if (!is2FAModalOpen || !pendingUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Vennligst skriv inn 2FA-koden fra Google Authenticator');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const success = await verify2FA(code);
    setIsSubmitting(false);

    if (!success) {
      setError('Ugyldig engangskode. Sjekk koden i Google Authenticator (eller testkoden) og prøv igjen.');
    }
  };

  const handleCopySecret = () => {
    if (pendingUser.twoFactorSecret) {
      navigator.clipboard.writeText(pendingUser.twoFactorSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:p-8 max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={cancel2FA}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Google Authenticator</h3>
          <p className="text-xs text-slate-500 mt-1">
            Oppgi 6-sifret engangskode for <span className="font-semibold text-slate-800">{pendingUser.displayName}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-800 placeholder:text-slate-300"
              />
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Testkode & QR-hjelp */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Demo/Testkode: <strong className="text-sky-700 font-mono">123456</strong></span>
              <button
                type="button"
                onClick={() => setCode('123456')}
                className="text-sky-600 hover:text-sky-800 font-semibold hover:underline"
              >
                Fyll ut testkode
              </button>
            </div>

            {pendingUser.twoFactorSecret && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center justify-center gap-1.5 mx-auto hover:underline"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQr ? 'Skjul QR-kode' : 'Skann QR-kode i Google Authenticator'}</span>
                </button>

                {showQr && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center animate-in fade-in space-y-2">
                    <p className="text-[11px] text-slate-600 font-medium">
                      Åpne Google Authenticator på mobilen og skann denne:
                    </p>
                    {qrDataUrl && (
                      <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                        <img src={qrDataUrl} alt="2FA QR-kode" className="w-36 h-36" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Nøkkel: <strong className="font-mono text-slate-800">{pendingUser.twoFactorSecret}</strong></span>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                        title="Kopier hemmelig nøkkel"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={cancel2FA}
              className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors text-xs"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isSubmitting || code.length < 4}
              className="w-1/2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-md shadow-sky-600/20 transition-all text-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Verifiserer...' : 'Bekreft & Logg inn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
