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
  addWeeks, 
  subWeeks,
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
  X,
  AlertCircle,
  User,
  Palmtree,
  UserX,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { smsService } from '../../services/sms';
import { 
  Appointment, 
  WorkingHoursConfig, 
  Holiday, 
  UserProfile, 
  SlotTypeOption 
} from '../../types';
import { 
  generateDaySlots, 
  getDayAvailability, 
  DEFAULT_SLOT_TYPES, 
  GeneratedSlot, 
  formatMinutes, 
  parseMinutes,
  formatTherapistName,
  checkLunchCollision,
  findContinuousAlternativeSlots,
  isDateInHoliday,
  isTherapistOnLeave
} from '../../utils/calendar';

export const CalendarView: React.FC = () => {
  const { currentUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  
  // Terapeutvalg state
  const [therapists, setTherapists] = useState<UserProfile[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [isDaySlotsModalOpen, setIsDaySlotsModalOpen] = useState(false);

  // Booking modal state
  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingSlotType, setBookingSlotType] = useState<SlotTypeOption>(DEFAULT_SLOT_TYPES[0]);
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccessMessage, setBookingSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const loadData = async () => {
    const apts = await dbService.getAppointments();
    const users = await dbService.getUsers();
    const hList = await dbService.getHolidays();
    
    setAppointments(apts);
    setClients(users.filter(u => u.role === 'client'));
    setHolidays(hList);

    // Hent alle tilgjengelige behandlere/terapeuter
    // Hvis klient er innlogget, skjul kun behandlere som er permanent inaktive uten sluttdato
    const availableTherapists = users.filter(u => 
      (u.role === 'admin' || u.role === 'hovedadmin') &&
      (currentUser?.role !== 'client' || u.isActive !== false || !!u.leaveEndDate)
    );
    setTherapists(availableTherapists);

    // Forhåndsvalg av terapeut:
    let preselectedId = '';
    if (currentUser?.role === 'admin' || currentUser?.role === 'hovedadmin') {
      // Når terapeuten er innlogget skal sin egen kalender være forvalgt
      if (availableTherapists.some(t => t.uid === currentUser.uid)) {
        preselectedId = currentUser.uid;
      }
    } else if (currentUser?.role === 'client') {
      // Forhåndsvalg av forrige terapeut hvis klient har hatt time før
      const clientApts = apts
        .filter(a => a.clientId === currentUser.uid && a.status !== 'cancelled')
        .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

      const lastAptWithTherapist = clientApts.find(a => a.therapistId);
      if (lastAptWithTherapist && lastAptWithTherapist.therapistId && availableTherapists.some(t => t.uid === lastAptWithTherapist.therapistId)) {
        preselectedId = lastAptWithTherapist.therapistId;
      } else {
        const savedPref = localStorage.getItem(`dintid_client_therapist_${currentUser.uid}`);
        if (savedPref && availableTherapists.some(t => t.uid === savedPref)) {
          preselectedId = savedPref;
        }
      }
    }

    if (!preselectedId || !availableTherapists.some(t => t.uid === preselectedId)) {
      preselectedId = availableTherapists[0]?.uid || '';
    }

    setSelectedTherapistId(preselectedId);

    // Hent arbeidstider og priser spesifikt for valgt terapeut
    if (preselectedId) {
      const wh = await dbService.getWorkingHours(preselectedId);
      setWorkingHours(wh);
    } else {
      const wh = await dbService.getWorkingHours();
      setWorkingHours(wh);
    }

    if (currentUser?.role === 'client') {
      setSelectedClientId(currentUser.uid);
    } else if (users.length > 0) {
      const firstClient = users.find(u => u.role === 'client');
      if (firstClient) setSelectedClientId(firstClient.uid);
    }
  };

  const handleTherapistChange = async (therapistId: string) => {
    setSelectedTherapistId(therapistId);
    if (currentUser?.role === 'client') {
      localStorage.setItem(`dintid_client_therapist_${currentUser.uid}`, therapistId);
    }
    const wh = await dbService.getWorkingHours(therapistId);
    setWorkingHours(wh);
  };

  const selectedTherapist = therapists.find(t => t.uid === selectedTherapistId) || therapists[0];

  // Ferier for valgt behandler (eller felles for alle)
  const therapistHolidays = holidays.filter(h => 
    !h.therapistId || h.therapistId === 'all' || h.therapistId === selectedTherapistId
  );

  // Filtrer avtaler som gjelder for valgt terapeut
  const therapistAppointments = appointments.filter(a => {
    if (a.therapistId) {
      return a.therapistId === selectedTherapistId;
    }
    // For eldre avtaler uten eksplisitt therapistId, tilknytt til første standard terapeut
    return therapists[0]?.uid === selectedTherapistId;
  });

  const isClient = currentUser?.role === 'client';

  // Kundens egne bekreftede avtaler
  const clientAppointments = appointments.filter(
    a => a.clientId === currentUser?.uid && a.status === 'confirmed'
  ).sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime());

  const clientUpcomingAppointments = clientAppointments.filter(
    a => !isPast(new Date(`${a.date}T${a.endTime}`))
  );

  const getTherapistDisplayName = (therapistId?: string, fallbackName?: string) => {
    if (fallbackName) return formatTherapistName(fallbackName);
    if (therapistId) {
      const found = therapists.find(t => t.uid === therapistId);
      if (found) return formatTherapistName(found.displayName);
    }
    return formatTherapistName(selectedTherapist?.displayName);
  };

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedDateOnLeave = isTherapistOnLeave(selectedTherapist, selectedDateStr);
  const daySlots: GeneratedSlot[] = (workingHours && !isSelectedDateOnLeave)
    ? generateDaySlots(selectedDateStr, workingHours, therapistAppointments, therapistHolidays)
    : [];

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsDaySlotsModalOpen(true);
  };

  // Sjekk om valgt time og varighet kolliderer med lunsjpause
  const lunchCollision = (selectedSlot && workingHours)
    ? checkLunchCollision(selectedSlot.startTime, bookingSlotType.durationMinutes, workingHours)
    : { collides: false, lunchDurationMinutes: 0 };

  // Forslag til alternative sammenhengende tider før eller etter lunsj
  const alternativeSlots = (lunchCollision.collides && selectedSlot && workingHours)
    ? findContinuousAlternativeSlots(
        daySlots,
        bookingSlotType.durationMinutes,
        workingHours,
        therapistAppointments,
        selectedSlot.date
      )
    : {};

  const slotTypeOptions: SlotTypeOption[] = [
    {
      type: 'single',
      title: 'Enkelttime',
      durationMinutes: 45,
      price: workingHours?.prices?.single ?? 850
    },
    {
      type: 'double',
      title: 'Dobbelttime',
      durationMinutes: 90,
      price: workingHours?.prices?.double ?? 1600
    },
    {
      type: 'triple',
      title: 'Trippeltime',
      durationMinutes: 135,
      price: workingHours?.prices?.triple ?? 2300
    }
  ];

  const handleOpenBooking = (slot: GeneratedSlot) => {
    if (!slot.isAvailable) return;
    setSelectedSlot(slot);
    setBookingSlotType(slotTypeOptions[0]);
    setIsDaySlotsModalOpen(false);
    setIsBookingModalOpen(true);
    setBookingSuccessMessage(null);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !workingHours || !currentUser) return;
    setIsSubmittingBooking(true);

    try {
      let clientObj: UserProfile | undefined;
      if (currentUser.role === 'client') {
        clientObj = currentUser;
      } else {
        clientObj = clients.find(c => c.uid === selectedClientId);
      }

      if (!clientObj) {
        alert('Vennligst velg en klient for timen.');
        setIsSubmittingBooking(false);
        return;
      }

      const startMin = parseMinutes(selectedSlot.startTime);
      // Dersom timen kolliderer med lunsj og bekreftes, utvides slutten med lunsjpausen slik at timen gjennomføres
      const totalSpanMinutes = lunchCollision.collides
        ? bookingSlotType.durationMinutes + lunchCollision.lunchDurationMinutes
        : bookingSlotType.durationMinutes;
      const endMin = startMin + totalSpanMinutes;
      const calculatedEndTime = formatMinutes(endMin);

      const appointmentId = 'apt_' + Date.now();
      const meetingLink = isOnlineMeeting ? smsService.generateMeetingLink(appointmentId) : undefined;

      const finalNotes = lunchCollision.collides && lunchCollision.lunchBreak
        ? [
            bookingNotes,
            `(Merk: Timen blir avbrutt av ${lunchCollision.lunchBreak.title || 'lunsjpause'} kl. ${lunchCollision.lunchBreak.start}–${lunchCollision.lunchBreak.end})`
          ].filter(Boolean).join(' ')
        : bookingNotes;

      const newAppointment: Appointment = {
        id: appointmentId,
        clientId: clientObj.uid,
        clientNumber: clientObj.customerNumber || 1000,
        clientName: clientObj.displayName,
        clientPhone: clientObj.phone || '',
        clientEmail: clientObj.email || '',
        therapistId: selectedTherapist?.uid,
        therapistName: formatTherapistName(selectedTherapist?.displayName),
        date: selectedSlot.date,
        startTime: selectedSlot.startTime,
        endTime: calculatedEndTime,
        durationMinutes: bookingSlotType.durationMinutes,
        slotType: bookingSlotType.type,
        price: bookingSlotType.price,
        isOnline: isOnlineMeeting,
        ...(meetingLink ? { meetingLink } : {}),
        status: 'confirmed',
        ...(finalNotes ? { notes: finalNotes } : {}),
        createdAt: new Date().toISOString()
      };

      await dbService.saveAppointment(newAppointment);
      const smsLog = await smsService.sendBookingConfirmation(newAppointment);

      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'create_appointment',
        `Bestilte ${bookingSlotType.title} hos ${selectedTherapist?.displayName || 'terapeut'} for ${clientObj.displayName} den ${newAppointment.date} kl. ${newAppointment.startTime}`
      );

      await loadData();
      setIsBookingModalOpen(false);
      setBookingSuccessMessage(`Timen er bekreftet! SMS-varsel ${smsLog?.status === 'sent' ? 'sendt' : 'registrert'} til ${clientObj.phone || 'klient'}.`);
      setSelectedSlot(null);
      setBookingNotes('');
    } catch (e: any) {
      alert('Feil ved bestilling: ' + e.message);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const displayDays = viewMode === 'month' ? monthDays : weekDays;

  return (
    <div className="space-y-2 sm:space-y-5 w-full">
      
      {/* Toppkontroller - Responsivt og lekkert på mobil og desktop */}
      <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-3 sm:p-5 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Rad 1 på mobil: Månedstittel og navigasjonspiler (<, I dag, >) */}
          <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 capitalize tracking-tight">
              {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : "'Uke' w, MMMM", { locale: nb })}
            </h2>

            {/* Piler på mobil for rask og sikker navigering */}
            <div className="flex sm:hidden items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200"
                aria-label="Forrige"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                className="px-2 py-1 text-[11px] font-semibold rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200"
              >
                I dag
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200"
                aria-label="Neste"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rad 2 på mobil: Visningsbryter og fargekoder */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            {/* Fargekoder */}
            <div className="flex items-center gap-2 sm:gap-3 text-[11px] font-medium text-slate-500">
              {isClient && (
                <span className="flex items-center gap-1" title="Dine avtalte timer">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600 ring-2 ring-sky-300 flex-shrink-0"></span>
                  <span className="font-bold text-sky-800">Din time</span>
                </span>
              )}
              <span className="flex items-center gap-1" title="Alle timer ledige">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                <span>Ledig</span>
              </span>
              <span className="flex items-center gap-1" title="Noen timer bestilt">
                <span className="px-1 py-0.2 rounded text-[9px] font-bold font-mono bg-sky-100 text-sky-800 border border-sky-200 flex-shrink-0">7/8</span>
                <span className="hidden xs:inline">Dels</span>
              </span>
              <span className="flex items-center gap-1" title="Fullt">
                <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0"></span>
                <span>Fullt</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Visningsbryter */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    viewMode === 'month' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Måned
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    viewMode === 'week' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Uke
                </button>
              </div>

              {/* Piler på desktop */}
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={handlePrev}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                  aria-label="Forrige"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                  className="px-2 py-1 text-[11px] font-semibold rounded-lg text-slate-700 hover:bg-slate-100"
                >
                  I dag
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                  aria-label="Neste"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Terapeutvalg over kalenderen */}
      <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-2.5 sm:p-3.5 shadow-xs w-full">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="text-sm sm:text-base font-bold text-slate-900">
                {formatTherapistName(selectedTherapist?.displayName) || 'Velg terapeut'}
              </span>
              {isTherapistOnLeave(selectedTherapist) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 w-fit">
                  <UserX className="w-3 h-3 text-amber-700" />
                  I permisjon {selectedTherapist?.leaveStartDate && selectedTherapist?.leaveEndDate ? `(${selectedTherapist.leaveStartDate} – ${selectedTherapist.leaveEndDate})` : ''}
                </span>
              )}
            </div>
          </div>

          <div className="w-auto">
            <select
              id="therapist-selector"
              aria-label="Terapeut"
              value={selectedTherapistId}
              onChange={(e) => handleTherapistChange(e.target.value)}
              className="px-3 py-1.5 sm:py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-800 bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs transition-all cursor-pointer"
            >
              {therapists.map((t) => (
                <option key={t.uid} value={t.uid}>
                  {formatTherapistName(t.displayName)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {bookingSuccessMessage && (
        <div className="mx-2 sm:mx-0 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{bookingSuccessMessage}</span>
          </div>
          <button onClick={() => setBookingSuccessMessage(null)}>
            <X className="w-3.5 h-3.5 text-emerald-700" />
          </button>
        </div>
      )}

      {/* KUNDENS AVTALTE TIMER - Tydelig fremhevet for kunden */}
      {isClient && (
        <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-3.5 sm:p-5 shadow-xs w-full">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                <CalendarIcon className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Dine avtalte timer ({clientUpcomingAppointments.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  {clientUpcomingAppointments.length > 0 
                    ? 'Oversikt over dine kommende bestillinger' 
                    : 'Ingen aktive bestillinger for øyeblikket'}
                </p>
              </div>
            </div>
            {clientUpcomingAppointments.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Aktiv avtale
              </span>
            )}
          </div>

          {clientUpcomingAppointments.length === 0 ? (
            <div className="text-center py-4 px-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">Du har ingen aktive timeavtaler for øyeblikket.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Velg en dato og ledig tid i kalenderen under for å bestille time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {clientUpcomingAppointments.map((apt) => {
                const therapistName = getTherapistDisplayName(apt.therapistId, apt.therapistName);
                const aptDate = new Date(`${apt.date}T${apt.startTime}`);
                return (
                  <div
                    key={apt.id}
                    className="p-3.5 rounded-xl border-2 border-sky-300 bg-sky-50/60 hover:bg-sky-50 transition-all flex flex-col justify-between gap-2.5 shadow-2xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 capitalize flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-sky-600 flex-shrink-0" />
                          {format(aptDate, 'EEEE d. MMMM yyyy', { locale: nb })}
                        </span>
                        <span className="font-mono font-bold text-xs text-sky-800 bg-white px-2 py-0.5 rounded-md border border-sky-200 shadow-2xs flex-shrink-0">
                          kl. {apt.startTime} - {apt.endTime}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-0.5">
                        {therapistName && (
                          <>
                            <span className="font-semibold text-slate-800 flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-sky-600" />
                              {therapistName}
                            </span>
                            <span>&bull;</span>
                          </>
                        )}
                        <span>
                          {apt.isOnline ? (
                            <span className="text-indigo-700 font-semibold inline-flex items-center gap-1">
                              <Video className="w-3.5 h-3.5" />
                              Online videomøte
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              Fysisk oppmøte
                            </span>
                          )}
                        </span>
                        <span>&bull;</span>
                        <span className="font-semibold text-slate-700">kr {apt.price},-</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-sky-200/60">
                      {apt.isOnline && apt.meetingLink ? (
                        <a
                          href={apt.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs"
                        >
                          <Video className="w-3 h-3" />
                          <span>Åpne møte</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium truncate">
                          {apt.notes ? `Notat: ${apt.notes}` : 'Oppmøte i klinikk'}
                        </span>
                      )}

                      <button
                        onClick={() => {
                          const dateObj = new Date(apt.date);
                          setCurrentDate(dateObj);
                          setSelectedDate(dateObj);
                          if (apt.therapistId && apt.therapistId !== selectedTherapistId) {
                            handleTherapistChange(apt.therapistId);
                          }
                          setIsDaySlotsModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold transition-colors cursor-pointer ml-auto"
                      >
                        Vis time i kalender &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Kalendervisning - Full bredde */}
      <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-2.5 sm:p-5 w-full shadow-xs">
        {/* Ukedagsnavn */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 mb-1.5 uppercase">
          <span>Man</span>
          <span>Tir</span>
          <span>Ons</span>
          <span>Tor</span>
          <span>Fre</span>
          <span>Lør</span>
          <span>Søn</span>
        </div>

        {/* Dagsruter */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {displayDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isDayToday = isToday(day);
            const isTherapistInactive = isTherapistOnLeave(selectedTherapist, dateStr);
            const dateHoliday = isDateInHoliday(dateStr, therapistHolidays);
            
            const availability = (workingHours && !isTherapistInactive) 
              ? getDayAvailability(dateStr, workingHours, therapistAppointments, therapistHolidays)
              : { total: 0, available: 0, booked: 0, status: 'closed' as const };

            const myAppointmentsToday = isClient
              ? clientAppointments.filter(a => a.date === dateStr)
              : [];
            const hasMyAppointment = myAppointmentsToday.length > 0;

            let statusColor = 'bg-slate-50 text-slate-400 border-transparent';
            if (hasMyAppointment) {
              statusColor = 'bg-sky-50/80 text-sky-950 border-sky-400 ring-2 ring-sky-500/60 shadow-xs hover:border-sky-500';
            } else if (dateHoliday) {
              statusColor = 'bg-amber-50/50 text-amber-900 border-amber-200/80 hover:border-amber-300';
            } else if (availability.status === 'fully_booked') {
              statusColor = 'bg-rose-50 text-rose-900 border-rose-300';
            } else if (availability.status === 'partially_booked') {
              statusColor = 'bg-sky-50/50 text-slate-800 border-sky-200 hover:border-sky-300';
            } else if (availability.status === 'all_available') {
              statusColor = 'bg-white text-slate-800 border-slate-200 hover:border-slate-300';
            }

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={`min-h-[56px] sm:min-h-[85px] p-1.5 sm:p-2.5 rounded-xl flex flex-col justify-between items-center sm:items-stretch text-left transition-all border cursor-pointer hover:shadow-xs active:scale-[0.98] ${
                  isSelected
                    ? 'ring-2 ring-sky-600 bg-white border-sky-400 shadow-xs'
                    : statusColor
                } ${!isCurrentMonth && viewMode === 'month' ? 'opacity-35' : 'opacity-100'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs sm:text-sm font-bold ${
                    isDayToday ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-sky-600 text-white flex items-center justify-center' : ''
                  }`}>
                    {format(day, 'd')}
                  </span>

                  {/* Fargekodeprikk, Ferie-ikon eller Kundens time-indikator */}
                  {hasMyAppointment ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 ring-2 ring-sky-300 shadow-xs flex-shrink-0" title={`Du har ${myAppointmentsToday.length} avtalt time denne dagen`}></span>
                  ) : dateHoliday ? (
                    <Palmtree className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-600" />
                  ) : isTherapistInactive ? (
                    <UserX className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />
                  ) : availability.status === 'all_available' ? (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shadow-xs" title="Alle timer ledige"></span>
                  ) : availability.status === 'partially_booked' ? (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-sky-500 shadow-xs" title={`${availability.available} av ${availability.total} ledige`}></span>
                  ) : availability.status === 'fully_booked' ? (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shadow-xs" title="Fullbooket (0 ledige)"></span>
                  ) : null}
                </div>

                {/* Tallvisning for tilgjengelighet, ferie eller kundens avtale */}
                <div className="mt-1 w-full flex justify-center sm:justify-start">
                  {hasMyAppointment ? (
                    <span className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-extrabold bg-sky-600 text-white shadow-2xs" title={`Din avtalte time: kl. ${myAppointmentsToday[0].startTime}`}>
                      <CheckCircle2 className="w-2.5 h-2.5 text-sky-200 flex-shrink-0" />
                      <span className="truncate max-w-[45px] sm:max-w-[65px]">
                        {myAppointmentsToday.length === 1 ? myAppointmentsToday[0].startTime : `${myAppointmentsToday.length} timer`}
                      </span>
                    </span>
                  ) : dateHoliday ? (
                    <span className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200" title={`Ferie/fravær: ${dateHoliday.title}`}>
                      <Palmtree className="w-2.5 h-2.5 text-amber-600 flex-shrink-0" />
                      <span className="truncate max-w-[45px] sm:max-w-[65px]">Ferie</span>
                    </span>
                  ) : isTherapistInactive ? (
                    <span className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200" title="Permisjon">
                      <UserX className="w-2.5 h-2.5 text-amber-600 flex-shrink-0" />
                      <span className="truncate max-w-[45px] sm:max-w-[65px]">Permisjon</span>
                    </span>
                  ) : availability.status === 'partially_booked' ? (
                    <span className="inline-flex items-center px-1 sm:px-1.5 py-0.2 rounded text-[9px] sm:text-[11px] font-bold font-mono bg-sky-100 text-sky-800 border border-sky-200">
                      {availability.available}/{availability.total}
                      <span className="hidden md:inline font-sans font-medium text-[10px] ml-1">ledig</span>
                    </span>
                  ) : availability.status === 'fully_booked' ? (
                    <span className="inline-flex items-center px-1 sm:px-1.5 py-0.2 rounded text-[9px] sm:text-[11px] font-bold font-mono bg-rose-200 text-rose-800 border border-rose-300">
                      0/{availability.total}
                      <span className="hidden md:inline font-sans font-medium text-[10px] ml-1">fullt</span>
                    </span>
                  ) : availability.status === 'closed' ? (
                    <span className="hidden sm:inline text-[10px] text-slate-400 font-medium">
                      Stengt
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* POPUP-VINDU (MODAL): LEDIGE TIMER FOR VALGT DATO */}
      {isDaySlotsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 p-4 sm:p-6 max-h-[88vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                    Ledige timer
                  </span>
                  {isTherapistOnLeave(selectedTherapist, selectedDateStr) ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <UserX className="w-3 h-3 text-amber-700" />
                      I permisjon
                    </span>
                  ) : isDateInHoliday(selectedDateStr, therapistHolidays) ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <Palmtree className="w-3 h-3 text-amber-600" />
                      Ferie / fravær
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {daySlots.filter(s => s.isAvailable).length} ledige
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 capitalize">
                  {format(selectedDate, 'EEEE d. MMMM yyyy', { locale: nb })}
                </h3>
                <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-sky-600" />
                  <span>{formatTherapistName(selectedTherapist?.displayName)}</span>
                </p>
              </div>

              <button
                onClick={() => setIsDaySlotsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Lukk"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Liste over tider */}
            <div className="mt-3.5 flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-[160px]">
              {isClient && appointments.filter(a => a.clientId === currentUser?.uid && a.date === selectedDateStr && a.status === 'confirmed' && a.therapistId !== selectedTherapistId).length > 0 && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-300 text-xs text-sky-950 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-sky-600" />
                    <span>Du har avtalt time denne dagen hos en annen behandler:</span>
                  </div>
                  {appointments.filter(a => a.clientId === currentUser?.uid && a.date === selectedDateStr && a.status === 'confirmed' && a.therapistId !== selectedTherapistId).map(otherApt => (
                    <div key={otherApt.id} className="flex items-center justify-between pl-5">
                      <span>
                        kl. {otherApt.startTime} - {otherApt.endTime} ({getTherapistDisplayName(otherApt.therapistId, otherApt.therapistName)})
                      </span>
                      <button
                        onClick={() => {
                          if (otherApt.therapistId) handleTherapistChange(otherApt.therapistId);
                        }}
                        className="text-sky-700 hover:underline font-bold text-[11px] cursor-pointer"
                      >
                        Bytt til denne behandleren &rarr;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isTherapistOnLeave(selectedTherapist, selectedDateStr) ? (
                <div className="text-center py-8 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
                    <UserX className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">Behandler er i permisjon</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {formatTherapistName(selectedTherapist?.displayName)} er i permisjon {selectedTherapist?.leaveStartDate && selectedTherapist?.leaveEndDate ? `i perioden ${format(new Date(selectedTherapist.leaveStartDate), 'd. MMM', { locale: nb })} – ${format(new Date(selectedTherapist.leaveEndDate), 'd. MMM yyyy', { locale: nb })}` : 'for øyeblikket'}. Det kan ikke bestilles timer denne dagen.
                  </p>
                </div>
              ) : isDateInHoliday(selectedDateStr, therapistHolidays) ? (
                (() => {
                  const holiday = isDateInHoliday(selectedDateStr, therapistHolidays)!;
                  return (
                    <div className="text-center py-8 px-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
                        <Palmtree className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm sm:text-base">Ferie / fravær: {holiday.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        {formatTherapistName(selectedTherapist?.displayName)} har registrert fravær i perioden{' '}
                        <strong className="text-slate-700">
                          {format(new Date(holiday.startDate), 'd. MMM', { locale: nb })} – {format(new Date(holiday.endDate), 'd. MMM yyyy', { locale: nb })}
                        </strong>.
                      </p>
                      <p className="text-xs text-slate-400 mt-2">Det er ikke mulig å bestille time denne dagen.</p>
                    </div>
                  );
                })()
              ) : daySlots.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="font-semibold text-sm text-slate-600">Ingen tilgjengelige timer denne dagen.</p>
                  <p className="text-xs text-slate-400 mt-1">Prøv en annen dag eller bytt behandler.</p>
                </div>
              ) : (
                daySlots.map((slot) => {
                  const isAvailable = slot.isAvailable;
                  const apt = slot.appointment;
                  const isMyAppointment = isClient && apt && apt.clientId === currentUser?.uid;

                  if (isMyAppointment) {
                    return (
                      <div
                        key={slot.id}
                        className="p-3.5 rounded-xl sm:rounded-2xl border-2 border-sky-400 bg-sky-50 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-3.5 h-3.5 rounded-full bg-sky-600 ring-2 ring-sky-300 flex-shrink-0 mt-1" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-sm sm:text-base font-mono">
                                {slot.startTime} - {slot.endTime}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-600 text-white shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-sky-200" />
                                Din avtalte time
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-slate-800">
                                {getTherapistDisplayName(apt?.therapistId, apt?.therapistName)}
                              </span>
                              <span>&bull;</span>
                              <span>{apt?.isOnline ? 'Online videomøte' : 'Fysisk oppmøte'}</span>
                              <span>&bull;</span>
                              <span className="font-semibold text-slate-700">kr {apt?.price},-</span>
                            </p>
                            {apt?.notes && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5">
                                Notat: {apt.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {apt?.isOnline && apt?.meetingLink && (
                          <a
                            href={apt.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1 flex-shrink-0"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Åpne møte</span>
                            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                          </a>
                        )}
                      </div>
                    );
                  }

                  let clientDisplay = apt ? apt.clientName : '';
                  if (apt && currentUser?.role === 'admin' && !currentUser.permissions?.canViewClientName) {
                    clientDisplay = `Klient #${apt.clientNumber}`;
                  }

                  return (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-xl sm:rounded-2xl border flex items-center justify-between transition-all ${
                        isAvailable
                          ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/70'
                          : 'bg-rose-50/30 border-rose-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          isAvailable ? 'bg-emerald-500 shadow-xs' : 'bg-rose-500'
                        }`} />
                        <div>
                          <span className="font-bold text-slate-900 text-sm sm:text-base font-mono">
                            {slot.startTime} - {slot.endTime}
                          </span>
                          <p className="text-xs">
                            {isAvailable ? (
                              <span className="text-emerald-700 font-semibold">Ledig for bestilling</span>
                            ) : (
                              <span className="text-rose-700 font-medium">
                                Opptatt {apt && (currentUser?.role === 'hovedadmin' || currentUser?.role === 'admin') ? `(${clientDisplay})` : ''}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {isAvailable && (
                        <button
                          onClick={() => handleOpenBooking(slot)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                        >
                          Bestill
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Standard varighet: 45 minutter</span>
              <button
                onClick={() => setIsDaySlotsModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BESTILLINGS-MODAL */}
      {isBookingModalOpen && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            
            <button
              onClick={() => setIsBookingModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">Bekreft timebestilling</h3>
              <p className="text-xs text-slate-500">
                {format(new Date(selectedSlot.date), 'EEEE d. MMMM', { locale: nb })} kl. <strong className="text-slate-800">{selectedSlot.startTime}</strong>
              </p>
              <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-sky-600" />
                <span>{formatTherapistName(selectedTherapist?.displayName)}</span>
              </p>
            </div>

            <div className="space-y-3.5">
              
              {/* Velg klient hvis admin */}
              {currentUser?.role !== 'client' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Klient
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none"
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

              {/* Time-type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Varighet & type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {slotTypeOptions.map((st) => {
                    const isSel = bookingSlotType.type === st.type;
                    return (
                      <button
                        key={st.type}
                        type="button"
                        onClick={() => setBookingSlotType(st)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSel ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-500' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-800">{st.title}</p>
                        <p className="text-[10px] text-slate-500">{st.durationMinutes} min</p>
                        <p className="text-xs font-semibold text-sky-700 mt-0.5">kr {st.price},-</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lunsjkollisjonsvarsel og forslag til sammenhengende time */}
              {lunchCollision.collides && lunchCollision.lunchBreak && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-900">
                        Timen blir avbrutt av lunsj ({lunchCollision.lunchDurationMinutes} min)
                      </p>
                      <p className="text-amber-800 mt-0.5 leading-relaxed">
                        En {bookingSlotType.title.toLowerCase()} kl. {selectedSlot.startTime} kolliderer med {lunchCollision.lunchBreak.title ? lunchCollision.lunchBreak.title.toLowerCase() : 'lunsjpausen'} ({lunchCollision.lunchBreak.start} – {lunchCollision.lunchBreak.end}). 
                        Ønsker du å flytte timen slik at den blir sammenhengende?
                      </p>
                    </div>
                  </div>

                  {/* Forslag til sammenhengende tider */}
                  <div className="pt-2 border-t border-amber-200/80 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                      Forslag til sammenhengende time:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {alternativeSlots.before && (
                        <button
                          type="button"
                          onClick={() => setSelectedSlot(alternativeSlots.before!)}
                          className="w-full py-2 px-2.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 hover:border-amber-400 text-amber-950 font-semibold text-xs text-left transition-all flex items-center justify-between shadow-2xs group cursor-pointer"
                        >
                          <span className="text-[11px] text-amber-800">Før lunsj:</span>
                          <span className="font-bold text-amber-950 group-hover:text-amber-900">
                            kl. {alternativeSlots.before.startTime} – {alternativeSlots.before.endTime}
                          </span>
                        </button>
                      )}
                      {alternativeSlots.after && (
                        <button
                          type="button"
                          onClick={() => setSelectedSlot(alternativeSlots.after!)}
                          className="w-full py-2 px-2.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 hover:border-amber-400 text-amber-950 font-semibold text-xs text-left transition-all flex items-center justify-between shadow-2xs group cursor-pointer"
                        >
                          <span className="text-[11px] text-amber-800">Etter lunsj:</span>
                          <span className="font-bold text-amber-950 group-hover:text-amber-900">
                            kl. {alternativeSlots.after.startTime} – {alternativeSlots.after.endTime}
                          </span>
                        </button>
                      )}
                      {!alternativeSlots.before && !alternativeSlots.after && (
                        <p className="text-xs text-amber-700 italic col-span-2">
                          Ingen sammenhengende timer er ledige før eller etter lunsj denne dagen.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Møteform */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Møteform
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOnlineMeeting(false)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                      !isOnlineMeeting ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold">Fysisk møte</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOnlineMeeting(true)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                      isOnlineMeeting ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Video className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold">Online møte</span>
                  </button>
                </div>
              </div>

              {/* Notat */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Beskjed (valgfritt)
                </label>
                <textarea
                  rows={2}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="Kort beskjed til timen..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                />
              </div>

              {/* Knapper */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="w-1/2 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  disabled={isSubmittingBooking}
                  onClick={handleConfirmBooking}
                  className="w-1/2 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 disabled:opacity-50"
                >
                  {isSubmittingBooking 
                    ? 'Bekrefter...' 
                    : lunchCollision.collides 
                      ? 'Bekreft time (avbrutt av lunsj)' 
                      : 'Bekreft time'}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
