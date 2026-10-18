import React, { useState, useEffect } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  isPast
} from 'date-fns';
import { nb } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  MapPin, 
  Check, 
  AlertCircle, 
  User, 
  Palmtree, 
  UserX, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { smsService } from '../../services/sms';
import { 
  Appointment, 
  WorkingHoursConfig, 
  Holiday, 
  UserProfile 
} from '../../types';
import { 
  parseMinutes,
  formatTherapistName,
  isDateInHoliday,
  isTherapistOnLeave
} from '../../utils/calendar';
import { TimeRangeSelector } from './TimeRangeSelector';

interface BookingViewProps {
  onNavigateToCalendar: () => void;
  onNavigateToDashboard: () => void;
  initialDate?: string;
}

// Regner ut ny sluttid basert på starttid og antall timer
const calculateEndTime = (start: string, hours: number): string => {
  const [hStr, mStr] = (start || '10:00').split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return '11:00';
  const totalMin = h * 60 + m + Math.round(hours * 60);
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

// Beregner varighet i minutter mellom to klokkeslett
const calculateDurationMinutes = (start: string, end: string): number => {
  const [sh, sm] = (start || '00:00').split(':').map(Number);
  const [eh, em] = (end || '00:00').split(':').map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 0) * 60 + (em || 0);
  return endMin > startMin ? endMin - startMin : 0;
};

