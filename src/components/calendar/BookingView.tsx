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
  X,
  AlertCircle, 
  User, 
  Palmtree, 
  UserX, 
  CheckCircle2, 
  ArrowRight,
  Plus
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

interface BookingViewProps {
  onNavigateToCalendar: () => void;
  onNavigateToDashboard: () => void;
  initialDate?: string;
}

export const BookingView: React.FC<BookingViewProps> = ({ 
  onNavigateToCalendar, 
  onNavigateToDashboard,
  initialDate 
}) => {
  const { currentUser } = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(
    initialDate ? new Date(initialDate) : new Date()
  );
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialDate ? new Date(initialDate) : new Date()
  );

  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  
  // Terapeutvalg
  const [therapists, setTherapists] = useState<UserProfile[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');

  // Booking modal og tilstand
  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingSlotType, setBookingSlotType] = useState<SlotTypeOption>(DEFAULT_SLOT_TYPES[0]);
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Lunsj-forslag håndtering
  const [lunchSuggestionStatus, setLunchSuggestionStatus] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [originalSlotBeforeSuggestion, setOriginalSlotBeforeSuggestion] = useState<GeneratedSlot | null>(null);
  const [acceptedSlotTime, setAcceptedSlotTime] = useState<{ start: string; end: string; label: string } | null>(null);

  // Bekreftet booking-kvittering
  const [confirmedBooking, setConfirmedBooking] = useState<{
    appointment: Appointment;
    smsStatus: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const loadData = async () => {
    const apts = await dbService.getAppointments();
    const users = await dbService.getUsers();
    const hList = await dbService.getHolidays();
    
    setAppointments(apts);
    const clientList = users.filter(u => u.role === 'client');
    setClients(clientList);
    setHolidays(hList);

    const availableTherapists = users.filter(u => 
      (u.role === 'admin' || u.role === 'hovedadmin') &&
      (currentUser?.role !== 'client' || u.isActive !== false || !!u.leaveEndDate)
    );
    setTherapists(availableTherapists);

    let preselectedId = '';
    if (currentUser?.role === 'admin' || currentUser?.role === 'hovedadmin') {
      if (availableTherapists.some(t => t.uid === currentUser.uid)) {
        preselectedId = currentUser.uid;
      }
    } else if (currentUser?.role === 'client') {
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

    if (preselectedId) {
      const wh = await dbService.getWorkingHours(preselectedId);
      setWorkingHours(wh);
    } else {
      const wh = await dbService.getWorkingHours();
      setWorkingHours(wh);
    }

    if (currentUser?.role === 'client') {
      setSelectedClientId(currentUser.uid);
    } else if (clientList.length > 0) {
      setSelectedClientId(clientList[0].uid);
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

  const therapistHolidays = holidays.filter(h => 
    !h.therapistId || h.therapistId === 'all' || h.therapistId === selectedTherapistId
  );

  const therapistAppointments = appointments.filter(a => {
    if (a.therapistId) {
      return a.therapistId === selectedTherapistId;
    }
    return therapists[0]?.uid === selectedTherapistId;
  });

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

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedDateOnLeave = isTherapistOnLeave(selectedTherapist, selectedDateStr);
  const daySlots: GeneratedSlot[] = (workingHours && !isSelectedDateOnLeave)
    ? generateDaySlots(selectedDateStr, workingHours, therapistAppointments, therapistHolidays)
    : [];

  const lunchCollision = (selectedSlot && workingHours)
    ? checkLunchCollision(selectedSlot.startTime, bookingSlotType.durationMinutes, workingHours)
    : { collides: false, lunchDurationMinutes: 0 };

  const alternativeSlots = (lunchCollision.collides && selectedSlot && workingHours)
    ? findContinuousAlternativeSlots(
        daySlots,
        bookingSlotType.durationMinutes,
        workingHours,
        therapistAppointments,
        selectedSlot.date
      )
    : {};

  const handleOpenBooking = (slot: GeneratedSlot) => {
    if (!slot.isAvailable) return;
    setSelectedSlot(slot);
    setOriginalSlotBeforeSuggestion(slot);
    setLunchSuggestionStatus('pending');
    setAcceptedSlotTime(null);
    if (currentUser?.role !== 'client' && !selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].uid);
    }
    setIsBookingModalOpen(true);
  };

  const handleAcceptSuggestion = (altSlot: GeneratedSlot, label: string) => {
    if (!originalSlotBeforeSuggestion && selectedSlot) {
      setOriginalSlotBeforeSuggestion(selectedSlot);
    }
    const endMin = parseMinutes(altSlot.startTime) + bookingSlotType.durationMinutes;
    const endTimeStr = formatMinutes(endMin);

    setSelectedSlot(altSlot);
    setLunchSuggestionStatus('accepted');
    setAcceptedSlotTime({
      start: altSlot.startTime,
      end: endTimeStr,
      label: label.toLowerCase()
    });
  };

  const handleRevertSuggestion = () => {
    if (originalSlotBeforeSuggestion) {
      setSelectedSlot(originalSlotBeforeSuggestion);
    }
    setLunchSuggestionStatus('pending');
    setAcceptedSlotTime(null);
  };

  const handleSlotTypeChange = (st: SlotTypeOption) => {
    if (lunchSuggestionStatus === 'accepted' && originalSlotBeforeSuggestion) {
      setSelectedSlot(originalSlotBeforeSuggestion);
    }
    setBookingSlotType(st);
    setLunchSuggestionStatus('pending');
    setAcceptedSlotTime(null);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !workingHours || !currentUser) return;
    setIsSubmittingBooking(true);

    try {
      let clientObj: UserProfile | undefined;
      if (currentUser.role === 'client') {
        clientObj = currentUser;
      } else {
        clientObj = clients.find(c => c.uid === selectedClientId) || clients[0];
      }

      if (!clientObj) {
        alert('Vennligst velg en klient for timen.');
        setIsSubmittingBooking(false);
        return;
      }

      const startMin = parseMinutes(selectedSlot.startTime);
      const isStillColliding = lunchSuggestionStatus !== 'accepted' && lunchCollision.collides;
      const totalSpanMinutes = isStillColliding
        ? bookingSlotType.durationMinutes + lunchCollision.lunchDurationMinutes
        : bookingSlotType.durationMinutes;
      const endMin = startMin + totalSpanMinutes;
      const calculatedEndTime = formatMinutes(endMin);

      const appointmentId = 'apt_' + Date.now();
      const meetingLink = isOnlineMeeting ? smsService.generateMeetingLink(appointmentId) : undefined;

      const finalNotes = isStillColliding && lunchCollision.lunchBreak
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

      // Send SMS med sikker timeout (maks 3,5 sek)
      let smsStatus = 'simulert';
      try {
        const smsLog = await Promise.race([
          smsService.sendBookingConfirmation(newAppointment),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('SMS timeout')), 3500))
        ]);
        if (smsLog?.status === 'sent') smsStatus = 'sendt';
      } catch (smsErr) {
        console.warn('SMS-sending tok lang tid eller feilet, fortsetter booking:', smsErr);
      }

      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'create_appointment',
        `Bestilte ${bookingSlotType.title} hos ${selectedTherapist?.displayName || 'terapeut'} for ${clientObj.displayName} den ${newAppointment.date} kl. ${newAppointment.startTime}`
      );

      await loadData();
      setIsBookingModalOpen(false);
      setConfirmedBooking({ appointment: newAppointment, smsStatus });
      setSelectedSlot(null);
      setBookingNotes('');
      setLunchSuggestionStatus('pending');
      setAcceptedSlotTime(null);
      setOriginalSlotBeforeSuggestion(null);
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
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Velg behandler, type time og ønsket dato og tidspunkt.
            </p>
          </div>

          {currentUser?.role !== 'client' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Aktiv behandler:</span>
              <select
                aria-label="Behandler"
                value={selectedTherapistId}
                onChange={(e) => handleTherapistChange(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none"
              >
                {therapists.map(t => (
                  <option key={t.uid} value={t.uid}>
                    {formatTherapistName(t.displayName)}
                  </option>
                ))}
              </select>
            </div>
          )}
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
                {confirmedBooking.appointment.durationMinutes} minutter
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

      {/* STEG 1 & 2: BEHANDLER OG TIME-TYPE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 w-full">
        
        {/* Behandlerkort */}
        {therapists.length > 1 && (
          <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-4 shadow-xs space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Velg behandler
            </label>
            <div className="space-y-1.5">
              {therapists.map((t) => {
                const isSel = t.uid === selectedTherapistId;
                const onLeave = isTherapistOnLeave(t);
                return (
                  <button
                    key={t.uid}
                    type="button"
                    onClick={() => handleTherapistChange(t.uid)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
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

        {/* Time-type og varighet */}
        <div className={`bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-4 shadow-xs space-y-2.5 ${therapists.length > 1 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            {therapists.length > 1 ? '2. Velg time-type & varighet' : '1. Velg time-type & varighet'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {slotTypeOptions.map((st) => {
              const isSel = bookingSlotType.type === st.type;
              return (
                <button
                  key={st.type}
                  type="button"
                  onClick={() => handleSlotTypeChange(st)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSel 
                      ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-500 shadow-xs' 
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-sm">{st.title}</span>
                    <span className="text-xs font-bold text-sky-700">kr {st.price},-</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{st.durationMinutes} minutter</span>
                  </p>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* STEG 3 & 4: DATOVELGER & LEDIGE TIMER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 w-full">
        
        {/* DATOVELGER (7 kolonner på store skjermer) */}
        <div className="lg:col-span-7 bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-3 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Velg dato
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

          {/* Kalendergrid for valg av dato */}
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
                const isInactive = isTherapistOnLeave(selectedTherapist, dateStr);
                const dateHoliday = isDateInHoliday(dateStr, therapistHolidays);

                const availability = (workingHours && !isInactive)
                  ? getDayAvailability(dateStr, workingHours, therapistAppointments, therapistHolidays)
                  : { total: 0, available: 0, booked: 0, status: 'closed' as const };

                const isPastDate = isPast(day) && !isDayToday;

                return (
                  <button
                    key={day.toISOString()}
                    disabled={availability.status === 'closed' || isPastDate}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[50px] sm:min-h-[64px] p-1.5 rounded-xl flex flex-col justify-between items-center transition-all border cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-sky-600 bg-sky-600 text-white border-sky-600 shadow-xs'
                        : isPastDate || availability.status === 'closed'
                          ? 'bg-slate-50/50 text-slate-300 border-slate-100 opacity-60 cursor-not-allowed'
                          : availability.status === 'fully_booked'
                            ? 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-300'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-sky-300 hover:bg-sky-50/40'
                    } ${!isCurrentMonth ? 'opacity-30' : 'opacity-100'}`}
                  >
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : ''}`}>
                      {format(day, 'd')}
                    </span>

                    {/* Tilgjengelighetsindikator */}
                    {isSelected ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    ) : dateHoliday || isInactive ? (
                      <span className="text-[9px] text-amber-600 font-semibold">Stengt</span>
                    ) : availability.status === 'all_available' ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs" title="Ledig" />
                    ) : availability.status === 'partially_booked' ? (
                      <span className="text-[9px] font-mono font-bold text-sky-700 bg-sky-100 px-1 rounded">
                        {availability.available} ledig
                      </span>
                    ) : availability.status === 'fully_booked' ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shadow-2xs" title="Fullbooket" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* LEDIGE TIMER PÅ VALGT DATO (5 kolonner på store skjermer) */}
        <div className="lg:col-span-5 bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-3 sm:p-5 shadow-xs space-y-3">
          <div className="pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">
              Ledige tidspunkter
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 capitalize mt-0.5">
              {format(selectedDate, 'EEEE d. MMMM yyyy', { locale: nb })}
            </h3>
            <p className="text-xs text-slate-500">
              Varighet: {bookingSlotType.title} ({bookingSlotType.durationMinutes} min)
            </p>
          </div>

          {daySlots.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Ingen oppsatte timer denne dagen</p>
              <p className="text-[11px] text-slate-400">
                {isSelectedDateOnLeave 
                  ? 'Behandleren er registrert i permisjon/ferie.'
                  : 'Klinikken er stengt eller har ingen åpningstider på denne datoen.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {daySlots.map((slot) => {
                const isAvailable = slot.isAvailable;

                return (
                  <div
                    key={slot.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isAvailable
                        ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/80 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        isAvailable ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-rose-400'
                      }`} />
                      <div>
                        <span className="font-mono font-bold text-sm text-slate-900 block">
                          kl. {slot.startTime} – {slot.endTime}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {isAvailable ? 'Ledig for bestilling' : 'Opptatt'}
                        </span>
                      </div>
                    </div>

                    {isAvailable ? (
                      <button
                        type="button"
                        onClick={() => handleOpenBooking(slot)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>Bestill</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-rose-700 px-2 py-1 bg-rose-50 rounded-lg">
                        Opptatt
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* BESTILLINGS-MODAL MED LUNSJ-HÅNDTERING */}
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
              <p className="text-xs text-slate-500 flex items-center flex-wrap gap-1.5 mt-0.5">
                <span>{format(new Date(selectedSlot.date), 'EEEE d. MMMM yyyy', { locale: nb })} kl. <strong className="text-slate-800">{selectedSlot.startTime}</strong></span>
                {lunchSuggestionStatus === 'accepted' && acceptedSlotTime && (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                    ✓ Ny tid: kl. {acceptedSlotTime.start} – {acceptedSlotTime.end}
                  </span>
                )}
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
                        onClick={() => handleSlotTypeChange(st)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSel ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-500' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-800 truncate">{st.title}</p>
                        <p className="text-[10px] text-slate-500">{st.durationMinutes} min</p>
                        <p className="text-xs font-semibold text-sky-700 mt-0.5 whitespace-nowrap">kr {st.price},-</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1. Hvis brukeren har godtatt et forslag om flytting */}
              {lunchSuggestionStatus === 'accepted' && acceptedSlotTime && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs shadow-xs space-y-1.5">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-emerald-900 text-sm">
                        Forslag godtatt!
                      </p>
                      <p className="text-emerald-800 mt-0.5 leading-relaxed">
                        Timen er flyttet til <strong className="text-emerald-950 font-extrabold">kl. {acceptedSlotTime.start} – {acceptedSlotTime.end}</strong> ({acceptedSlotTime.label}). Den gjennomføres sammenhengende uten pause.
                      </p>
                      <div className="pt-1.5 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={handleRevertSuggestion}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          Angre og gå tilbake til kl. {originalSlotBeforeSuggestion?.startTime || 'opprinnelig tid'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Hvis brukeren har avslått forslaget og valgt å beholde opprinnelig tid */}
              {lunchCollision.collides && lunchCollision.lunchBreak && lunchSuggestionStatus === 'declined' && (
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs shadow-xs space-y-1.5">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900">
                        Forslag avslått – beholder kl. {selectedSlot.startTime}
                      </p>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">
                        Timen gjennomføres som oppsatt med pause under {lunchCollision.lunchBreak.title || 'lunsj'} (kl. {lunchCollision.lunchBreak.start} – {lunchCollision.lunchBreak.end}). Total tidsramme blir {bookingSlotType.durationMinutes + lunchCollision.lunchDurationMinutes} minutter.
                      </p>
                      <button
                        type="button"
                        onClick={() => setLunchSuggestionStatus('pending')}
                        className="mt-1 text-xs font-semibold text-sky-700 hover:text-sky-900 underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        Vis forslag om sammenhengende time på nytt
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Uavklart forslag: Viser valg om å enten godta sammenhengende time eller avslå */}
              {lunchCollision.collides && lunchCollision.lunchBreak && lunchSuggestionStatus === 'pending' && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-amber-900 text-sm">
                        Timen blir avbrutt av {lunchCollision.lunchBreak.title || 'lunsjpause'} ({lunchCollision.lunchBreak.start} – {lunchCollision.lunchBreak.end})
                      </p>
                      <p className="text-amber-800 mt-1 leading-relaxed">
                        En {bookingSlotType.title.toLowerCase()} ({bookingSlotType.durationMinutes} min) kl. {selectedSlot.startTime} vil bli avbrutt av lunsjen. 
                        Velg om du vil <strong>godta en sammenhengende time</strong> eller <strong>avslå og beholde opprinnelig tid</strong>:
                      </p>
                    </div>
                  </div>

                  {/* Valgknapper: Godta eller avslå */}
                  <div className="pt-2 border-t border-amber-200 space-y-2">
                    {alternativeSlots.after && (
                      <button
                        type="button"
                        onClick={() => handleAcceptSuggestion(alternativeSlots.after!, 'Etter lunsj')}
                        className="w-full p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs text-left transition-all flex items-center justify-between shadow-xs cursor-pointer gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Check className="w-4 h-4 text-emerald-200 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold block text-white text-xs">Godta forslag: Etter lunsj</span>
                            <span className="text-[11px] text-emerald-100 block truncate">
                              kl. {alternativeSlots.after.startTime} – {alternativeSlots.after.endTime} (sammenhengende)
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg text-white flex-shrink-0 whitespace-nowrap">
                          Godta & flytt &rarr;
                        </span>
                      </button>
                    )}

                    {alternativeSlots.before && (
                      <button
                        type="button"
                        onClick={() => handleAcceptSuggestion(alternativeSlots.before!, 'Før lunsj')}
                        className="w-full p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs text-left transition-all flex items-center justify-between shadow-xs cursor-pointer gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Check className="w-4 h-4 text-sky-200 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold block text-white text-xs">Godta forslag: Før lunsj</span>
                            <span className="text-[11px] text-sky-100 block truncate">
                              kl. {alternativeSlots.before.startTime} – {alternativeSlots.before.endTime} (sammenhengende)
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg text-white flex-shrink-0 whitespace-nowrap">
                          Godta & flytt &rarr;
                        </span>
                      </button>
                    )}

                    {/* Avslå forslag og behold opprinnelig tid */}
                    <button
                      type="button"
                      onClick={() => setLunchSuggestionStatus('declined')}
                      className="w-full p-2.5 rounded-xl bg-white hover:bg-amber-100/70 border border-amber-300 text-amber-950 font-semibold text-xs transition-all flex items-center justify-between cursor-pointer gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <X className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <div className="min-w-0 text-left">
                          <span className="font-bold block text-amber-950">Avslå forslag – behold kl. {selectedSlot.startTime}</span>
                          <span className="text-[11px] text-amber-800 block truncate">
                            Timen avbrytes av lunsj ({lunchCollision.lunchDurationMinutes} min pause)
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-amber-800 bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg flex-shrink-0 whitespace-nowrap">
                        Avslå
                      </span>
                    </button>

                    {!alternativeSlots.before && !alternativeSlots.after && (
                      <p className="text-xs text-amber-700 italic">
                        Ingen andre sammenhengende timer er ledige før eller etter lunsj denne dagen.
                      </p>
                    )}
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
                    className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                      !isOnlineMeeting ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold">Fysisk møte</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOnlineMeeting(true)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
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
                  placeholder="Kort beskjed til behandleren..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                />
              </div>

              {/* Knapper */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingBooking}
                  onClick={() => setIsBookingModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  disabled={isSubmittingBooking}
                  onClick={handleConfirmBooking}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    lunchSuggestionStatus === 'accepted'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                      : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
                  }`}
                >
                  {isSubmittingBooking ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Lagrer bestilling...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 flex-shrink-0" />
                      <span>
                        {lunchSuggestionStatus === 'accepted' && acceptedSlotTime
                          ? `Bekreft time (kl. ${acceptedSlotTime.start} – ${acceptedSlotTime.end})`
                          : lunchCollision.collides && lunchSuggestionStatus === 'declined'
                            ? `Bekreft time (kl. ${selectedSlot.startTime}, m/lunsjpause)`
                            : `Bekreft time (kl. ${selectedSlot.startTime})`}
                      </span>
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
