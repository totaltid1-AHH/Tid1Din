import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { smsService } from '../../services/sms';
import { SmsSettings, SystemAuditLog } from '../../types';
import { 
  ShieldAlert, 
  KeyRound, 
  FileText, 
  Save, 
  Check, 
  Send,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

export const SuperAdminSettingsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'api' | 'logs'>('api');
  const [smsSettings, setSmsSettings] = useState<SmsSettings | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemAuditLog[]>([]);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState('91234567');
  const [testMessage, setTestMessage] = useState('Test-SMS fra Super-admin (GatewayAPI)');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const sms = await dbService.getSmsSettings();
    const sysLogs = await dbService.getSystemLogs();

    setSmsSettings(sms);
    setSystemLogs(sysLogs);
  };

  const handleSaveApiKey = async () => {
    if (!smsSettings || !currentUser) return;
    await dbService.saveSmsSettings(smsSettings);
    setSaveSuccessMessage('GatewayAPI-nøkkel lagret!');
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  const handleSendTestSms = async () => {
    if (!testPhone || !testMessage) return;
    setTestStatus('Sender test-SMS via GatewayAPI...');
    const res = await smsService.sendSms(testPhone, testMessage, 'booking');
    setTestStatus(`Resultat: SMS ${res.status === 'sent' ? 'sendt via GatewayAPI' : res.status === 'simulated' ? 'simulert (ingen API-nøkkel)' : 'feilet'} til ${testPhone}`);
    setTimeout(() => setTestStatus(null), 5000);
  };

  const isKeyConfigured = Boolean(smsSettings?.apiKey && smsSettings.apiKey.trim().length > 5);

  return (
    <div className="space-y-2.5 sm:space-y-5 w-full">
      
      {/* Header og tittel */}
      <div className="bg-white rounded-none sm:rounded-2xl p-3.5 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-3 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <ShieldAlert className="w-3 h-3 text-rose-600" />
                Super-admin tilgang
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
              Systemkonfigurasjon & API-innstillinger
            </h1>
            <p className="text-xs text-slate-500">
              Tekniske integrasjonsnøkler og systemrevisjonslogger. Skjult for klinikkadministratorer.
            </p>
          </div>

          {saveSuccessMessage && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold self-start sm:self-center">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              {saveSuccessMessage}
            </span>
          )}
        </div>

        {/* Faner */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1">
          <button
            onClick={() => setActiveSubTab('api')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
              activeSubTab === 'api' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>GatewayAPI Nøkkel</span>
          </button>

          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
              activeSubTab === 'logs' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="sm:hidden">Logg ({systemLogs.length})</span>
            <span className="hidden sm:inline">Systemlogger & Audit ({systemLogs.length})</span>
          </button>
        </div>
      </div>

      {/* FANE: GATEWAYAPI NØKKEL */}
      {activeSubTab === 'api' && smsSettings && (
        <div className="bg-white rounded-none sm:rounded-2xl p-3.5 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-4 w-full max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-sky-600" />
                GatewayAPI REST Nøkkel
              </h2>
              <p className="text-[11px] text-slate-500">
                Autentiseringsnøkkel for GatewayAPI.com. Meldingsmaler og varseltider administreres av Hovedadministrator under Klinikk.
              </p>
            </div>
            <button
              onClick={handleSaveApiKey}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 self-start sm:self-center flex-shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              Lagre nøkkel
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                API Nøkkel (Token)
              </label>
              <input
                type="password"
                value={smsSettings.apiKey || ''}
                onChange={(e) => setSmsSettings({ ...smsSettings, apiKey: e.target.value })}
                placeholder="Skriv inn GatewayAPI secret key..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>Lagres kryptert i systemdatabasen.</span>
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 mb-2">Test GatewayAPI utsendelse</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Mottaker tlf..."
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Meldingsinnhold..."
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={handleSendTestSms}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send test-SMS
                </button>
                {testStatus && (
                  <span className="text-xs font-semibold text-slate-600">{testStatus}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FANE: SYSTEMLOGG */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-none sm:rounded-2xl p-3.5 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-3 w-full max-w-full overflow-hidden">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-sky-600" />
            Systemlogger & Revisjonsspor
          </h2>
          <div className="overflow-x-auto max-w-full -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-xs text-slate-600 min-w-[500px]">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Tidspunkt</th>
                  <th className="py-2.5 px-3">Bruker</th>
                  <th className="py-2.5 px-3">Rolle</th>
                  <th className="py-2.5 px-3">Handling</th>
                  <th className="py-2.5 px-3">Detaljer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {systemLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                      {format(new Date(log.timestamp), 'dd.MM HH:mm:ss')}
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-medium whitespace-nowrap">{log.userEmail}</td>
                    <td className="py-2 px-3 font-semibold text-[11px] text-slate-800 whitespace-nowrap">{log.userRole}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-sky-700 font-semibold whitespace-nowrap">{log.action}</td>
                    <td className="py-2 px-3 text-[11px] text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