// Formaterer varighet til en lesbar norsk tekst
const formatDurationDisplay = (minutes: number): string => {
  if (minutes <= 0) return 'Ugyldig tidsrom';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} minutter`;
  if (m === 0) return h === 1 ? '1 time' : `${h} timer`;
  return `${h} t ${m} min (${minutes} min)`;
};

export const BookingView: React.FC<BookingViewProps> = ({ 
  onNavigateToCalendar, 
  onNavigateToDashboard,
  initialDate 
}) => {
  const { currentUser } = useAuth();

  // Synkron forhåndslesing fra minne-cache for 0ms umiddelbar rendering
  const getInitialTherapistId = (): string => {
    const cachedUsers = dbService.getCachedUsers();
    const available = cachedUsers.filter(u => 
      (u.role === 'admin' || u.role === 'hovedadmin') &&
      (currentUser?.role !== 'client' || u.isActive !== false || !!u.leaveEndDate)
    );

    if (currentUser?.role === 'admin' || currentUser?.role === 'hovedadmin') {
      if (available.some(t => t.uid === currentUser.uid)) {
        return currentUser.uid;
      }
    } else if (currentUser?.role === 'client') {
      const cachedApts = dbService.getCachedAppointments()
        .filter(a => a.clientId === currentUser.uid && a.status !== 'cancelled')
        .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

      const lastAptWithTherapist = cachedApts.find(a => a.therapistId);
      if (lastAptWithTherapist && lastAptWithTherapist.therapistId && available.some(t => t.uid === lastAptWithTherapist.therapistId)) {
        return lastAptWithTherapist.therapistId;
      }
      const savedPref = localStorage.getItem(`dintid_client_therapist_${currentUser.uid}`);
      if (savedPref && available.some(t => t.uid === savedPref)) {
        return savedPref;
      }
    }

    const activeNonLeave = available.find(t => !isTherapistOnLeave(t));
    return activeNonLeave?.uid || available[0]?.uid || '';
  };

  const initialTherapistId = getInitialTherapistId();
  const initialCachedWh = dbService.getCachedWorkingHours(initialTherapistId);
  const initialCachedApts = dbService.getCachedAppointments();
  const initialCachedHols = dbService.getCachedHolidays();
  const initialCachedUsers = dbService.getCachedUsers();
  const initialCachedTherapists = initialCachedUsers.filter(u => 
    (u.role === 'admin' || u.role === 'hovedadmin') &&
    (currentUser?.role !== 'client' || u.isActive !== false || !!u.leaveEndDate)
  );

  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(initialTherapistId);
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig>(initialCachedWh);
  const [appointments, setAppointments] = useState<Appointment[]>(initialCachedApts);
  const [holidays, setHolidays] = useState<Holiday[]>(initialCachedHols);
  const [therapists, setTherapists] = useState<UserProfile[]>(initialCachedTherapists);
  const [clients, setClients] = useState<UserProfile[]>(() => initialCachedUsers.filter(u => u.role === 'client'));

  // Datovelger
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialDate) return new Date(`${initialDate}T12:00:00`);
    return new Date();
  });
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (initialDate) return new Date(`${initialDate}T12:00:00`);
    return new Date();
  });

  // Manuell tid og forslag til sluttid
  const [startTime, setStartTime] = useState<string>('10:00');
  const [endTime, setEndTime] = useState<string>('11:00');
  const [suggestedHours, setSuggestedHours] = useState<number | null>(1);
  const [price, setPrice] = useState<number>(() => initialCachedWh?.prices?.single ?? 950);

  // Møteform og notat
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    if (currentUser?.role === 'client') return currentUser.uid;
    const clientList = initialCachedUsers.filter(u => u.role === 'client');
    return clientList[0]?.uid || '';
  });
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Bekreftet booking-kvittering
  const [confirmedBooking, setConfirmedBooking] = useState<{
    appointment: Appointment;
    smsStatus: string;
  } | null>(null);

  useEffect(() => {
    loadData();

    const handleDataUpdate = (e: any) => {
      const type = e?.detail?.type;
      if (type === 'appointments' || !type) {
        setAppointments(dbService.getCachedAppointments());
      }
      if (type === 'working_hours' || !type) {
        setWorkingHours(dbService.getCachedWorkingHours(selectedTherapistId));
      }
      if (type === 'users' || !type) {
        const uList = dbService.getCachedUsers();
        setClients(uList.filter(u => u.role === 'client'));
        setTherapists(uList.filter(u => 
          (u.role === 'admin' || u.role === 'hovedadmin') &&
          (currentUser?.role !== 'client' || u.isActive !== false || !!u.leaveEndDate)
        ));
      }
    };

    window.addEventListener('dintid_data_updated', handleDataUpdate);
    return () => window.removeEventListener('dintid_data_updated', handleDataUpdate);
  }, [currentUser?.uid, selectedTherapistId]);

  useEffect(() => {
    if (initialDate) {
      const d = new Date(`${initialDate}T12:00:00`);
      setSelectedDate(d);
      setCurrentDate(d);
    }
  }, [initialDate]);

  const loadData = async () => {
    const targetTherapistId = selectedTherapistId || initialTherapistId;
    const [apts, users, hList, wh] = await Promise.all([
      dbService.getAppointments(),
      dbService.getUsers(),
      dbService.getHolidays(),
      dbService.getWorkingHours(targetTherapistId)
    ]);
    
    setAppointments(apts);
    const clientList = users.filter(u => u.role === 'client');
    setClients(clientList);
    setHolidays(hList);

    const availableTherapists = users.filter(u => 
      (u.role === 'admin' || u.role === 'hovedadmin') &&
      (currentUser?.role !== 'client' || u.isActive !== false || !!u.leaveEndDate)
    );
    setTherapists(availableTherapists);
    setWorkingHours(wh);

    if (currentUser?.role === 'client') {
      setSelectedClientId(currentUser.uid);
    } else if (clientList.length > 0 && !selectedClientId) {
      setSelectedClientId(clientList[0].uid);
    }
  };

  const handleTherapistChange = async (therapistId: string) => {
    setSelectedTherapistId(therapistId);
    if (currentUser?.role === 'client') {
      localStorage.setItem(`dintid_client_therapist_${currentUser.uid}`, therapistId);
    }

    const cachedWh = dbService.getCachedWorkingHours(therapistId);
    setWorkingHours(cachedWh);

    // Oppdater pris i henhold til ny behandlers timepriser
    if (suggestedHours === 1) {
      setPrice(cachedWh?.prices?.single ?? 950);
    } else if (suggestedHours === 2) {
      setPrice(cachedWh?.prices?.double ?? 1800);
    } else if (suggestedHours === 3) {
      setPrice(cachedWh?.prices?.triple ?? 2600);
    }

    const freshWh = await dbService.getWorkingHours(therapistId);
    setWorkingHours(freshWh);
  };

  const selectedTherapist = therapists.find(t => t.uid === selectedTherapistId) || therapists[0];

  const therapistHolidays = holidays.filter(h => 
    !h.therapistId || h.therapistId === 'all' || h.therapistId === selectedTherapistId
  );

  const therapistAppointments = appointments.filter(a => {
    if (a.therapistId) {
      return a.therapistId === selectedTherapistId;
    }
    return therapists[0]?.uid === selectedTherapistId;
  });

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedDateOnLeave = isTherapistOnLeave(selectedTherapist, selectedDateStr);
  const selectedDateHoliday = isDateInHoliday(selectedDateStr, therapistHolidays);

  // Eksisterende avtaler for behandleren på valgt dag
  const dayAppointments = therapistAppointments.filter(
    a => a.date === selectedDateStr && a.status !== 'cancelled'
  ).sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Kollisjonssjekk for valgt start- og sluttid
  const startMin = parseMinutes(startTime);
  const endMin = parseMinutes(endTime);
  const durationMinutes = calculateDurationMinutes(startTime, endTime);
  const targetClientId = currentUser?.role === 'client' ? currentUser.uid : selectedClientId;

  // Kollisjon for behandler
  const therapistCollision = dayAppointments.find(a => {
    const aStart = parseMinutes(a.startTime);
    const aEnd = parseMinutes(a.endTime);
    return startMin < aEnd && endMin > aStart;
  });

  // Kollisjon for klient (uansett behandler)
  const clientCollision = appointments.find(a => {
    if (a.date !== selectedDateStr || a.status === 'cancelled') return false;
    if (!targetClientId || a.clientId !== targetClientId) return false;
    const aStart = parseMinutes(a.startTime);
    const aEnd = parseMinutes(a.endTime);
    return startMin < aEnd && endMin > aStart;
  });

  const collidingAppointment = therapistCollision || clientCollision;

  const clinicSlotMinutes = workingHours?.slotDurationMinutes || 45;

  // Håndter valg av forslag for varighet (enkelttime, dobbelttime eller trippeltime)
  const applyDurationMinutes = (minutes: number) => {
    setSuggestedHours(minutes / 60);
    const newEnd = calculateEndTime(startTime, minutes / 60);
    setEndTime(newEnd);

    if (minutes === clinicSlotMinutes) {
      setPrice(workingHours?.prices?.single ?? 950);
    } else if (minutes === clinicSlotMinutes * 2) {
      setPrice(workingHours?.prices?.double ?? 1800);
    } else if (minutes === clinicSlotMinutes * 3) {
      setPrice(workingHours?.prices?.triple ?? 2600);
    }
  };

  // Når starttid endres manuelt
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    if (suggestedHours) {
      setEndTime(calculateEndTime(newStart, suggestedHours));
    } else {
      const currentDur = calculateDurationMinutes(startTime, endTime);
      if (currentDur > 0) {
        setEndTime(calculateEndTime(newStart, currentDur / 60));
      }
    }
  };

  // Når sluttid endres manuelt (IKKE låst tidspunkt)
  const handleEndTimeChange = (newEnd: string) => {
    setEndTime(newEnd);
    const dur = calculateDurationMinutes(startTime, newEnd);
    if (dur === 60) {
      setSuggestedHours(1);
      setPrice(workingHours?.prices?.single ?? 950);
    } else if (dur === 120) {
      setSuggestedHours(2);
      setPrice(workingHours?.prices?.double ?? 1800);
    } else if (dur === 180) {
      setSuggestedHours(3);
      setPrice(workingHours?.prices?.triple ?? 2600);
    } else if (dur === 45) {
      setSuggestedHours(0.75);
      setPrice(workingHours?.prices?.single ?? 950);
    } else {
      setSuggestedHours(null);
      if (dur <= 60) {
        setPrice(workingHours?.prices?.single ?? 950);
      } else if (dur <= 120) {
        setPrice(workingHours?.prices?.double ?? 1800);
      } else {
        setPrice(workingHours?.prices?.triple ?? 2600);
      }
    }
  };

  const handleSelectDate = (day: Date) => {
    setSelectedDate(day);
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayApts = therapistAppointments.filter(
      a => a.date === dayStr && a.status !== 'cancelled'
    ).sort((a, b) => a.startTime.localeCompare(b.startTime));

    const durHours = suggestedHours || (clinicSlotMinutes / 60);
    const durMin = Math.round(durHours * 60);

    let initialStart = '10:00';
    const initStartMin = parseMinutes(initialStart);
    const initEndMin = initStartMin + durMin;

    const overlaps10 = dayApts.find(a => {
      const aStart = parseMinutes(a.startTime);
      const aEnd = parseMinutes(a.endTime);
      return initStartMin < aEnd && initEndMin > aStart;
    });

    if (overlaps10) {
      const nextCandidateMin = parseMinutes(overlaps10.endTime);
      const overlapsNext = dayApts.find(a => {
        const aStart = parseMinutes(a.startTime);
        const aEnd = parseMinutes(a.endTime);
        return nextCandidateMin < aEnd && (nextCandidateMin + durMin) > aStart;
      });

      if (!overlapsNext) {
        initialStart = overlaps10.endTime;
      } else {
        const lastApt = dayApts[dayApts.length - 1];
        if (lastApt) {
          initialStart = lastApt.endTime;
        }
      }
    }

    setStartTime(initialStart);
    setEndTime(calculateEndTime(initialStart, durHours));
  };

  const handleConfirmBooking = async () => {
    if (!currentUser) {
      alert('Du må være innlogget for å bestille time.');
      return;
    }

    if (!startTime || !endTime) {
      alert('Vennligst oppgi både start- og sluttidspunkt.');
      return;
    }

    if (durationMinutes <= 0) {
      alert('Sluttidspunkt må være etter starttidspunkt.');
      return;
    }

    if (therapistCollision) {
      alert(`Kan ikke bestille: Tidspunktet kl. ${startTime}–${endTime} overlapper med en eksisterende avtale for behandler (kl. ${therapistCollision.startTime}–${therapistCollision.endTime}). Vennligst velg et annet tidspunkt.`);
      return;
    }

    if (clientCollision) {
      alert(`Kan ikke bestille: Klienten har allerede en avtale på dette tidspunktet (kl. ${clientCollision.startTime}–${clientCollision.endTime}). Vennligst velg et annet tidspunkt.`);
      return;
    }

    let clientObj: UserProfile | undefined;
    if (currentUser?.role === 'client') {
      clientObj = currentUser;
    } else {
      clientObj = clients.find(c => c.uid === selectedClientId) || clients[0];
    }

    if (!clientObj) {
      alert('Vennligst velg en klient for timen.');
      return;
    }

    const now = new Date();
    const targetStartDateTime = new Date(`${selectedDateStr}T${startTime}`);
    if (targetStartDateTime < now) {
      alert('Det er ikke mulig å opprette avtaler tilbake i tid. Vennligst velg et fremtidig tidspunkt.');
      return;
    }

    setIsSubmittingBooking(true);

    try {
      const appointmentId = 'apt_' + Date.now();
      const meetingLink = isOnlineMeeting ? smsService.generateMeetingLink(appointmentId) : undefined;

      let slotType: 'single' | 'double' | 'triple' = 'single';
      if (durationMinutes > 120) slotType = 'triple';
      else if (durationMinutes > 60) slotType = 'double';

      const newAppointment: Appointment = {
        id: appointmentId,
        clientId: clientObj.uid,
        clientNumber: clientObj.customerNumber || 1000,
        clientName: clientObj.displayName,
        clientPhone: clientObj.phone || '',
        clientEmail: clientObj.email || '',
        therapistId: selectedTherapist?.uid,
        therapistName: formatTherapistName(selectedTherapist?.displayName),
        date: selectedDateStr,
        startTime,
        endTime,
        durationMinutes,
        slotType,
        price,
        isOnline: isOnlineMeeting,
        ...(meetingLink ? { meetingLink } : {}),
        status: 'confirmed',
        ...(bookingNotes ? { notes: bookingNotes } : {}),
        createdAt: new Date().toISOString()
      };

      await dbService.saveAppointment(newAppointment);

      // Send SMS med sikker timeout (maks 3,5 sek)
      let smsStatus = 'simulert';
      try {
        const smsLog = await Promise.race([
          smsService.sendBookingConfirmation(newAppointment),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('SMS timeout')), 3500))
        ]);
        if (smsLog?.status === 'sent') smsStatus = 'sendt';
      } catch (smsErr) {
        console.warn('SMS-sending feilet eller tok lang tid:', smsErr);
      }

      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'create_appointment',
        `Bestilte time hos ${selectedTherapist?.displayName || 'terapeut'} for ${clientObj.displayName} den ${newAppointment.date} kl. ${newAppointment.startTime}–${newAppointment.endTime}`
      );

      await loadData();
      setConfirmedBooking({ appointment: newAppointment, smsStatus });
      setBookingNotes('');
    } catch (e: any) {
      alert('Feil ved bestilling: ' + e.message);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Kalenderintervall
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      
      {/* TITTEL-BANNER */}
      <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-4 sm:p-6 shadow-xs w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Timebestilling</span>
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              Bestill time
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Velg dato, starttidspunkt og ønsket varighet. Sluttidspunkt kan justeres fritt.
            </p>
          </div>
        </div>
      </div>

      {/* KVITTERING FOR FULLFØRT BOOKING */}
      {confirmedBooking && (
        <div className="bg-white rounded-none sm:rounded-3xl p-5 sm:p-8 border-2 border-emerald-300 shadow-lg space-y-4 w-full animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                Timen din er bekreftet!
              </h2>
              <p className="text-xs text-slate-500">
                SMS-varsel er {confirmedBooking.smsStatus === 'sendt' ? 'sendt' : 'registrert'} til {confirmedBooking.appointment.clientPhone || 'ditt telefonnummer'}.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-semibold block text-[11px] uppercase">Dato & Klokkeslett</span>
              <span className="font-bold text-slate-900 capitalize text-sm">
                {format(new Date(confirmedBooking.appointment.date), 'EEEE d. MMMM yyyy', { locale: nb })}
              </span>
              <span className="font-mono text-sky-800 font-bold block mt-0.5">
                kl. {confirmedBooking.appointment.startTime} – {confirmedBooking.appointment.endTime}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-semibold block text-[11px] uppercase">Behandler</span>
              <span className="font-bold text-slate-900 text-sm">
                {confirmedBooking.appointment.therapistName || 'Terapeut'}
              </span>
              <span className="text-slate-500 block mt-0.5">
                {confirmedBooking.appointment.isOnline ? 'Online videomøte' : 'Fysisk oppmøte i klinikk'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-semibold block text-[11px] uppercase">Varighet & Pris</span>
              <span className="font-bold text-slate-900 text-sm">
                {formatDurationDisplay(confirmedBooking.appointment.durationMinutes)}
              </span>
              <span className="font-semibold text-emerald-700 block mt-0.5">
                kr {confirmedBooking.appointment.price},-
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onNavigateToCalendar}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Se timen i Kalender</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onNavigateToDashboard}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Gå til pasientoversikt
            </button>

            <button
              onClick={() => setConfirmedBooking(null)}
              className="px-4 py-2.5 rounded-xl text-sky-700 hover:text-sky-900 text-xs font-semibold cursor-pointer ml-auto"
            >
              Bestill en ny time &rarr;
            </button>
          </div>
        </div>
      )}

      {/* BEHANDLERVELGER HVIS FLERE */}
      {therapists.length > 1 && (
        <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-4 shadow-xs space-y-2.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Velg behandler
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {therapists.map((t) => {
              const isSel = t.uid === selectedTherapistId;
              const onLeave = isTherapistOnLeave(t);
              return (
                <button
                  key={t.uid}
                  type="button"
                  onClick={() => handleTherapistChange(t.uid)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSel 
                      ? 'border-sky-600 bg-sky-50/70 ring-1 ring-sky-500 shadow-xs' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-900 block truncate">
                        {formatTherapistName(t.displayName)}
                      </span>
                      {onLeave ? (
                        <span className="text-[10px] text-amber-700 font-medium">I permisjon</span>
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-medium">Tilgjengelig</span>
                      )}
                    </div>
                  </div>
                  {isSel && <Check className="w-4 h-4 text-sky-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* HOVEDDEL: KALENDER (VENSTRE) + TIMEBESTILLINGSSKJEMA (HØYRE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 w-full">
        
        {/* DATOVELGER (5 KOLONNER PÅ STOR SKJERM) */}
        <div className="lg:col-span-5 bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-3 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Velg dato
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                aria-label="Forrige måned"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-xs sm:text-sm text-slate-900 capitalize px-2">
                {format(currentDate, 'MMMM yyyy', { locale: nb })}
              </span>
              <button
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                aria-label="Neste måned"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 mb-1.5 uppercase">
              <span>Man</span>
              <span>Tir</span>
              <span>Ons</span>
              <span>Tor</span>
              <span>Fre</span>
              <span>Lør</span>
              <span>Søn</span>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDayToday = isToday(day);
                const isPastDate = isPast(day) && !isDayToday;
                const isInactive = isTherapistOnLeave(selectedTherapist, dateStr);
                const dateHoliday = isDateInHoliday(dateStr, therapistHolidays);

                const aptsCount = therapistAppointments.filter(
                  a => a.date === dateStr && a.status !== 'cancelled'
                ).length;

                return (
                  <button
                    key={day.toISOString()}
                    disabled={isPastDate}
                    onClick={() => handleSelectDate(day)}
                    className={`min-h-[50px] sm:min-h-[60px] p-1.5 rounded-xl flex flex-col justify-between items-center transition-all border cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-sky-600 bg-sky-600 text-white border-sky-600 shadow-xs'
                        : isPastDate
                          ? 'bg-slate-50/50 text-slate-300 border-slate-100 opacity-60 cursor-not-allowed'
                          : dateHoliday || isInactive
                            ? 'bg-amber-50/60 text-amber-800 border-amber-200 hover:border-amber-300'
                            : aptsCount > 0
                              ? 'bg-sky-50/40 text-slate-800 border-sky-200 hover:border-sky-400'
                              : 'bg-white text-slate-800 border-slate-200 hover:border-sky-300 hover:bg-sky-50/30'
                    } ${!isCurrentMonth ? 'opacity-30' : 'opacity-100'}`}
                  >
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : ''}`}>
                      {format(day, 'd')}
                    </span>

                    {/* Indikator */}
                    {isSelected ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    ) : dateHoliday ? (
                      <span className="text-[9px] text-amber-700 font-semibold truncate max-w-full">Ferie</span>
                    ) : isInactive ? (
                      <span className="text-[9px] text-amber-700 font-semibold truncate max-w-full">Permisjon</span>
                    ) : aptsCount > 0 ? (
                      <span className="text-[9px] font-mono font-bold text-sky-800 bg-sky-100 px-1 rounded truncate">
                        {aptsCount} {aptsCount === 1 ? 'time' : 'timer'}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* TIMEBESTILLINGSSKJEMA (7 KOLONNER PÅ STOR SKJERM) */}
        <div className="lg:col-span-7 bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          
          <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">
                2. Velg tidspunkt & bestill
              </span>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 capitalize mt-0.5">
                {format(selectedDate, 'EEEE d. MMMM yyyy', { locale: nb })}
              </h3>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-sky-600" />
              <span>{formatTherapistName(selectedTherapist?.displayName)}</span>
            </div>
          </div>

          {/* Varsel ved ferie eller permisjon */}
          {selectedDateHoliday && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Behandleren har registrert fravær: <strong>{selectedDateHoliday.title}</strong></span>
            </div>
          )}
          {isSelectedDateOnLeave && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <UserX className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Behandleren er registrert i permisjon på denne datoen.</span>
            </div>
          )}

          {/* Eksisterende avtaler for valgt dato */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
              Opptatte tider denne dagen ({dayAppointments.length})
            </span>
            {dayAppointments.length === 0 ? (
              <p className="text-slate-500 italic">Ingen andre avtaler registrert denne dagen.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {dayAppointments.map(a => {
                  const clientLabel = (currentUser?.role === 'admin' && !currentUser?.permissions?.canViewClientName)
                    ? `Klient #${a.clientNumber}`
                    : (currentUser?.role === 'client' && a.clientId !== currentUser.uid)
                      ? 'Opptatt'
                      : a.clientName;

                  return (
                    <span 
                      key={a.id} 
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800 shadow-2xs"
                    >
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{a.startTime} – {a.endTime}</span>
                      <span className="text-slate-500 font-sans font-normal ml-1">({clientLabel})</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Skjema */}
          <div className="space-y-4 pt-1">
            
            {/* Klientvelger hvis admin */}
            {currentUser?.role !== 'client' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Klient
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none bg-white"
                >
                  {clients.map(c => {
                    const name = (currentUser?.role === 'admin' && !currentUser?.permissions?.canViewClientName)
                      ? `Klient #${c.customerNumber}`
                      : `${c.displayName} (#${c.customerNumber})`;
                    return (
                      <option key={c.uid} value={c.uid}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* TIDSPUNKT: STARTTID OG SLUTTID (iPad/mobil-sikret uten overlapp) */}
            <TimeRangeSelector
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={handleStartTimeChange}
              onEndTimeChange={handleEndTimeChange}
              durationMinutes={durationMinutes}
            />

            {/* Hurtigvalg av varighet tilpasset Klinikk-oppsettet (uten 'Forslag til sluttid:'-tekst) */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => applyDurationMinutes(clinicSlotMinutes)}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                  durationMinutes === clinicSlotMinutes
                    ? 'border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500 font-bold shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <span className="block text-xs font-bold">Enkelttime ({clinicSlotMinutes}m)</span>
                <span className="block text-[10px] text-sky-700 font-semibold mt-0.5">kr {workingHours?.prices?.single ?? 950},-</span>
              </button>

              <button
                type="button"
                onClick={() => applyDurationMinutes(clinicSlotMinutes * 2)}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                  durationMinutes === clinicSlotMinutes * 2
                    ? 'border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500 font-bold shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <span className="block text-xs font-bold">Dobbelttime ({clinicSlotMinutes * 2}m)</span>
                <span className="block text-[10px] text-sky-700 font-semibold mt-0.5">kr {workingHours?.prices?.double ?? 1800},-</span>
              </button>

              <button
                type="button"
                onClick={() => applyDurationMinutes(clinicSlotMinutes * 3)}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                  durationMinutes === clinicSlotMinutes * 3
                    ? 'border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500 font-bold shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <span className="block text-xs font-bold">Trippeltime ({clinicSlotMinutes * 3}m)</span>
                <span className="block text-[10px] text-sky-700 font-semibold mt-0.5">kr {workingHours?.prices?.triple ?? 2600},-</span>
              </button>
            </div>

            {/* BEREGNET VARIGHET OG PRIS */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Beregnet varighet</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {formatDurationDisplay(durationMinutes)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Timepris</span>
                <span className="font-extrabold text-emerald-700 text-sm">
                  kr {price},-
                </span>
              </div>
            </div>

            {/* MØTEFORM */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Møteform
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsOnlineMeeting(false)}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    !isOnlineMeeting ? 'border-sky-600 bg-sky-50 text-sky-900 font-bold ring-1 ring-sky-500' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-sky-600" />
                  <span className="text-xs">Fysisk møte i klinikk</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOnlineMeeting(true)}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isOnlineMeeting ? 'border-sky-600 bg-sky-50 text-sky-900 font-bold ring-1 ring-sky-500' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <Video className="w-4 h-4 text-sky-600" />
                  <span className="text-xs">Online videomøte</span>
                </button>
              </div>
            </div>

            {/* BESKJED / NOTAT */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Beskjed eller notat (valgfritt)
              </label>
              <textarea
                rows={2}
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Evt. kort beskjed til behandleren..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none bg-white"
              />
            </div>

            {/* OVERLAPP-ADVARSEL */}
            {therapistCollision && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900">
                    Tidspunktet er opptatt for behandler
                  </p>
                  <p className="text-rose-800 mt-0.5">
                    Det er allerede registrert en avtale fra kl. <strong>{therapistCollision.startTime}</strong> til <strong>{therapistCollision.endTime}</strong> for {formatTherapistName(selectedTherapist?.displayName)} denne dagen{therapistCollision.clientName && currentUser?.role !== 'client' ? ` (${therapistCollision.clientName})` : ''}.
                  </p>
                </div>
              </div>
            )}

            {clientCollision && clientCollision.id !== therapistCollision?.id && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900">
                    Tidspunktet er opptatt for klienten
                  </p>
                  <p className="text-rose-800 mt-0.5">
                    Klienten har allerede en avtale fra kl. <strong>{clientCollision.startTime}</strong> til <strong>{clientCollision.endTime}</strong> denne dagen{clientCollision.therapistName ? ` hos ${clientCollision.therapistName}` : ''}.
                  </p>
                </div>
              </div>
            )}

            {new Date(`${selectedDateStr}T${startTime}`) < new Date() && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Valgt tidspunkt ({selectedDateStr} kl. {startTime}) er tilbake i tid. Velg et tidspunkt frem i tid.</span>
              </div>
            )}

            {/* BEKREFT-KNAPP */}
            <div className="pt-2">
              <button
                type="button"
                disabled={
                  isSubmittingBooking || 
                  durationMinutes <= 0 || 
                  Boolean(therapistCollision || clientCollision) ||
                  (new Date(`${selectedDateStr}T${startTime}`) < new Date())
                }
                onClick={handleConfirmBooking}
                className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingBooking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Lagrer bestilling...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Bekreft timebestilling (kl. {startTime} – {endTime})</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
