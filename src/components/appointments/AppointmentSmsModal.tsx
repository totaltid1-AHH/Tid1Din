import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  X, 
  Send, 
  Clock, 
  Calendar, 
  MessageSquare, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  ArrowRight,
  BookmarkPlus
} from 'lucide-react';
import { Appointment, UserProfile, SmsTemplate } from '../../types';
import { dbService } from '../../services/db';
import { smsService } from '../../services/sms';
import { useAuth } from '../../context/AuthContext';

interface AppointmentSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  client?: UserProfile | null;
  initialTab?: 'delay' | 'reschedule' | 'templates';
  onAppointmentUpdated?: (updatedApt: Appointment) => void;
}

export const AppointmentSmsModal: React.FC<AppointmentSmsModalProps> = ({
  isOpen,
  onClose,
  appointment,
  client,
  initialTab = 'delay',
  onAppointmentUpdated
}) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'delay' | 'reschedule' | 'templates'>(initialTab);

  // Klient- og avtaledata
  const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(appointment || null);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Maler
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateMessage, setNewTemplateMessage] = useState('');

  // 1. Forsinkelse
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [delayMessage, setDelayMessage] = useState('');
  const [updateCalendarTimeOnDelay, setUpdateCalendarTimeOnDelay] = useState(false);

  // 2. Ombooking
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [rescheduleMessage, setRescheduleMessage] = useState('');

  // 3. Egendefinert / Maler
  const [customMessage, setCustomMessage] = useState('');

  // Sending status
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadInitialData();
    }
  }, [isOpen, appointment?.id, client?.uid]);

  const loadInitialData = async () => {
    // 1. Hent maler
    const tpls = await dbService.getSmsTemplates();
    setTemplates(tpls);

    // 2. Avtale og klient
    let currentApt = appointment || null;
    let targetPhone = appointment?.clientPhone || client?.phone || '';

    if (client?.uid && !appointment) {
      const clientApts = await dbService.getAppointmentsByClient(client.uid);
      setClientAppointments(clientApts);
      // Finn nærmeste fremtidige avtale
      const today = format(new Date(), 'yyyy-MM-dd');
      const upcoming = clientApts
        .filter(a => a.date >= today && a.status !== 'cancelled')
        .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime());
      
      if (upcoming.length > 0) {
        currentApt = upcoming[0];
        targetPhone = currentApt.clientPhone || targetPhone;
      }
    }

    setSelectedAppointment(currentApt);
    setRecipientPhone(targetPhone);

    // Initialiser felter
    const baseApt = currentApt || ({
      id: 'temp',
      clientId: client?.uid || 'temp',
      clientNumber: client?.customerNumber || 1000,
      clientName: client?.displayName || 'Klient',
      clientPhone: targetPhone,
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: format(new Date(), 'HH:mm'),
      endTime: format(new Date(), 'HH:mm'),
      durationMinutes: 45,
      slotType: 'single',
      price: 950,
      isOnline: false,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    } as Appointment);

    // Initialiser forsinkelse
    initDelayMessage(baseApt, 15, tpls);

    // Initialiser ombooking
    setNewDate(baseApt.date);
    setNewStartTime(baseApt.startTime);
    initRescheduleMessage(baseApt, baseApt.date, baseApt.startTime, tpls);

    // Initialiser standardtekst
    if (tpls.length > 0) {
      setSelectedTemplateId(tpls[0].id);
      setCustomMessage(smsService.formatMessage(tpls[0].message, baseApt, undefined, {
        therapistName: currentUser?.displayName
      }));
    }
  };

  const getEffectiveAppointment = (): Appointment => {
    if (selectedAppointment) return selectedAppointment;
    return {
      id: 'temp',
      clientId: client?.uid || 'temp',
      clientNumber: client?.customerNumber || 1000,
      clientName: client?.displayName || 'Klient',
      clientPhone: recipientPhone,
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: format(new Date(), 'HH:mm'),
      endTime: format(new Date(), 'HH:mm'),
      durationMinutes: 45,
      slotType: 'single',
      price: 950,
      isOnline: false,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };
  };

  // Beregn ny tid ved forsinkelse
  const calculateNewTimeFromDelay = (startTime: string, delayMin: number): string => {
    try {
      const [h, m] = startTime.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return startTime;
      const total = h * 60 + m + delayMin;
      const newH = Math.floor(total / 60) % 24;
      const newM = total % 60;
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    } catch {
      return startTime;
    }
  };

  const initDelayMessage = (apt: Appointment, minutes: number, tplsList?: SmsTemplate[]) => {
    setDelayMinutes(minutes);
    const sourceTpls = tplsList || templates;
    const delayTpl = sourceTpls.find(t => t.id === 'tpl_delay_15')?.message || 
      'Hei {kunde}! Din behandler er dessverre ca. {forsinkelse} forsinket i dag ({dato}). Ny oppstartstid er ca. kl. {nytt_klokkeslett}. Beklager ulempen!';
    
    const formatted = smsService.formatMessage(delayTpl, apt, undefined, {
      delayMinutes: minutes,
      therapistName: currentUser?.displayName
    });
    setDelayMessage(formatted);
  };

  const handleSelectDelayMinutes = (minutes: number) => {
    initDelayMessage(getEffectiveAppointment(), minutes);
  };

  const initRescheduleMessage = (apt: Appointment, targetDate: string, targetTime: string, tplsList?: SmsTemplate[]) => {
    const sourceTpls = tplsList || templates;
    const reschedTpl = sourceTpls.find(t => t.id === 'tpl_reschedule')?.message ||
      'Hei {kunde}! Din avtalte time hos Tid1Din er flyttet til ny dato: {ny_dato} kl. {nytt_klokkeslett}. Vennligst ta kontakt dersom tidspunktet ikke passer.';
    
    const formatted = smsService.formatMessage(reschedTpl, apt, undefined, {
      newDate: targetDate,
      newTime: targetTime,
      therapistName: currentUser?.displayName
    });
    setRescheduleMessage(formatted);
  };

  const handleDateOrTimeChange = (dateVal: string, timeVal: string) => {
    setNewDate(dateVal);
    setNewStartTime(timeVal);
    initRescheduleMessage(getEffectiveAppointment(), dateVal, timeVal);
  };

  const handleSelectTemplate = (tpl: SmsTemplate) => {
    setSelectedTemplateId(tpl.id);
    const apt = getEffectiveAppointment();
    const formatted = smsService.formatMessage(tpl.message, apt, undefined, {
      delayMinutes,
      newDate: newDate || apt.date,
      newTime: newStartTime || apt.startTime,
      therapistName: currentUser?.displayName
    });
    setCustomMessage(formatted);
  };

  // 1. Send forsinkelses-SMS
  const handleSendDelaySms = async () => {
    if (!recipientPhone) {
      alert('Vennligst oppgi et gyldig mobilnummer til klienten.');
      return;
    }
    setIsSending(true);
    try {
      // Hvis behandleren ønsker å oppdatere kalendertiden
      if (updateCalendarTimeOnDelay && selectedAppointment) {
        const newStart = calculateNewTimeFromDelay(selectedAppointment.startTime, delayMinutes);
        const [h, m] = newStart.split(':').map(Number);
        const endTotal = h * 60 + m + selectedAppointment.durationMinutes;
        const newEnd = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;

        const updated: Appointment = {
          ...selectedAppointment,
          startTime: newStart,
          endTime: newEnd,
          updatedAt: new Date().toISOString()
        };
        await dbService.saveAppointment(updated);
        setSelectedAppointment(updated);
        onAppointmentUpdated?.(updated);
      }

      const log = await smsService.sendSms(recipientPhone, delayMessage, 'delay', selectedAppointment?.id);
      setFeedback({
        type: 'success',
        message: log.status === 'sent' 
          ? `SMS sendt til ${recipientPhone} via GatewayAPI!` 
          : `SMS simulert og loggført til ${recipientPhone}.`
      });
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Kunne ikke sende SMS: ' + err.message });
    } finally {
      setIsSending(false);
    }
  };

  // 2. Ombook time (med eller uten SMS)
  const handleRescheduleAppointment = async (sendSmsNotification: boolean) => {
    if (!selectedAppointment) {
      alert('Ingen avtale er valgt for ombooking.');
      return;
    }
    if (!newDate || !newStartTime) {
      alert('Vennligst velg både ny dato og klokkeslett.');
      return;
    }

    setIsSending(true);
    try {
      // Beregn ny sluttid
      const [h, m] = newStartTime.split(':').map(Number);
      const endTotal = h * 60 + m + selectedAppointment.durationMinutes;
      const newEnd = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;

      const updatedApt: Appointment = {
        ...selectedAppointment,
        date: newDate,
        startTime: newStartTime,
        endTime: newEnd,
        updatedAt: new Date().toISOString()
      };

      await dbService.saveAppointment(updatedApt);
      setSelectedAppointment(updatedApt);
      onAppointmentUpdated?.(updatedApt);

      if (sendSmsNotification && recipientPhone) {
        const log = await smsService.sendSms(recipientPhone, rescheduleMessage, 'reschedule', updatedApt.id);
        setFeedback({
          type: 'success',
          message: log.status === 'sent'
            ? `Timen ble flyttet til ${newDate} kl. ${newStartTime}, og SMS ble sendt!`
            : `Timen ble flyttet til ${newDate} kl. ${newStartTime} (SMS simulert).`
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Timen ble flyttet til ${newDate} kl. ${newStartTime}.`
        });
      }

      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 2200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Feil ved ombooking: ' + err.message });
    } finally {
      setIsSending(false);
    }
  };

  // 3. Send standard/egendefinert SMS
  const handleSendCustomSms = async () => {
    if (!recipientPhone) {
      alert('Vennligst oppgi et mobilnummer.');
      return;
    }
    if (!customMessage.trim()) {
      alert('Vennligst skriv inn en melding.');
      return;
    }

    setIsSending(true);
    try {
      const log = await smsService.sendSms(recipientPhone, customMessage.trim(), 'custom', selectedAppointment?.id);
      setFeedback({
        type: 'success',
        message: log.status === 'sent' 
          ? `SMS sendt til ${recipientPhone} via GatewayAPI!` 
          : `SMS simulert og loggført til ${recipientPhone}.`
      });
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Kunne ikke sende SMS: ' + err.message });
    } finally {
      setIsSending(false);
    }
  };

  // 4. Administrere maler (lagre / slette)
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateTitle.trim() || !newTemplateMessage.trim()) return;

    const tpl: SmsTemplate = {
      id: editingTemplate ? editingTemplate.id : 'tpl_custom_' + Date.now(),
      title: newTemplateTitle.trim(),
      message: newTemplateMessage.trim(),
      category: 'custom',
      isDefault: false
    };

    await dbService.saveSmsTemplate(tpl);
    const updatedTpls = await dbService.getSmsTemplates();
    setTemplates(updatedTpls);
    setEditingTemplate(null);
    setNewTemplateTitle('');
    setNewTemplateMessage('');
    setIsManagingTemplates(false);
    handleSelectTemplate(tpl);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne standardteksten?')) return;
    await dbService.deleteSmsTemplate(templateId);
    const updatedTpls = await dbService.getSmsTemplates();
    setTemplates(updatedTpls);
    if (selectedTemplateId === templateId && updatedTpls.length > 0) {
      handleSelectTemplate(updatedTpls[0]);
    }
  };

  if (!isOpen) return null;

  const currentApt = getEffectiveAppointment();
  const calculatedNewDelayTime = calculateNewTimeFromDelay(currentApt.startTime, delayMinutes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Terapeutens arbeidsområde: SMS & Timehåndtering
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Klient: <span className="font-semibold text-slate-800">{currentApt.clientName}</span> (#{currentApt.clientNumber}) 
                {selectedAppointment && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 font-mono text-[10px] border border-sky-100">
                    {selectedAppointment.date} kl. {selectedAppointment.startTime}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mottakertelefon-bar */}
        <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-500">Mottaker:</span>
            {isEditingPhone ? (
              <div className="flex items-center gap-1">
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="px-2 py-0.5 rounded border border-slate-300 text-xs font-mono w-32 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="91234567"
                />
                <button
                  onClick={() => setIsEditingPhone(false)}
                  className="text-[11px] px-1.5 py-0.5 bg-sky-600 text-white rounded font-medium"
                >
                  OK
                </button>
              </div>
            ) : (
              <span className="font-mono font-bold text-slate-800">
                {recipientPhone || <span className="text-rose-600 font-normal italic">Mangler mobilnummer!</span>}
              </span>
            )}
            {!isEditingPhone && (
              <button
                onClick={() => setIsEditingPhone(true)}
                className="text-[10px] text-sky-600 hover:underline ml-1 font-medium"
              >
                Endre
              </button>
            )}
          </div>

          {/* Hvis det er flere avtaler tilgjengelig for klienten */}
          {clientAppointments.length > 1 && (
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-500">Velg time:</span>
              <select
                value={selectedAppointment?.id || ''}
                onChange={(e) => {
                  const found = clientAppointments.find(a => a.id === e.target.value);
                  if (found) {
                    setSelectedAppointment(found);
                    initDelayMessage(found, delayMinutes);
                    setNewDate(found.date);
                    setNewStartTime(found.startTime);
                    initRescheduleMessage(found, found.date, found.startTime);
                  }
                }}
                className="px-1.5 py-0.5 rounded border border-slate-300 text-xs font-mono bg-white"
              >
                {clientAppointments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.date} kl. {a.startTime} ({a.isOnline ? 'Online' : 'Fysisk'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Faner */}
        <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('delay')}
            className={`pb-2.5 px-3 font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'delay'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Forsinkelse (Utsatt time)
          </button>

          <button
            onClick={() => setActiveTab('reschedule')}
            className={`pb-2.5 px-3 font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'reschedule'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Flytt / Ombook time
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-2.5 px-3 font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'templates'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            Standardtekster & Maler
          </button>
        </div>

        {/* Feedback melding */}
        {feedback && (
          <div className={`mx-4 mt-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Innhold per fane */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">

          {/* FANE 1: FORSINKELSE */}
          {activeTab === 'delay' && (
            <div className="space-y-4">
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Hurtigvalg for forsinkelse
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium">
                    Opprinnelig: <span className="font-mono font-bold">{currentApt.startTime}</span> &rarr; Ny tid: <span className="font-mono font-bold text-amber-900">{calculatedNewDelayTime}</span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[10, 15, 20, 30, 45].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => handleSelectDelayMinutes(min)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        delayMinutes === min
                          ? 'bg-amber-600 text-white shadow-xs scale-102'
                          : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100/50'
                      }`}
                    >
                      +{min} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  SMS-tekst til {currentApt.clientName}
                </label>
                <textarea
                  rows={4}
                  value={delayMessage}
                  onChange={(e) => setDelayMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
                  placeholder="Skriv forsinkelsesmelding her..."
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>{delayMessage.length} tegn ({Math.ceil(delayMessage.length / 160) || 1} SMS)</span>
                  <button
                    type="button"
                    onClick={() => initDelayMessage(currentApt, delayMinutes)}
                    className="text-sky-600 hover:underline"
                  >
                    Tilbakestill standardtekst
                  </button>
                </div>
              </div>

              {selectedAppointment && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Juster kalenderens starttid</p>
                    <p className="text-[11px] text-slate-500">
                      Flytter avtalen i kalenderen fra {selectedAppointment.startTime} til {calculatedNewDelayTime}.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateCalendarTimeOnDelay}
                      onChange={(e) => setUpdateCalendarTimeOnDelay(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSendDelaySms}
                  disabled={isSending || !recipientPhone}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {isSending ? 'Sender SMS...' : `Send forsinkelses-SMS (${delayMinutes} min)`}
                </button>
              </div>
            </div>
          )}

          {/* FANE 2: OMBOOKING */}
          {activeTab === 'reschedule' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sky-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-sky-600" />
                    Velg nytt tidspunkt for timen
                  </span>
                  <span className="text-[11px] text-sky-700">
                    Varighet: <span className="font-bold">{currentApt.durationMinutes} min</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Ny dato *</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => handleDateOrTimeChange(e.target.value, newStartTime)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Ny starttid *</label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => handleDateOrTimeChange(newDate, e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-1">
                  <span className="text-slate-400">Gammel tid:</span>
                  <span className="line-through">{currentApt.date} kl. {currentApt.startTime}</span>
                  <ArrowRight className="w-3 h-3 text-sky-600" />
                  <span className="font-bold text-sky-900">{newDate} kl. {newStartTime}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Ombookings-SMS til {currentApt.clientName}
                </label>
                <textarea
                  rows={4}
                  value={rescheduleMessage}
                  onChange={(e) => setRescheduleMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
                  placeholder="Meldingstekst..."
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>{rescheduleMessage.length} tegn ({Math.ceil(rescheduleMessage.length / 160) || 1} SMS)</span>
                  <button
                    type="button"
                    onClick={() => initRescheduleMessage(currentApt, newDate, newStartTime)}
                    className="text-sky-600 hover:underline"
                  >
                    Tilbakestill standardtekst
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleRescheduleAppointment(false)}
                  disabled={isSending}
                  className="py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  Kun ombook (uten SMS)
                </button>

                <button
                  type="button"
                  onClick={() => handleRescheduleAppointment(true)}
                  disabled={isSending || !recipientPhone}
                  className="py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {isSending ? 'Ombooker...' : 'Ombook time & send SMS'}
                </button>
              </div>
            </div>
          )}

          {/* FANE 3: STANDARDTEKSTER & EGENDEFINERT */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              
              {/* Mal-knapper / chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Velg standardtekst
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingTemplates(!isManagingTemplates);
                      setEditingTemplate(null);
                      setNewTemplateTitle('');
                      setNewTemplateMessage('');
                    }}
                    className="text-[11px] text-sky-600 hover:underline font-medium flex items-center gap-1"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    {isManagingTemplates ? 'Lukk administrasjon' : 'Administrer / ny standardtekst'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        selectedTemplateId === tpl.id
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Administrere / opprette maler */}
              {isManagingTemplates && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-800">
                    {editingTemplate ? `Rediger: "${editingTemplate.title}"` : 'Opprett ny standardtekst'}
                  </h4>

                  <form onSubmit={handleSaveTemplate} className="space-y-2.5">
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Tittel på standardtekst (f.eks. 'Glemt time')..."
                        value={newTemplateTitle}
                        onChange={(e) => setNewTemplateTitle(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        required
                        placeholder="Meldingstekst... (Bruk gjerne {kunde}, {dato}, {klokkeslett})"
                        value={newTemplateMessage}
                        onChange={(e) => setNewTemplateMessage(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-sans"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Plassholdere: {'{kunde}'}, {'{kundenummer}'}, {'{dato}'}, {'{klokkeslett}'}, {'{ny_dato}'}, {'{nytt_klokkeslett}'}, {'{behandler}'}
                      </p>
                    </div>

                    <div className="flex gap-2 justify-end">
                      {editingTemplate && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate(null);
                            setNewTemplateTitle('');
                            setNewTemplateMessage('');
                          }}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:underline"
                        >
                          Avbryt redigering
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs"
                      >
                        Lagre standardtekst
                      </button>
                    </div>
                  </form>

                  {/* Eksisterende maler liste */}
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-[11px] font-bold text-slate-600 mb-1.5">Eksisterende standardtekster:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {templates.map(t => (
                        <div key={t.id} className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-slate-200 text-xs">
                          <span className="font-medium text-slate-800">{t.title}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTemplate(t);
                                setNewTemplateTitle(t.title);
                                setNewTemplateMessage(t.message);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700"
                              title="Rediger"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {!t.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTemplate(t.id)}
                                className="p-1 text-slate-400 hover:text-rose-600"
                                title="Slett"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Meldingsfelt */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Meldingstekst (tilpass før utsending)
                </label>
                <textarea
                  rows={4}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
                  placeholder="Skriv eller tilpass melding her..."
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  <span>{customMessage.length} tegn ({Math.ceil(customMessage.length / 160) || 1} SMS)</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSendCustomSms}
                  disabled={isSending || !recipientPhone || !customMessage.trim()}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {isSending ? 'Sender SMS...' : 'Send SMS til klient'}
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
