import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { Appointment } from '../../types';
import { 
  Calendar, 
  Clock, 
  Video, 
  MapPin, 
  Plus, 
  AlertCircle, 
  FileDown, 
  Trash2, 
  CheckCircle2, 
  ExternalLink, 
  X,
  User
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { format, isPast } from 'date-fns';
import { nb } from 'date-fns/locale';
import { formatTherapistName } from '../../utils/calendar';
import { UserProfile } from '../../types';

interface ClientDashboardProps {
  onNavigateToCalendar: () => void;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ onNavigateToCalendar }) => {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [therapists, setTherapists] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingAptId, setCancellingAptId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAppointments();
  }, [currentUser?.uid]);

  const loadAppointments = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    const [clientApts, allUsers] = await Promise.all([
      dbService.getAppointmentsByClient(currentUser.uid),
      dbService.getUsers()
    ]);
    clientApts.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      return dateA.getTime() - dateB.getTime();
    });
    setTherapists(allUsers.filter(u => u.role === 'admin' || u.role === 'hovedadmin'));
    setAppointments(clientApts);
    setIsLoading(false);
  };

  const getTherapistNameForApt = (apt: Appointment): string => {
    if (apt.therapistName) {
      return formatTherapistName(apt.therapistName);
    }
    if (apt.therapistId) {
      const found = therapists.find(t => t.uid === apt.therapistId);
      if (found) return formatTherapistName(found.displayName);
    }
    const defaultTherapist = therapists[0];
    return defaultTherapist ? formatTherapistName(defaultTherapist.displayName) : '';
  };

  const handleCancelAppointment = async () => {
    if (!cancellingAptId || !currentUser) return;
    try {
      await dbService.cancelAppointment(cancellingAptId, cancelReason);
      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'cancel_appointment',
        `Klient avbestilte time (${cancellingAptId})`
      );

      setFeedbackMessage('Timen er nå avbestilt.');
      setCancellingAptId(null);
      setCancelReason('');
      await loadAppointments();
    } catch (e: any) {
      alert('Kunne ikke avbestille: ' + e.message);
    }
  };

  const handleExportGdprData = () => {
    if (!currentUser) return;

    const doc = new jsPDF();
    const customerNr = currentUser.customerNumber || 1000;

    // Fargeoppsett
    const primaryColor: [number, number, number] = [2, 132, 199]; // sky-600
    const darkColor: [number, number, number] = [15, 23, 42]; // slate-900
    const grayColor: [number, number, number] = [100, 116, 139]; // slate-500
    const lightBg: [number, number, number] = [248, 250, 252]; // slate-50

    // Header banner
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Tid1Din', 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('GDPR Dataeksport & Klientoversikt', 60, 16);

    let y = 34;

    // Klientinformasjon seksjon
    doc.setFillColor(...lightBg);
    doc.roundedRect(14, y, 182, 48, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 48, 3, 3, 'D');

    doc.setTextColor(...darkColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Klientinformasjon: #${customerNr}`, 18, y + 8);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);

    const exportDateStr = format(new Date(), 'dd.MM.yyyy HH:mm');
    doc.text(`Eksportert: ${exportDateStr}`, 135, y + 8);

    doc.setTextColor(...darkColor);
    doc.text(`Navn: ${currentUser.displayName}`, 18, y + 18);
    doc.text(`E-post: ${currentUser.email}`, 18, y + 26);
    doc.text(`Telefon: ${currentUser.phone || 'Ikke oppgitt'}`, 18, y + 34);

    doc.text(`Adresse: ${currentUser.address || 'Ikke oppgitt'}`, 110, y + 18);
    doc.text(`Fodselsdato: ${currentUser.birthDate || 'Ikke oppgitt'}`, 110, y + 26);
    doc.text(`Konto opprettet: ${currentUser.createdAt ? currentUser.createdAt.substring(0, 10) : 'N/A'}`, 110, y + 34);
    doc.text(`2FA Sikring: Aktivert`, 18, y + 42);

    y += 58;

    // Timeavtaler seksjon
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...darkColor);
    doc.text(`Registrerte Timeavtaler (${appointments.length})`, 14, y);

    y += 5;

    // Tabell header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkColor);
    doc.text('Dato', 18, y + 5);
    doc.text('Tid', 42, y + 5);
    doc.text('Terapeut', 72, y + 5);
    doc.text('Moteform', 110, y + 5);
    doc.text('Status', 145, y + 5);
    doc.text('Pris', 175, y + 5);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    if (appointments.length === 0) {
      y += 6;
      doc.setTextColor(...grayColor);
      doc.text('Ingen timeavtaler registrert.', 18, y);
      y += 8;
    } else {
      appointments.forEach((apt, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y, 182, 7, 'F');
        }

        doc.setTextColor(...darkColor);
        doc.text(apt.date, 18, y + 5);
        doc.text(`${apt.startTime} - ${apt.endTime}`, 42, y + 5);
        doc.text(getTherapistNameForApt(apt), 72, y + 5);
        doc.text(apt.isOnline ? 'Online (videomote)' : 'Fysisk oppmote', 110, y + 5);

        const statusText = apt.status === 'confirmed' ? 'Bekreftet' : apt.status === 'cancelled' ? 'Avbestilt' : apt.status;
        doc.text(statusText, 145, y + 5);
        doc.text(`kr ${apt.price},-`, 175, y + 5);

        y += 7;
      });
    }

    // GDPR Bunntekst
    const footerY = Math.max(y + 12, 275);
    if (footerY > 280) {
      doc.addPage();
      doc.setFontSize(7);
      doc.setTextColor(...grayColor);
      doc.text('Dette dokumentet inneholder konfidensielle personopplysninger i henhold til GDPR artikkel 15.', 14, 285);
      doc.text('Generert fra Tid1Din.', 14, 289);
    } else {
      doc.setFontSize(7);
      doc.setTextColor(...grayColor);
      doc.text('Dette dokumentet inneholder konfidensielle personopplysninger i henhold til GDPR artikkel 15.', 14, footerY);
      doc.text('Generert fra Tid1Din.', 14, footerY + 4);
    }

    doc.save(`tid1din_mine_data_${customerNr}.pdf`);
  };

  const upcomingApts = appointments.filter(
    a => a.status === 'confirmed' && !isPast(new Date(`${a.date}T${a.endTime}`))
  );
  const nextAppointment = upcomingApts[0] || null;
  const otherUpcoming = upcomingApts.slice(1);
  const pastApts = appointments.filter(
    a => a.status === 'completed' || isPast(new Date(`${a.date}T${a.endTime}`)) || a.status === 'cancelled'
  );

  return (
    <div className="space-y-2.5 sm:space-y-6 w-full">
      
      {/* Velkomstbanner - full bredde på mobil */}
      <div className="bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-600 rounded-none sm:rounded-3xl p-4 sm:p-7 text-white shadow-sm w-full">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">
              Hei, {currentUser?.displayName}!
            </h1>
          </div>

          <button
            onClick={onNavigateToCalendar}
            className="px-3.5 py-2 rounded-xl bg-white text-sky-700 font-bold text-xs shadow-sm hover:bg-sky-50 transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Bestill time
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="mx-2 sm:mx-0 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)}>
            <X className="w-3.5 h-3.5 text-emerald-700" />
          </button>
        </div>
      )}

      {/* Neste Time Kort - Full bredde */}
      {nextAppointment ? (
        <div className="bg-white rounded-none sm:rounded-3xl p-4 sm:p-6 border-y sm:border border-slate-200 shadow-xs w-full">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-700 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Din neste time
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 capitalize">
                {format(new Date(nextAppointment.date), 'EEEE d. MMMM yyyy', { locale: nb })}
              </h2>

              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                {getTherapistNameForApt(nextAppointment) && (
                  <>
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-sky-600" />
                      {getTherapistNameForApt(nextAppointment)}
                    </span>
                    <span>•</span>
                  </>
                )}

                <span className="font-mono font-bold text-slate-900 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  {nextAppointment.startTime} - {nextAppointment.endTime}
                </span>

                <span>•</span>

                <span>
                  {nextAppointment.isOnline ? (
                    <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold">
                      <Video className="w-3.5 h-3.5" />
                      Online videomøte
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <MapPin className="w-3.5 h-3.5" />
                      Oppmøte
                    </span>
                  )}
                </span>

                <span>•</span>
                <span className="font-semibold text-slate-800">kr {nextAppointment.price},-</span>
              </div>

              {nextAppointment.isOnline && nextAppointment.meetingLink && (
                <div className="pt-1.5">
                  <a
                    href={nextAppointment.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-xs"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Åpne videomøte
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => setCancellingAptId(nextAppointment.id)}
              className="self-start sm:self-center px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Avbestill
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-none sm:rounded-3xl p-5 border-y sm:border border-slate-200 text-center space-y-2 w-full">
          <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Ingen aktive timeavtaler</h3>
          <p className="text-xs text-slate-500">
            Velg en ledig tid i kalenderen for å bestille time.
          </p>
          <button
            onClick={onNavigateToCalendar}
            className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white font-semibold text-xs shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Bestill time
          </button>
        </div>
      )}

      {/* Kommende timer & Historikk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-5 w-full">
        
        {/* Kommende timer */}
        <div className="bg-white rounded-none sm:rounded-3xl p-3.5 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-2.5 w-full">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            Flere kommende timer ({otherUpcoming.length})
          </h3>

          {otherUpcoming.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">Ingen flere timer på planen.</p>
          ) : (
            <div className="space-y-1.5">
              {otherUpcoming.map(apt => {
                const tName = getTherapistNameForApt(apt);
                return (
                  <div key={apt.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800 capitalize">
                        {format(new Date(apt.date), 'EEEE d. MMMM', { locale: nb })}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        {tName && (
                          <>
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <User className="w-3 h-3 text-sky-600" />
                              {tName}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>{apt.startTime} - {apt.endTime}</span>
                        <span>•</span>
                        <span>{apt.isOnline ? 'Online' : 'Fysisk'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setCancellingAptId(apt.id)}
                      className="text-rose-600 hover:text-rose-800 font-medium px-2 py-1 cursor-pointer"
                    >
                      Avbestill
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Historikk */}
        <div className="bg-white rounded-none sm:rounded-3xl p-3.5 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-2.5 w-full">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Tidligere timer ({pastApts.length})
          </h3>

          {pastApts.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">Ingen tidligere timer.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
              {pastApts.map(apt => {
                const tName = getTherapistNameForApt(apt);
                return (
                  <div key={apt.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs opacity-85">
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                        <span>{format(new Date(apt.date), 'd. MMM yyyy', { locale: nb })} ({apt.startTime})</span>
                        {tName && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="font-medium text-slate-700">{tName}</span>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">kr {apt.price},-</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      apt.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {apt.status === 'cancelled' ? 'Avbestilt' : 'Gjennomført'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* GDPR Dataeksport */}
      <div className="bg-white rounded-none sm:rounded-2xl p-3.5 sm:p-4 border-y sm:border border-slate-200 flex items-center justify-between w-full">
        <div>
          <h4 className="text-xs font-bold text-slate-900">GDPR Dataeksport</h4>
          <p className="text-[11px] text-slate-500">Last ned en kopi av alle dine registrerte data.</p>
        </div>

        <button
          onClick={handleExportGdprData}
          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <FileDown className="w-3.5 h-3.5 text-sky-600" />
          Last ned (PDF)
        </button>
      </div>

      {/* Modal for avbestilling */}
      {cancellingAptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full border border-slate-200 shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Avbestill time</h3>
            </div>

            <p className="text-xs text-slate-600">
              Er du sikker på at du vil avbestille timen?
            </p>

            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Årsak (valgfritt)..."
              className="w-full p-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
            />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setCancellingAptId(null)}
                className="w-1/2 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                Behold
              </button>
              <button
                onClick={handleCancelAppointment}
                className="w-1/2 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                Ja, avbestill
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
