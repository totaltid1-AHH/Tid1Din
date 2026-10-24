import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { smsService } from '../../services/sms';
import { 
  KeyRound, 
  Send, 
  Save, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Sparkles,
  Check,
  Building2
} from 'lucide-react';

export const SuperAdminSmsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Test SMS state for å teste API-nøkkelen
  const [testPhone, setTestPhone] = useState('91234567');
  const [testMessage, setTestMessage] = useState('Test-SMS fra Super-admin for å verifisere GatewayAPI-nøkkel.');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    loadKey();
  }, []);

  const loadKey = async () => {
    try {
      const key = dbService.getGlobalSmsApiKey();
      setApiKey(key);
    } catch (e) {
      console.error('Feil ved lasting av API-nøkkel:', e);
    }
  };

  const handleSaveApiKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;

    setIsSaving(true);
    try {
      await dbService.setGlobalSmsApiKey(apiKey.trim());

      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'update_sms_settings',
        'Super-admin oppdaterte GatewayAPI-nøkkel'
      );

      setSaveSuccessMessage('GatewayAPI REST-nøkkel er lagret!');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: any) {
      alert('Kunne ikke lagre: ' + (err.message || 'Ukjent feil'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!testPhone.trim() || !testMessage.trim()) return;

    setIsSendingTest(true);
    setTestStatus('Sender test-SMS via GatewayAPI...');

    try {
      const res = await smsService.sendSms(testPhone.trim(), testMessage.trim(), 'booking');
      if (res.status === 'sent') {
        setTestStatus(`✅ SMS sendt vellykket til ${testPhone}! GatewayAPI-nøkkelen er gyldig.`);
      } else if (res.status === 'simulated') {
        setTestStatus(`ℹ️ Simulert SMS sendt (API-nøkkel ikke angitt eller lokal simulering)`);
      } else {
        setTestStatus(`❌ Feil: ${res.response || 'SMS feilet'}`);
      }
    } catch (err: any) {
      setTestStatus(`❌ Feil: ${err.message || 'Kunne ikke sende SMS'}`);
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestStatus(null), 9000);
    }
  };

  const isKeyConfigured = Boolean(apiKey && apiKey.trim().length > 5);

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      
      {/* Toast melding */}
      {saveSuccessMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <Check className="w-4 h-4" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-sky-600" />
            <span>SMS & GatewayAPI</span>
          </h1>
        </div>

        <button
          onClick={handleSaveApiKey}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-center disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Lagrer...' : 'Lagre nøkkel'}</span>
        </button>
      </div>

      {/* FELT 1: GatewayAPI REST API-nøkkel (API Token) */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                1. GatewayAPI REST-nøkkel (API Token)
              </h2>
              <p className="text-xs text-slate-500">
                Hovednøkkelen som benyttes for SMS-sending for alle tilknyttede bedrifter.
              </p>
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto ${
            isKeyConfigured
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            {isKeyConfigured ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>API-forbindelse konfigurert</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Mangler API-nøkkel</span>
              </>
            )}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
            API Token
          </label>
          <div className="relative flex items-center">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Lim inn GatewayAPI API-Token her..."
              autoComplete="off"
              className="w-full px-3.5 py-2.5 pr-12 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              title={showApiKey ? 'Skjul nøkkel' : 'Vis nøkkel'}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            API-tokenet genereres på{' '}
            <a
              href="https://gatewayapi.com"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 underline font-semibold hover:text-indigo-800"
            >
              GatewayAPI.com
            </a>{' '}
            under <em>API &gt; API Keys</em>.
          </p>
        </div>

        {/* Informasjon om URL-hvitelisting */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Viktig om internettlenker i SMS:</span>
            <p className="text-[11px] leading-relaxed text-amber-800">
              GatewayAPI krever at eventuelle web-lenker i meldinger forhåndsgodkjennes under <strong>GatewayAPI.com &gt; SMS &gt; URL Whitelist</strong>.
              For 100 % leveringssikkerhet er standardmalene satt opp uten lenker.
            </p>
          </div>
        </div>
      </div>

      {/* FELT 2: Test SMS-utsendelse for API-koden */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              2. Test SMS-utsendelse (Verifiser API-kode)
            </h2>
            <p className="text-xs text-slate-500">
              Send en test-SMS til et valgfritt mobilnummer for å verifisere at API-koden fungerer.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mottakernummer</label>
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="f.eks. 91234567"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Testmelding</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Testmelding tekst..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSendTestSms}
                disabled={isSendingTest}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTest ? 'Sender...' : 'Send SMS'}</span>
              </button>
            </div>
          </div>
        </div>

        {testStatus && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold">
            {testStatus}
          </div>
        )}
      </div>

      {/* Info-boks om at avsendernavn og maler styres per bedrift */}
      <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 flex items-start gap-3">
        <Building2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 space-y-1">
          <p className="font-bold">Individuelt avsendernavn per bedrift:</p>
          <p className="text-[11px] leading-relaxed text-indigo-800">
            Hver bedrift har sitt eget <strong>Avsendernavn (Sender ID)</strong>, behandlingssted, automatiske påminnelsestidspunkter og meldingsmaler. Dette konfigureres direkte under <strong>Bedrifter</strong> (klikk på bedriften) eller under <strong>Klinikk &gt; SMS-innstillinger</strong> for bedriftens hovedadministrator.
          </p>
        </div>
      </div>

    </div>
  );
};

export default SuperAdminSmsView;
