import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { smsService } from '../../services/sms';
import { SmsSettings, SmsLog } from '../../types';
import { 
  MessageSquare, 
  KeyRound, 
  Send, 
  Save, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Clock, 
  RefreshCw,
  Sparkles,
  Check
} from 'lucide-react';
import { format } from 'date-fns';

export const SuperAdminSmsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [smsSettings, setSmsSettings] = useState<SmsSettings | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Test SMS state
  const [testPhone, setTestPhone] = useState('91234567');
  const [testMessage, setTestMessage] = useState('Test-SMS fra Super-admin (GatewayAPI)');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const sms = await dbService.getSmsSettings('comp_hovden');
      const logs = await dbService.getSmsLogs('all');
      setSmsSettings(sms);
      setSmsLogs(logs);
    } catch (e) {
      console.error('Feil ved lasting av SMS-innstillinger:', e);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!smsSettings || !currentUser) return;

    setIsSaving(true);
    try {
      await dbService.saveSmsSettings(smsSettings, 'comp_hovden');

      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'update_sms_settings',
        'Super-admin oppdaterte globale SMS-innstillinger og GatewayAPI-nøkkel'
      );

      setSaveSuccessMessage('SMS- og API-innstillinger er lagret!');
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
        setTestStatus(`✅ SMS sendt vellykket til ${testPhone}!`);
      } else if (res.status === 'simulated') {
        setTestStatus(`ℹ️ Simulert SMS sendt (API-nøkkel ikke angitt eller lokal simulering)`);
      } else {
        setTestStatus(`❌ Feil: ${res.response || 'SMS feilet'}`);
      }

      const updatedLogs = await dbService.getSmsLogs('all');
      setSmsLogs(updatedLogs);
    } catch (err: any) {
      setTestStatus(`❌ Feil: ${err.message || 'Kunne ikke sende SMS'}`);
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestStatus(null), 9000);
    }
  };

  if (!smsSettings) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold">Laster SMS- og API-oppsett...</p>
      </div>
    );
  }

  const isKeyConfigured = Boolean(smsSettings.apiKey && smsSettings.apiKey.trim().length > 5);

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      
      {/* Toast melding */}
      {saveSuccessMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <Check className="w-4 h-4" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Super-admin portal
            </span>
            <span className="text-xs text-slate-400 font-mono">SMS-kontroll</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-600" />
            SMS-styring & API-kode
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administrer GatewayAPI REST API-token, avsendernavn, påminnelsestidspunkter, meldingsmaler og utsendelseslogger.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-center disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Lagrer...' : 'Lagre innstillinger'}</span>
        </button>
      </div>

      {/* 1. GatewayAPI REST API-nøkkel og forbindelse */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                GatewayAPI REST-nøkkel (API Token)
              </h2>
              <p className="text-xs text-slate-500">
                Sikker autentiseringsnøkkel som benyttes for all utsendelse av SMS i Tid1Din.
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
              value={smsSettings.apiKey || ''}
              onChange={(e) => setSmsSettings({ ...smsSettings, apiKey: e.target.value })}
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
            Nøkkelen genereres på{' '}
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

        {/* Advarsel om URL-hvitelisting i SMS */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Viktig angående lenker i SMS (GatewayAPI Link-Check):</span>
            <p className="text-[11px] leading-relaxed text-amber-800">
              GatewayAPI og teleoperatører blokkerer SMS som inneholder internettlenker dersom domenet ikke er forhåndsgodkjent under <strong>GatewayAPI.com &gt; SMS &gt; URL Whitelist</strong>.
              For optimal leveringssikkerhet og lavest SMS-kostnad er systemmalene konfigurert uten internettlenker.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Avsendernavn og Behandlingssted */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
          <span>Standard Avsenderprofil</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Standard Avsendernavn (Sender ID) *
            </label>
            <input
              type="text"
              maxLength={11}
              value={smsSettings.sender || 'Hovden'}
              onChange={(e) => setSmsSettings({ ...smsSettings, sender: e.target.value })}
              placeholder="f.eks. Hovden"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Maks 11 tegn. Vises som avsender i SMS-innboksen på klientens telefon.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Standard Behandlingssted i SMS-tekst
            </label>
            <input
              type="text"
              value={smsSettings.treatmentPlace || ''}
              onChange={(e) => setSmsSettings({ ...smsSettings, treatmentPlace: e.target.value })}
              placeholder="f.eks. Hovden"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Erstatter variabelen <code className="font-mono text-indigo-700">&#123;behandlingssted&#125;</code> i utsendte meldinger.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Påminnelsesoppsett */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span>Automatiske SMS-påminnelser</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-slate-800">Påminnelse 1</span>
              <input
                type="checkbox"
                checked={smsSettings.reminder1Enabled}
                onChange={(e) => setSmsSettings({ ...smsSettings, reminder1Enabled: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="number"
                min={1}
                max={168}
                value={smsSettings.reminder1Hours}
                onChange={(e) => setSmsSettings({ ...smsSettings, reminder1Hours: Number(e.target.value) })}
                className="w-16 px-2 py-1 rounded-lg border border-slate-300 font-bold text-center bg-white"
              />
              <span>timer før avtalen</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-slate-800">Påminnelse 2 (Kort varsel)</span>
              <input
                type="checkbox"
                checked={smsSettings.reminder2Enabled}
                onChange={(e) => setSmsSettings({ ...smsSettings, reminder2Enabled: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="number"
                min={1}
                max={48}
                value={smsSettings.reminder2Hours}
                onChange={(e) => setSmsSettings({ ...smsSettings, reminder2Hours: Number(e.target.value) })}
                className="w-16 px-2 py-1 rounded-lg border border-slate-300 font-bold text-center bg-white"
              />
              <span>timer før avtalen</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Meldingsmaler */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
          SMS-meldingsmaler
        </h2>

        <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900 flex flex-wrap gap-1.5 items-center">
          <span className="font-bold">Tilgjengelige flettefelt:</span>
          <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono">&#123;kunde&#125;</code>
          <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono">&#123;dato&#125;</code>
          <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono">&#123;klokkeslett&#125;</code>
          <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono">&#123;behandlingssted&#125;</code>
          <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono">&#123;behandler&#125;</code>
          <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono">&#123;varighet&#125;</code>
          <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono">&#123;pris&#125;</code>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Timebekreftelse (sendes automatisk ved ny bestilling):
            </label>
            <textarea
              rows={3}
              value={smsSettings.bookingTemplate}
              onChange={(e) => setSmsSettings({ ...smsSettings, bookingTemplate: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Påminnelsesmelding (sendes i forkant av avtalen):
            </label>
            <textarea
              rows={3}
              value={smsSettings.reminderTemplate}
              onChange={(e) => setSmsSettings({ ...smsSettings, reminderTemplate: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 5. Test SMS-utsendelse */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-600" />
          <span>Test SMS-utsendelse</span>
        </h2>
        <p className="text-xs text-slate-500">
          Send en testmelding for å verifisere at GatewayAPI REST-nøkkelen og avsenderen fungerer i praksis.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-xs transition-colors disabled:opacity-50"
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

      {/* 6. SMS-logger / Historikk */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Siste utsendte SMS ({smsLogs.length})
            </h2>
            <p className="text-xs text-slate-500">
              Oversikt over meldingsstatus for alle utsendelser.
            </p>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Oppdater logger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {smsLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Ingen SMS-meldinger logget ennå.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {smsLogs.slice(0, 25).map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono">{log.recipientPhone}</span>
                    <span className="text-[10px] text-slate-500">({log.type})</span>
                    <span className="text-[10px] text-slate-400">
                      {log.timestamp ? format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm') : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate max-w-xl font-sans">
                    {log.message}
                  </p>
                  {log.status === 'failed' && log.response && (
                    <p className="text-[10px] text-rose-600 font-semibold">{log.response}</p>
                  )}
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold self-start sm:self-center flex-shrink-0 ${
                  log.status === 'sent'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : log.status === 'failed'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {log.status === 'sent' ? 'Sendt' : log.status === 'failed' ? 'Feilet' : 'Simulert'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default SuperAdminSmsView;
