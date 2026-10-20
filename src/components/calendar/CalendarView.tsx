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
  ChevronDown,
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
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { smsService } from '../../services/sms';
import { maskPersonalInfo } from '../../utils/crypto';
import { AppointmentSmsModal } from '../appointments/AppointmentSmsModal';
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
  isDateInHoliday,
  isTherapistOnLeave,
  isValidTimeString,
  calculateDurationMinutes,
  calculateEndTime
} from '../../utils/calendar';
import { TimeRangeSelector } from './TimeRangeSelector';

export const CalendarView: React.FC = () => {
  const { currentUser } = useAuth();
  const canViewName = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canViewClientName !== false;
  const canViewPhone = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canViewClientPhone !== false;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  
  const cachedUsers = dbService.getCachedUsers();
  const availableCachedTherapists = cachedUsers.filter(u => 
    (u.role === 'admin' || u.role === 'hovedadmin') &&
    (currentUser?.role !== 'client' || u.isActive !== false || !!u.leaveEndDate)
  );

  const initialTherapistId = (currentUser?.role === 'admin' || currentUser?.role === 'hovedadmin')
    ? (availableCachedTherapists.some(t => t.uid === currentUser.uid) ? currentUser.uid : (availableCachedTherapists[0]?.uid || ''))
    : (availableCachedTherapists[0]?.uid || '');

  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig>(() => 
    dbService.getCachedWorkingHours(initialTherapistId)
  );
  const [appointments, setAppointments] = useState<Appointment[]>(() => dbService.getCachedAppointments());
  const [holidays, setHolidays] = useState<Holiday[]>(() => dbService.getCachedHolidays());
  const [clients, setClients] = useState<UserProfile[]>(() => cachedUsers.filter(u => u.role === 'client'));
  const [therapists, setTherapists] = useState<UserProfile[]>(availableCachedTherapists);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(initialTherapistId);
  const [isDaySlotsModalOpen, setIsDaySlotsModalOpen] = useState(false);

  // Booking form state
  const clinicSlotMinutes = workingHours?.slotDurationMinutes || 45;
  const [bookingStartTime, setBookingStartTime] = useState('10:00');
  const [bookingEndTime, setBookingEndTime] = useState('10:45');
  const [bookingSuggestedType, setBookingSuggestedType] = useState<'single' | 'double' | 'triple' | null>('single');
  const [bookingPrice, setBookingPrice] = useState<number>(() => dbService.getCachedWorkingHours(initialTherapistId)?.prices?.single ?? 950);
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [sendConfirmationSms, setSendConfirmationSms] = useState(true);
  const [bookingClientPhone, setBookingClientPhone] = useState<string>('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccessMessage, setBookingSuccessMessage] = useState<string | null>(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [cancellingAptId, setCancellingAptId] = useState<string | null>(null);
  const [delayModalApt, setDelayModalApt] = useState<Appointment | null>(null);
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);

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

  const loadData = async () => {
    const targetTherapistId = selectedTherapistId || initialTherapistId;
    const [apts, users, hList, wh] = await Promise.all([
      dbService.getAppointments(),
      dbService.getUsers(),
      dbService.getHolidays(),
      dbService.getWorkingHours(targetTherapistId)
    ]);
    
    setAppointments(apts);
    setClients(users.filter(u => u.role === 'client'));
    setHolidays(hList);
    setWorkingHours(wh);

    // Hent alle tilgjengelige behandlere/terapeuter
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

    if (!selectedTherapistId) {
      setSelectedTherapistId(preselectedId);
    }

    if (currentUser?.role === 'client') {
      setSelectedClientId(currentUser.uid);
      setBookingClientPhone(currentUser.phone || '');
    } else if (users.length > 0 && !selectedClientId) {
      const firstClient = users.find(u => u.role === 'client');
      if (firstClient) {
        setSelectedClientId(firstClient.uid);
        setBookingClientPhone(firstClient.phone || '');
      }
    }
  };

  const handleTherapistChange = async (therapistId: string) => {
    setSelectedTherapistId(therapistId);
    if (currentUser?.role === 'client') {
      localStorage.setItem(`dintid_client_therapist_${currentUser.uid}`, therapistId);
    }
    const cachedWh = dbService.getCachedWorkingHours(therapistId);
    setWorkingHours(cachedWh);

    const freshWh = await dbService.getWorkingHours(therapistId);
    setWorkingHours(freshWh);
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

  const currentClientId = currentUser?.role === 'client' ? currentUser.uid : selectedClientId;
  const currentClientObj = currentUser?.role === 'client' 
    ? currentUser 
    : (clients.find(c => c.uid === currentClientId) || clients[0]);
  const currentClientName = currentClientObj?.displayName;

  const isAppointmentForCurrentClient = (a: Appointment): boolean => {
    if (currentClientId && a.clientId && a.clientId === currentClientId) return true;
    if (currentClientName && a.clientName && a.clientName.trim().toLowerCase() === currentClientName.trim().toLowerCase()) return true;
    return false;
  };

  const bookingStartMin = parseMinutes(bookingStartTime);
  const bookingEndMin = parseMinutes(bookingEndTime);

  // Kollisjonssjekk for behandler (overlappende tidsrom med eksisterende bekreftet avtale for en ANNEN person)
  const therapistCollision = appointments.find(a => {
    if (a.date !== selectedDateStr || a.status === 'cancelled') return false;
    if (editingAppointmentId && a.id === editingAppointmentId) return false;
    // Dersom avtalen er for samme person som det bestilles time for, skal det IKKE varsles om kollisjon
    if (isAppointmentForCurrentClient(a)) return false;
    const aTherapistId = a.therapistId || therapists[0]?.uid;
    if (aTherapistId !== selectedTherapistId) return false;
    const aStart = parseMinutes(a.startTime);
    const aEnd = parseMinutes(a.endTime);
    return bookingStartMin < aEnd && bookingEndMin > aStart;
  });

  // Kollisjonssjekk for klient (klienten kan ikke bookes inn på to timer samtidig hos EN ANNEN behandler)
  const clientCollision = appointments.find(a => {
    if (a.date !== selectedDateStr || a.status === 'cancelled') return false;
    if (editingAppointmentId && a.id === editingAppointmentId) return false;
    if (!isAppointmentForCurrentClient(a)) return false;
    const aTherapistId = a.therapistId || therapists[0]?.uid;
    // Dersom timen er hos den samme behandleren, er det denne avtalen som oppdateres/avtales (ikke en kollisjon hos annen behandler)
    if (aTherapistId === selectedTherapistId) return false;
    const aStart = parseMinutes(a.startTime);
    const aEnd = parseMinutes(a.endTime);
    return bookingStartMin < aEnd && bookingEndMin > aStart;
  });

  // Eksisterende avtale for samme person hos denne behandleren i valgt tidsrom
  const existingSameClientApt = editingAppointmentId
    ? appointments.find(a => a.id === editingAppointmentId)
    : appointments.find(a => {
        if (a.date !== selectedDateStr || a.status === 'cancelled') return false;
        const aTherapistId = a.therapistId || therapists[0]?.uid;
        if (aTherapistId !== selectedTherapistId) return false;
        if (!isAppointmentForCurrentClient(a)) return false;
        const aStart = parseMinutes(a.startTime);
        const aEnd = parseMinutes(a.endTime);
        return bookingStartMin < aEnd && bookingEndMin > aStart;
      });

  const getSmartInitialStartTime = (dayStr: string, therapistId: string, durMin: number): string => {
    const dayApts = appointments.filter(a => 
      a.date === dayStr && 
      a.status !== 'cancelled' && 
      (a.therapistId ? a.therapistId === therapistId : therapists[0]?.uid === therapistId)
    ).sort((a, b) => a.startTime.localeCompare(b.startTime));

    let initialStart = '10:00';
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (dayStr === todayStr) {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const roundedMin = Math.ceil((currentMin + 5) / 15) * 15;
      if (parseMinutes(initialStart) < roundedMin) {
        const h = Math.floor(roundedMin / 60) % 24;
        const m = roundedMin % 60;
        initialStart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }

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
    return initialStart;
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    let targetTherapistId = selectedTherapistId;
    if (currentUser?.role === 'admin' || currentUser?.role === 'hovedadmin') {
      if (therapists.some(t => t.uid === currentUser.uid)) {
        if (selectedTherapistId !== currentUser.uid) {
          handleTherapistChange(currentUser.uid);
          targetTherapistId = currentUser.uid;
        }
      }
    }
    const dayStr = format(day, 'yyyy-MM-dd');
    const clinicDur = workingHours?.slotDurationMinutes || 45;
    const initialStart = getSmartInitialStartTime(dayStr, targetTherapistId, clinicDur);

    setEditingAppointmentId(null);
    setCancellingAptId(null);
    setBookingStartTime(initialStart);
    setBookingEndTime(calculateEndTime(initialStart, clinicDur / 60));
    setBookingSuggestedType('single');
    setBookingPrice(workingHours?.prices?.single ?? 950);
    setBookingNotes('');
    setIsOnlineMeeting(false);
    setSendConfirmationSms(true);
    setSendConfirmationSms(true);
    if (currentUser?.role !== 'client') {
      const activeC = clients.find(c => c.uid === selectedClientId) || clients[0];
      if (activeC) {
        if (!selectedClientId) setSelectedClientId(activeC.uid);
        setBookingClientPhone(activeC.phone || '');
      }
    } else {
      setBookingClientPhone(currentUser?.phone || '');
    }
    setIsDaySlotsModalOpen(true);
  };

  const handleOpenDelayModal = (apt: Appointment) => {
    setDelayModalApt(apt);
    setIsDelayModalOpen(true);
  };

  const handleStartEditAppointment = (apt: Appointment) => {
    const isAptPast = isPast(new Date(`${apt.date}T${apt.endTime}`));
    if (isAptPast) {
      alert('Tidligere eller gjennomførte timer kan ikke endres.');
      return;
    }

    setEditingAppointmentId(apt.id);
    setCancellingAptId(null);
    setSelectedClientId(apt.clientId);
    setSendConfirmationSms(true);
    setBookingClientPhone(apt.clientPhone || clients.find(c => c.uid === apt.clientId)?.phone || '');
    setBookingStartTime(apt.startTime);
    setBookingEndTime(apt.endTime);
    setBookingPrice(apt.price);
    setIsOnlineMeeting(apt.isOnline);
    setBookingNotes(apt.notes || '');

    const clinicDur = workingHours?.slotDurationMinutes || 45;
    const dur = calculateDurationMinutes(apt.startTime, apt.endTime);
    if (dur === clinicDur) {
      setBookingSuggestedType('single');
    } else if (dur === clinicDur * 2) {
      setBookingSuggestedType('double');
    } else if (dur === clinicDur * 3) {
      setBookingSuggestedType('triple');
    } else {
      setBookingSuggestedType(null);
    }
  };

  const handleCancelEditAppointment = () => {
    setEditingAppointmentId(null);
    const clinicDur = workingHours?.slotDurationMinutes || 45;
    const initialStart = getSmartInitialStartTime(selectedDateStr, selectedTherapistId, clinicDur);
    setBookingStartTime(initialStart);
    setBookingEndTime(calculateEndTime(initialStart, clinicDur / 60));
    setBookingSuggestedType('single');
    setBookingPrice(workingHours?.prices?.single ?? 950);
    setBookingNotes('');
    setIsOnlineMeeting(false);
    setSendConfirmationSms(true);
  };

  const handleCancelAppointment = async (aptId: string) => {
    if (!currentUser) return;
    try {
      const aptToCancel = appointments.find(a => a.id === aptId);
      await dbService.cancelAppointment(aptId, 'Avlyst av behandler/admin');
      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'cancel_appointment',
        `Avlyste time ${aptToCancel?.date} kl. ${aptToCancel?.startTime} for ${aptToCancel?.clientName}`
      );
      if (editingAppointmentId === aptId) {
        handleCancelEditAppointment();
      }
      setCancellingAptId(null);
      await loadData();
      setBookingSuccessMessage('Timen ble avlyst.');
      setTimeout(() => setBookingSuccessMessage(null), 3000);
    } catch (e: any) {
      alert('Kunne ikke avlyse timen: ' + e.message);
    }
  };

  const applyDurationSuggestion = (slotType: 'single' | 'double' | 'triple') => {
    setBookingSuggestedType(slotType);
    const clinicDur = workingHours?.slotDurationMinutes || 45;
    let multiplier = 1;
    let targetPrice = workingHours?.prices?.single ?? 950;

    if (slotType === 'double') {
      multiplier = 2;
      targetPrice = workingHours?.prices?.double ?? 1800;
    } else if (slotType === 'triple') {
      multiplier = 3;
      targetPrice = workingHours?.prices?.triple ?? 2600;
    }

    const newEnd = calculateEndTime(bookingStartTime, (clinicDur * multiplier) / 60);
    setBookingEndTime(newEnd);
    setBookingPrice(targetPrice);
  };

  const handleBookingStartTimeChange = (newStart: string) => {
    setBookingStartTime(newStart);
    if (!isValidTimeString(newStart)) return;
    const curDur = calculateDurationMinutes(bookingStartTime, bookingEndTime);
    if (curDur > 0) {
      setBookingEndTime(calculateEndTime(newStart, curDur / 60));
    } else {
      const clinicDur = workingHours?.slotDurationMinutes || 45;
      setBookingEndTime(calculateEndTime(newStart, clinicDur / 60));
    }
  };

  const handleBookingEndTimeChange = (newEnd: string) => {
    setBookingEndTime(newEnd);
    if (!isValidTimeString(newEnd)) return;
    const dur = calculateDurationMinutes(bookingStartTime, newEnd);
    const clinicDur = workingHours?.slotDurationMinutes || 45;

    if (dur === clinicDur) {
      setBookingSuggestedType('single');
      setBookingPrice(workingHours?.prices?.single ?? 950);
    } else if (dur === clinicDur * 2) {
      setBookingSuggestedType('double');
      setBookingPrice(workingHours?.prices?.double ?? 1800);
    } else if (dur === clinicDur * 3) {
      setBookingSuggestedType('triple');
      setBookingPrice(workingHours?.prices?.triple ?? 2600);
    } else {
      setBookingSuggestedType(null);
      if (dur <= clinicDur) {
        setBookingPrice(workingHours?.prices?.single ?? 950);
      } else if (dur <= clinicDur * 2) {
        setBookingPrice(workingHours?.prices?.double ?? 1800);
      } else {
        setBookingPrice(workingHours?.prices?.triple ?? 2600);
      }
    }
  };

  const handleConfirmBooking = async () => {
    if (!currentUser) return;

    if (!isValidTimeString(bookingStartTime) || !isValidTimeString(bookingEndTime)) {
      alert('Vennligst oppgi et gyldig klokkeslett (timer 00–23, minutter 00–59).');
      return;
    }

    const dur = calculateDurationMinutes(bookingStartTime, bookingEndTime);
    if (dur <= 0) {
      alert('Sluttidspunkt må være etter starttidspunkt.');
      return;
    }

    const now = new Date();
    const targetStartDateTime = new Date(`${selectedDateStr}T${bookingStartTime}`);

    const activeEditingApt = editingAppointmentId 
      ? appointments.find(a => a.id === editingAppointmentId) 
      : existingSameClientApt;

    if (activeEditingApt) {
      const existingEnd = new Date(`${activeEditingApt.date}T${activeEditingApt.endTime}`);
      if (existingEnd < now) {
        alert('Tidligere eller gjennomførte timer kan ikke endres.');
        return;
      }
      if (targetStartDateTime < now) {
        alert('Det er ikke mulig å flytte en avtale tilbake i tid. Vennligst velg et fremtidig tidspunkt.');
        return;
      }
    } else {
      if (targetStartDateTime < now) {
        alert('Det er ikke mulig å opprette avtaler tilbake i tid. Vennligst velg et fremtidig tidspunkt.');
        return;
      }
    }

    if (therapistCollision) {
      alert(`Kan ikke bestille: Tidspunktet kl. ${bookingStartTime}–${bookingEndTime} overlapper med en eksisterende avtale for behandler (kl. ${therapistCollision.startTime}–${therapistCollision.endTime}).`);
      return;
    }

    if (clientCollision) {
      alert(`Kan ikke bestille: Klienten har allerede en avtale på dette tidspunktet (kl. ${clientCollision.startTime}–${clientCollision.endTime}).`);
      return;
    }

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

      const finalPhone = (bookingClientPhone || '').trim() || clientObj.phone || '';

      if (sendConfirmationSms && !finalPhone) {
        alert('Du har valgt å sende bekreftelsesmelding med dato og tid, men mottakers mobilnummer mangler.\n\nVennligst oppgi et mobilnummer, eller fjern avhukingen for SMS.');
        setIsSubmittingBooking(false);
        return;
      }

      // Hvis telefonnummer ble fylt inn og manglet på profilen, oppdater profilen
      if (finalPhone && finalPhone !== clientObj.phone && clientObj.uid) {
        try {
          const updatedClient = { ...clientObj, phone: finalPhone };
          await dbService.saveUser(updatedClient);
          setClients(clients.map(c => c.uid === updatedClient.uid ? updatedClient : c));
        } catch (uErr) {
          console.warn('Kunne ikke auto-lagre telefonnummer til klient:', uErr);
        }
      }

      const clinicDur = workingHours?.slotDurationMinutes || 45;
      let slotType: 'single' | 'double' | 'triple' = 'single';
      if (dur >= clinicDur * 3) slotType = 'triple';
      else if (dur >= clinicDur * 2) slotType = 'double';

      if (activeEditingApt) {
        const meetingLink = isOnlineMeeting 
          ? (activeEditingApt.meetingLink || smsService.generateMeetingLink(activeEditingApt.id)) 
          : undefined;

        const updatedAppointment: Appointment = {
          ...activeEditingApt,
          clientId: clientObj.uid,
          clientNumber: clientObj.customerNumber || 1000,
          clientName: clientObj.displayName,
          clientPhone: finalPhone || activeEditingApt.clientPhone || '',
          clientEmail: clientObj.email || activeEditingApt.clientEmail || '',
          startTime: bookingStartTime,
          endTime: bookingEndTime,
          durationMinutes: dur,
          slotType,
          price: bookingPrice,
          isOnline: isOnlineMeeting,
          meetingLink,
          notes: bookingNotes || activeEditingApt.notes || undefined,
          updatedAt: new Date().toISOString()
        };

        await dbService.saveAppointment(updatedAppointment);

        // Send bekreftelse dersom avhuket
        let smsLog: any = null;
        if (sendConfirmationSms) {
          try {
            smsLog = await smsService.sendBookingConfirmation(updatedAppointment);
          } catch (smsErr) {
            console.warn('SMS-sending feilet:', smsErr);
          }
        }

        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          'update_appointment',
          `Endret time for ${clientObj.displayName} den ${updatedAppointment.date} til kl. ${updatedAppointment.startTime}–${updatedAppointment.endTime}`
        );

        await loadData();
        setIsDaySlotsModalOpen(false);
        setEditingAppointmentId(null);

        let smsStatusFeedback = '(uten SMS-bekreftelse)';
        if (sendConfirmationSms) {
          if (smsLog?.status === 'sent') {
            smsStatusFeedback = `✅ Bekreftelses-SMS er sendt til ${finalPhone}.`;
          } else if (smsLog?.status === 'simulated') {
            smsStatusFeedback = `ℹ️ SMS registrert i testmodus (API-nøkkel mangler i innstillinger).`;
          } else if (smsLog?.status === 'failed') {
            smsStatusFeedback = `⚠️ Avtale oppdatert, men SMS feilet: ${smsLog.response || 'Ukjent feil'}.`;
          } else {
            smsStatusFeedback = `Bekreftelsesmelding registrert.`;
          }
        }

        setBookingSuccessMessage(
          `Avtalen for ${clientObj.displayName} den ${updatedAppointment.date} kl. ${updatedAppointment.startTime}–${updatedAppointment.endTime} ble oppdatert! ${smsStatusFeedback}`
        );
        setTimeout(() => setBookingSuccessMessage(null), 7000);
        return;
      }

      const appointmentId = 'apt_' + Date.now();
      const meetingLink = isOnlineMeeting ? smsService.generateMeetingLink(appointmentId) : undefined;

      const newAppointment: Appointment = {
        id: appointmentId,
        clientId: clientObj.uid,
        clientNumber: clientObj.customerNumber || 1000,
        clientName: clientObj.displayName,
        clientPhone: finalPhone,
        clientEmail: clientObj.email || '',
        therapistId: selectedTherapist?.uid,
        therapistName: formatTherapistName(selectedTherapist?.displayName),
        date: selectedDateStr,
        startTime: bookingStartTime,
        endTime: bookingEndTime,
        durationMinutes: dur,
        slotType,
        price: bookingPrice,
        isOnline: isOnlineMeeting,
        ...(meetingLink ? { meetingLink } : {}),
        status: 'confirmed',
        ...(bookingNotes ? { notes: bookingNotes } : {}),
        createdAt: new Date().toISOString()
      };

      await dbService.saveAppointment(newAppointment);

      // Send bekreftelse dersom avhuket
      let smsLog: any = null;
      if (sendConfirmationSms) {
        try {
          smsLog = await smsService.sendBookingConfirmation(newAppointment);
        } catch (smsErr) {
          console.warn('SMS-sending feilet:', smsErr);
        }
      }

      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'create_appointment',
        `Bestilte time hos ${selectedTherapist?.displayName || 'terapeut'} for ${clientObj.displayName} den ${newAppointment.date} kl. ${newAppointment.startTime}–${newAppointment.endTime}`
      );

      await loadData();
      setIsDaySlotsModalOpen(false);

      let smsStatusFeedback = '(uten SMS-bekreftelse)';
      if (sendConfirmationSms) {
        if (smsLog?.status === 'sent') {
          smsStatusFeedback = `✅ Bekreftelses-SMS er sendt til ${finalPhone}.`;
        } else if (smsLog?.status === 'simulated') {
          smsStatusFeedback = `ℹ️ SMS registrert i testmodus (API-nøkkel mangler i innstillinger).`;
        } else if (smsLog?.status === 'failed') {
          smsStatusFeedback = `⚠️ Time bestilt, men SMS feilet: ${smsLog.response || 'Ukjent feil'}.`;
        } else {
          smsStatusFeedback = `Bekreftelsesmelding registrert.`;
        }
      }

      setBookingSuccessMessage(
        `Timen for ${clientObj.displayName} den ${newAppointment.date} kl. ${newAppointment.startTime}–${newAppointment.endTime} er bekreftet! ${smsStatusFeedback}`
      );
      setTimeout(() => setBookingSuccessMessage(null), 7000);
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
      
      {/* Toppkontroller - Responsivt og lekkert på mobil, iPad og desktop */}
      <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-3 sm:p-5 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Rad 1: Månedstittel og navigasjonspiler */}
          <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 capitalize tracking-tight">
              {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : "'Uke' w, MMMM", { locale: nb })}
            </h2>

            {/* Piler på mobil og iPad under lg-størrelse */}
            <div className="flex lg:hidden items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                aria-label="Forrige"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                className="px-2 py-1 text-[11px] font-semibold rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                I dag
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                aria-label="Neste"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rad 2: Visningsbryter og fargekoder */}
          <div className="flex items-center justify-between lg:justify-end gap-2 sm:gap-4 w-full lg:w-auto flex-wrap">
            {/* Fargekoder */}
            <div className="flex items-center gap-2 sm:gap-3 text-[11px] font-medium text-slate-500 flex-wrap">
              <span className="flex items-center gap-1" title="Avtalt time">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 ring-2 ring-sky-300 flex-shrink-0"></span>
                <span className="font-bold text-sky-800">{isClient ? 'Din time' : 'Avtalt time'}</span>
              </span>
              <span className="flex items-center gap-1" title="Ferie eller fravær">
                <Palmtree className="w-3 h-3 text-amber-600 flex-shrink-0" />
                <span>Ferie / fravær</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Visningsbryter */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'month' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Måned
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'week' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Uke
                </button>
              </div>

              {/* Piler på store skjermer */}
              <div className="hidden lg:flex items-center gap-1">
                <button
                  onClick={handlePrev}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  aria-label="Forrige"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                  className="px-2 py-1 text-[11px] font-semibold rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  I dag
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
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
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
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

                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Er du sikker på at du vil avlyse timen den ${apt.date} kl. ${apt.startTime}?`)) {
                              handleCancelAppointment(apt.id);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          <span>Avlys</span>
                        </button>
                        <button
                          onClick={() => {
                            const dateObj = new Date(apt.date);
                            setCurrentDate(dateObj);
                            setSelectedDate(dateObj);
                            if (apt.therapistId && apt.therapistId !== selectedTherapistId) {
                              handleTherapistChange(apt.therapistId);
                            }
                            handleStartEditAppointment(apt);
                            setIsDaySlotsModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Endre &rarr;
                        </button>
                      </div>
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
            
            const myAppointmentsToday = isClient
              ? clientAppointments.filter(a => a.date === dateStr)
              : [];
            const hasMyAppointment = myAppointmentsToday.length > 0;

            const therapistAppointmentsToday = !isClient
              ? therapistAppointments.filter(a => a.date === dateStr && a.status !== 'cancelled')
              : [];
            const hasTherapistAppointments = therapistAppointmentsToday.length > 0;

            let statusColor = 'bg-white text-slate-800 border-slate-200 hover:border-slate-300';
            if (hasMyAppointment) {
              statusColor = 'bg-sky-50/80 text-sky-950 border-sky-400 ring-2 ring-sky-500/60 shadow-xs hover:border-sky-500';
            } else if (hasTherapistAppointments) {
              statusColor = 'bg-sky-50/80 text-sky-950 border-sky-300 ring-1 ring-sky-400/50 shadow-2xs hover:border-sky-500';
            } else if (dateHoliday) {
              statusColor = 'bg-amber-50/50 text-amber-900 border-amber-200/80 hover:border-amber-300';
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

                  {/* Avtale-indikator, Ferie-ikon eller Permisjon-ikon */}
                  {hasMyAppointment ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 ring-2 ring-sky-300 shadow-xs flex-shrink-0" title={`Du har ${myAppointmentsToday.length} avtalt time denne dagen`}></span>
                  ) : hasTherapistAppointments ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 ring-2 ring-sky-300 shadow-xs flex-shrink-0" title={`Du har ${therapistAppointmentsToday.length} avtalte timer denne dagen`}></span>
                  ) : dateHoliday ? (
                    <Palmtree className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-600" />
                  ) : isTherapistInactive ? (
                    <UserX className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />
                  ) : null}
                </div>

                {/* Visning av avtaler for dagen */}
                <div className="mt-1 w-full flex justify-center sm:justify-start">
                  {hasMyAppointment ? (
                    <span className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-extrabold bg-sky-600 text-white shadow-2xs" title={`Din avtalte time: kl. ${myAppointmentsToday[0].startTime}`}>
                      <CheckCircle2 className="w-2.5 h-2.5 text-sky-200 flex-shrink-0" />
                      <span className="truncate max-w-[45px] sm:max-w-[65px]">
                        {myAppointmentsToday.length === 1 ? myAppointmentsToday[0].startTime : `${myAppointmentsToday.length} timer`}
                      </span>
                    </span>
                  ) : hasTherapistAppointments ? (
                    <div className="w-full flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-extrabold bg-sky-600 text-white shadow-2xs">
                        <CheckCircle2 className="w-2.5 h-2.5 text-sky-200 flex-shrink-0" />
                        <span className="truncate max-w-[45px] sm:max-w-[65px]">
                          {therapistAppointmentsToday.length === 1 ? `kl. ${therapistAppointmentsToday[0].startTime}` : `${therapistAppointmentsToday.length} timer`}
                        </span>
                      </span>
                      {therapistAppointmentsToday.length === 1 && (
                        <span className="hidden sm:block text-[9px] font-semibold text-slate-700 truncate pl-0.5">
                          {canViewName ? therapistAppointmentsToday[0].clientName : `Klient #${therapistAppointmentsToday[0].clientNumber || 1000}`}
                        </span>
                      )}
                    </div>
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
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal for forsinkelse / utsatt time og SMS */}
      {isDelayModalOpen && delayModalApt && (
        <AppointmentSmsModal
          isOpen={isDelayModalOpen}
          onClose={() => {
            setIsDelayModalOpen(false);
            setDelayModalApt(null);
          }}
          appointment={delayModalApt}
          initialTab="delay"
          onAppointmentUpdated={() => {
            loadData();
          }}
        />
      )}

      {/* POPUP-VINDU (MODAL): DAGENS AVTALER OG BESTILLING AV TIME */}
      {isDaySlotsModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-3 sm:p-4 border-b border-slate-100 flex items-start justify-between flex-shrink-0 bg-white">
              <div>
                <div className="flex items-center gap-2 mb-1">
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
                  ) : null}
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 capitalize">
                  {format(selectedDate, 'EEEE d. MMMM yyyy', { locale: nb })}
                </h3>

                {/* Behandlervelger med nedtrekksmeny (forvalgt for innlogget behandler) */}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                  <div className="relative inline-flex items-center">
                    <select
                      value={selectedTherapistId}
                      onChange={(e) => handleTherapistChange(e.target.value)}
                      className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg pl-2 pr-7 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer transition-colors shadow-2xs"
                      aria-label="Velg behandler"
                    >
                      {therapists.map(t => (
                        <option key={t.uid} value={t.uid}>
                          {formatTherapistName(t.displayName)} {t.uid === currentUser?.uid ? '(deg)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-1.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsDaySlotsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Lukk"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Avtalte timer og Bestillingsskjema */}
            <div className="p-3 sm:p-4 flex-1 overflow-y-auto space-y-2.5">
              
              {/* Avtalte timer for denne dagen */}
              {!isClient && (
                <div className="space-y-1.5 pb-2.5 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-sky-600" />
                    <span>Avtalte timer ({therapistAppointments.filter(a => a.date === selectedDateStr && a.status !== 'cancelled').length})</span>
                  </h4>

                  {therapistAppointments.filter(a => a.date === selectedDateStr && a.status !== 'cancelled').length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {therapistAppointments.filter(a => a.date === selectedDateStr && a.status !== 'cancelled').map(apt => {
                        const isEditingThis = editingAppointmentId === apt.id;
                        const isCancellingThis = cancellingAptId === apt.id;

                        return (
                          <div 
                            key={apt.id} 
                            className={`p-2 rounded-xl border transition-all text-xs ${
                              isEditingThis
                                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/70'
                                : 'bg-sky-50/70 border-sky-200 hover:bg-sky-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div 
                                className="cursor-pointer flex-1 min-w-0"
                                onClick={() => handleStartEditAppointment(apt)}
                                title="Klikk for å endre denne avtalen"
                              >
                                <p className="font-extrabold text-slate-900 font-mono flex items-center gap-1.5 flex-wrap">
                                  <span>kl. {apt.startTime} - {apt.endTime}</span>
                                  <span className="font-sans font-bold text-sky-800 truncate">&bull; {canViewName ? apt.clientName : `Klient #${apt.clientNumber || 1000}`}</span>
                                  {isEditingThis && (
                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                                      Redigerer
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {apt.isOnline ? 'Online videomøte' : 'Fysisk oppmøte'} {apt.notes ? `• ${apt.notes}` : ''}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="font-semibold text-slate-600 font-mono text-[11px] mr-1 hidden sm:inline">
                                  kr {apt.price},-
                                </span>
                                {isPast(new Date(`${apt.date}T${apt.endTime}`)) ? (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                                    Gjennomført
                                  </span>
                                ) : (
                                  <>
                                    {currentUser?.role !== 'client' && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDelayModal(apt)}
                                        className="px-2 py-1 rounded-lg text-[11px] font-semibold border bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                        title="Varsle forsinkelse (utsatt time) og oppdater kalenderen automatisk"
                                      >
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        <span>Utsatt</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => isEditingThis ? handleCancelEditAppointment() : handleStartEditAppointment(apt)}
                                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-colors cursor-pointer ${
                                        isEditingThis
                                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                      }`}
                                      title="Endre avtalen"
                                    >
                                      <Edit2 className="w-3 h-3 text-sky-600" />
                                      <span>{isEditingThis ? 'Avbryt' : 'Endre'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setCancellingAptId(isCancellingThis ? null : apt.id)}
                                      className="px-2 py-1 rounded-lg text-[11px] font-semibold border bg-white hover:bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Avlys avtale"
                                    >
                                      <Trash2 className="w-3 h-3 text-rose-600" />
                                      <span>Avlys</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Bekreftelse for avlysning */}
                            {isCancellingThis && (
                              <div className="mt-2 pt-1.5 border-t border-rose-200 bg-rose-50/90 -mx-2 -mb-2 p-2 rounded-b-xl flex items-center justify-between gap-2">
                                <p className="text-[11px] font-bold text-rose-900 truncate">
                                  Avlyse timen for {canViewName ? apt.clientName : `Klient #${apt.clientNumber || 1000}`}?
                                </p>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setCancellingAptId(null)}
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                                  >
                                    Nei
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelAppointment(apt.id)}
                                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-2xs cursor-pointer"
                                  >
                                    Ja, avlys
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 py-1.5 px-2.5 rounded-lg border border-slate-200">
                      Ingen avtalte timer denne dagen ennå.
                    </p>
                  )}
                </div>
              )}

              {/* Informasjon hvis klienten har avtale hos en annen behandler denne dagen */}
              {isClient && appointments.filter(a => a.clientId === currentUser?.uid && a.date === selectedDateStr && a.status === 'confirmed' && a.therapistId !== selectedTherapistId).length > 0 && (
                <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-300 text-xs text-sky-950 space-y-1">
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

              {/* Varsel ved permisjon eller ferie */}
              {isTherapistOnLeave(selectedTherapist, selectedDateStr) && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <UserX className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>Behandler er registrert i permisjon på denne datoen.</span>
                </div>
              )}
              {isDateInHoliday(selectedDateStr, therapistHolidays) && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <Palmtree className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>Behandler har ferie/fravær på denne datoen ({isDateInHoliday(selectedDateStr, therapistHolidays)?.title}).</span>
                </div>
              )}

              {/* Bestillingsskjema / Endringsskjema */}
              {isPast(selectedDate) && !isToday(selectedDate) && !editingAppointmentId ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 my-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-1">
                    <Clock className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Tidligere dato</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Det er ikke mulig å opprette avtaler tilbake i tid. Velg en dato i dag eller frem i tid i kalenderen for å avtale time.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 pt-0.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-600" />
                      <span>{editingAppointmentId || existingSameClientApt ? 'Endre avtale' : 'Avtal time'}</span>
                    </h4>
                    {editingAppointmentId && (
                      <button
                        type="button"
                        onClick={handleCancelEditAppointment}
                        className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors cursor-pointer"
                      >
                        Avbryt endring
                      </button>
                    )}
                  </div>

                  {/* Velg klient hvis admin */}
                  {currentUser?.role !== 'client' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                        Klient
                      </label>
                      <select
                        value={selectedClientId}
                        onChange={(e) => {
                          const newId = e.target.value;
                          setSelectedClientId(newId);
                          const c = clients.find(cl => cl.uid === newId);
                          setBookingClientPhone(c?.phone || '');
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none bg-white"
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

                  {/* Start- og sluttid (iPad/mobil-sikret uten overlapp) */}
                  <TimeRangeSelector
                    startTime={bookingStartTime}
                    endTime={bookingEndTime}
                    onStartTimeChange={handleBookingStartTimeChange}
                    onEndTimeChange={handleBookingEndTimeChange}
                    durationMinutes={calculateDurationMinutes(bookingStartTime, bookingEndTime)}
                  />

                  {/* Varsel dersom klokkeslett er ugyldig */}
                  {(!isValidTimeString(bookingStartTime) || !isValidTimeString(bookingEndTime)) && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>Ugyldig klokkeslett. Klokkeslett må være mellom 00:00 og 23:59 (minutter kan ikke overstige 59).</span>
                    </div>
                  )}

                  {/* Varsel dersom valgt klokkeslett for i dag er passert */}
                  {isToday(selectedDate) && isValidTimeString(bookingStartTime) && (parseMinutes(bookingStartTime) < (new Date().getHours() * 60 + new Date().getMinutes())) && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Valgt starttidspunkt ({bookingStartTime}) er tilbake i tid for i dag. Velg et klokkeslett frem i tid.</span>
                    </div>
                  )}

                  {/* Valg av varighet tilpasset Klinikk-oppsettet (uten 'Forslag til sluttid:'-tekst) */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => applyDurationSuggestion('single')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                        bookingSuggestedType === 'single'
                          ? 'border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500 font-bold shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <span className="block text-xs font-bold">Enkelttime ({clinicSlotMinutes}m)</span>
                      <span className="block text-[10px] text-sky-700 font-semibold mt-0.5">kr {workingHours?.prices?.single ?? 950},-</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyDurationSuggestion('double')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                        bookingSuggestedType === 'double'
                          ? 'border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500 font-bold shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <span className="block text-xs font-bold">Dobbelttime ({clinicSlotMinutes * 2}m)</span>
                      <span className="block text-[10px] text-sky-700 font-semibold mt-0.5">kr {workingHours?.prices?.double ?? 1800},-</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyDurationSuggestion('triple')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                        bookingSuggestedType === 'triple'
                          ? 'border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500 font-bold shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <span className="block text-xs font-bold">Trippeltime ({clinicSlotMinutes * 3}m)</span>
                      <span className="block text-[10px] text-sky-700 font-semibold mt-0.5">kr {workingHours?.prices?.triple ?? 2600},-</span>
                    </button>
                  </div>

                  {/* Varighet og pris */}
                  <div className="py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Varighet</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {calculateDurationMinutes(bookingStartTime, bookingEndTime)} minutter
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Pris</span>
                      <span className="font-extrabold text-emerald-700 text-sm">
                        kr {bookingPrice},-
                      </span>
                    </div>
                  </div>

                  {/* Møteform */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                      Møteform
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsOnlineMeeting(false)}
                        className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          !isOnlineMeeting ? 'border-sky-600 bg-sky-50 text-sky-900 font-bold' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-sky-600" />
                        <span className="text-xs">Fysisk møte</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsOnlineMeeting(true)}
                        className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isOnlineMeeting ? 'border-sky-600 bg-sky-50 text-sky-900 font-bold' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5 text-sky-600" />
                        <span className="text-xs">Online møte</span>
                      </button>
                    </div>
                  </div>

                  {/* Notat */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                      Beskjed (valgfritt)
                    </label>
                    <input
                      type="text"
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="Kort beskjed til timen..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none bg-white"
                    />
                  </div>

                  {/* Send bekreftelsesmelding (automatisk avhuket) */}
                  <div className="pt-0.5">
                    <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-colors cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sendConfirmationSms}
                        onChange={(e) => setSendConfirmationSms(e.target.checked)}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer accent-sky-600"
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <MessageSquare className="w-4 h-4 text-sky-600 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-slate-800 block leading-tight">
                            Send bekreftelsesmelding med dato og tid
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Klienten mottar bekreftelse på SMS (automatisk avhuket)
                          </span>
                        </div>
                      </div>
                    </label>

                    {sendConfirmationSms && (
                      <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-100 text-xs space-y-1 mt-1">
                        <label className="block text-[10px] font-bold text-slate-700 uppercase">
                          Mottakers mobilnummer (SMS):
                        </label>
                        {canViewPhone ? (
                          <input
                            type="tel"
                            value={bookingClientPhone}
                            onChange={(e) => setBookingClientPhone(e.target.value)}
                            placeholder="f.eks. 91234567"
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none bg-white font-mono ${
                              !bookingClientPhone.trim() ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300'
                            }`}
                          />
                        ) : (
                          <input
                            type="text"
                            disabled
                            readOnly
                            value={maskPersonalInfo(bookingClientPhone, 'phone')}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-100 text-slate-500 font-mono cursor-not-allowed select-none"
                          />
                        )}
                        {!bookingClientPhone.trim() ? (
                          <p className="text-[10px] text-amber-700 font-medium">
                            ⚠️ Mobilnummer mangler for denne klienten. Oppgi nummer for å motta bekreftelse på SMS.
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500">
                            Bekreftelses-SMS sendes automatisk til dette nummeret.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info om eksisterende avtale for samme klient i dette tidsrommet */}
                  {existingSameClientApt && !editingAppointmentId && (
                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-300 text-sky-950 text-xs flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Oppdaterer eksisterende avtale</span>
                        <span>
                          {canViewName ? existingSameClientApt.clientName : `Klient #${existingSameClientApt.clientNumber || 1000}`} har allerede en avtale i dette tidsrommet (kl. {existingSameClientApt.startTime}–{existingSameClientApt.endTime}). Bestillingen vil oppdatere denne avtalen.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Kollisjonsvarsel dersom tidspunkt overlapper */}
                  {therapistCollision && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Tidspunktet er opptatt for behandler</span>
                        <span>
                          {selectedTherapist?.displayName || 'Behandler'} har allerede en avtale i dette tidsrommet (kl. {therapistCollision.startTime}–{therapistCollision.endTime}
                          {therapistCollision.clientName && currentUser?.role !== 'client' ? ` for ${canViewName ? therapistCollision.clientName : `Klient #${therapistCollision.clientNumber || 1000}`}` : ''}).
                        </span>
                      </div>
                    </div>
                  )}

                  {clientCollision && clientCollision.id !== therapistCollision?.id && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Tidspunktet er opptatt for klienten</span>
                        <span>
                          Klienten har allerede en avtale i dette tidsrommet (kl. {clientCollision.startTime}–{clientCollision.endTime}
                          {clientCollision.therapistName ? ` hos ${clientCollision.therapistName}` : ''}).
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer - ALLTID fastmontert i bunn */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex-shrink-0 flex items-center gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3">
              <button
                type="button"
                disabled={isSubmittingBooking}
                onClick={() => {
                  setIsDaySlotsModalOpen(false);
                  setEditingAppointmentId(null);
                  setCancellingAptId(null);
                }}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer text-center"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={
                  isSubmittingBooking || 
                  !isValidTimeString(bookingStartTime) ||
                  !isValidTimeString(bookingEndTime) ||
                  calculateDurationMinutes(bookingStartTime, bookingEndTime) <= 0 ||
                  Boolean(therapistCollision || clientCollision) ||
                  (!editingAppointmentId && !existingSameClientApt && (new Date(`${selectedDateStr}T${bookingStartTime}`) < new Date()))
                }
                onClick={handleConfirmBooking}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  editingAppointmentId || existingSameClientApt
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                    : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
                }`}
              >
                {isSubmittingBooking ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Lagrer...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">
                      {editingAppointmentId || existingSameClientApt
                        ? `Lagre endring (kl. ${bookingStartTime} – ${bookingEndTime})` 
                        : `Bekreft time (kl. ${bookingStartTime} – ${bookingEndTime})`}
                    </span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
