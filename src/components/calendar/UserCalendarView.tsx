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
  User, 
  CheckCircle2, 
  ExternalLink,
  Plus,
  Trash2,
  X,
  UserX
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { Appointment, UserProfile } from '../../types';
import { formatTherapistName, isTherapistOnLeave } from '../../utils/calendar';

interface UserCalendarViewProps {
  onNavigateToBooking: (dateStr?: string) => void;
}

export const UserCalendarView: React.FC<UserCalendarViewProps> = ({ onNavigateToBooking }) => {
  const { currentUser } = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [therapists, setTherapists] = useState<UserProfile[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [cancellingAptId, setCancellingAptId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const isClient = currentUser?.role === 'client';

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const loadData = async () => {
    const apts = await dbService.getAppointments();
    const users = await dbService.getUsers();
    setAppointments(apts);

    const availableTherapists = users.filter(u => 
      (u.role === 'admin' || u.role === 'hovedadmin') &&
      (currentUser?.role !== 'client' || u.isActive !== false || !!u.leaveEndDate)
    );
    setTherapists(availableTherapists);

    if (currentUser?.role === 'admin' || currentUser?.role === 'hovedadmin') {
      if (availableTherapists.some(t => t.uid === currentUser.uid)) {
        setSelectedTherapistId(currentUser.uid);
      } else {
        setSelectedTherapistId(availableTherapists[0]?.uid || '');
      }
    } else {
      setSelectedTherapistId(availableTherapists[0]?.uid || '');
    }
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

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsDayModalOpen(true);
  };

  const handleCancelAppointment = async (aptId: string) => {
    if (!currentUser) return;
    try {
      await dbService.cancelAppointment(aptId, cancelReason || 'Avbestilt fra kalender');
      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'cancel_appointment',
        `Time avbestilt fra kalender (${aptId})`
      );

      setFeedbackMessage('Timen er nå avbestilt.');
      setCancellingAptId(null);
      setCancelReason('');
      await loadData();
    } catch (e: any) {
      alert('Kunne ikke avbestille timen: ' + e.message);
    }
  };

  // Filtrer avtaler som gjelder for den aktive brukeren
  const myAppointments = appointments.filter(a => {
    if (a.status === 'cancelled') return false;
    if (isClient) {
      return a.clientId === currentUser?.uid;
    }
    // For behandler/admin: vis avtaler knyttet til valgt behandler
    if (selectedTherapistId) {
      return a.therapistId === selectedTherapistId;
    }
    return true;
  });

  const getTherapistDisplayName = (therapistId?: string, fallbackName?: string) => {
    if (fallbackName) return formatTherapistName(fallbackName);
    if (therapistId) {
      const found = therapists.find(t => t.uid === therapistId);
      if (found) return formatTherapistName(found.displayName);
    }
    return 'Behandler';
  };

  // Kalenderintervall
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const displayDays = viewMode === 'month' ? monthDays : weekDays;

  // Dagens avtaler for valgt dato i modal
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const appointmentsOnSelectedDate = myAppointments
    .filter(a => a.date === selectedDateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const upcomingCount = myAppointments.filter(a => !isPast(new Date(`${a.date}T${a.endTime}`))).length;

  return (
    <div className="space-y-3 sm:space-y-5 w-full">
      
      {/* Toppseksjon med tittel og "Bestill time"-knapp */}
      <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-4 sm:p-5 shadow-xs w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-sky-600" />
              <span>{isClient ? 'Kalender – Mine avtaler' : 'Kalender – Avtaler & Timeplan'}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isClient 
                ? `Du har ${upcomingCount} kommende ${upcomingCount === 1 ? 'avtale' : 'avtaler'} i kalenderen.`
                : 'Oversikt over bookede konsultasjoner.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {!isClient && therapists.length > 1 && (
              <select
                aria-label="Velg behandler"
                value={selectedTherapistId}
                onChange={(e) => setSelectedTherapistId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none"
              >
                {therapists.map(t => (
                  <option key={t.uid} value={t.uid}>
                    {formatTherapistName(t.displayName)}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => onNavigateToBooking()}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-sm shadow-sky-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Bestill ny time</span>
            </button>
          </div>
        </div>
      </div>

      {feedbackMessage && (
        <div className="mx-2 sm:mx-0 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5 text-emerald-700" />
          </button>
        </div>
      )}

      {/* Kalenderkontroller (Måned, piler, ukesbryter) */}
      <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-3 sm:p-5 w-full shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Månedstittel og piler */}
          <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 capitalize tracking-tight">
              {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : "'Uke' w, MMMM yyyy", { locale: nb })}
            </h2>

            {/* Piler på mobil/nettbrett */}
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

          {/* Rad 2: Fargekode & Visningsbryter */}
          <div className="flex items-center justify-between lg:justify-end gap-2 sm:gap-4 w-full lg:w-auto flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 ring-2 ring-sky-300 flex-shrink-0"></span>
                <span className="font-bold text-sky-800">{isClient ? 'Din avtalte time' : 'Booket avtale'}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0"></span>
                <span>Ingen avtaler</span>
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

      {/* KALENDER RUTENETT */}
      <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-2 sm:p-5 w-full shadow-xs">
        {/* Ukedager */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 mb-2 uppercase">
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

            const dayAppointments = myAppointments.filter(a => a.date === dateStr);
            const hasAppointments = dayAppointments.length > 0;

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={`min-h-[72px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-xl flex flex-col justify-between text-left transition-all border cursor-pointer hover:shadow-xs active:scale-[0.98] ${
                  isSelected
                    ? 'ring-2 ring-sky-600 bg-sky-50/50 border-sky-400 shadow-xs'
                    : hasAppointments
                      ? 'bg-sky-50/60 border-sky-300 hover:border-sky-400 ring-1 ring-sky-300/60'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                } ${!isCurrentMonth && viewMode === 'month' ? 'opacity-35' : 'opacity-100'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs sm:text-sm font-bold ${
                    isDayToday ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-sky-600 text-white flex items-center justify-center' : 'text-slate-800'
                  }`}>
                    {format(day, 'd')}
                  </span>

                  {hasAppointments && (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 ring-2 ring-sky-300 shadow-xs flex-shrink-0" />
                  )}
                </div>

                {/* Vis avtale-chips på ruten */}
                <div className="w-full space-y-1 mt-1">
                  {dayAppointments.slice(0, 2).map((apt) => (
                    <div
                      key={apt.id}
                      className="px-1.5 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-bold truncate flex items-center gap-1 shadow-2xs"
                      title={`kl. ${apt.startTime} - ${apt.isOnline ? 'Online' : 'Klinikk'}`}
                    >
                      {apt.isOnline ? <Video className="w-2.5 h-2.5 flex-shrink-0" /> : <MapPin className="w-2.5 h-2.5 flex-shrink-0" />}
                      <span className="truncate">{apt.startTime}</span>
                    </div>
                  ))}
                  {dayAppointments.length > 2 && (
                    <div className="text-[9px] font-bold text-sky-800 text-center">
                      +{dayAppointments.length - 2} til
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* MODAL: DETALJER FOR VALGT DAG */}
      {isDayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            
            <button
              onClick={() => { setIsDayModalOpen(false); setCancellingAptId(null); }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Datooversikt</span>
              <h3 className="text-lg font-extrabold text-slate-900 capitalize mt-0.5">
                {format(selectedDate, 'EEEE d. MMMM yyyy', { locale: nb })}
              </h3>
              <p className="text-xs text-slate-500">
                {appointmentsOnSelectedDate.length > 0 
                  ? `${appointmentsOnSelectedDate.length} avtale(r) denne dagen`
                  : 'Ingen avtaler registrert denne dagen'}
              </p>
            </div>

            {/* Avtaleliste for valgt dag */}
            <div className="space-y-3">
              {appointmentsOnSelectedDate.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Du har ingen timeavtaler på denne datoen.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Ønsker du å sette opp en konsultasjon?</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsDayModalOpen(false);
                      onNavigateToBooking(selectedDateStr);
                    }}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Bestill time på denne datoen &rarr;
                  </button>
                </div>
              ) : (
                appointmentsOnSelectedDate.map((apt) => {
                  const therapistName = getTherapistDisplayName(apt.therapistId, apt.therapistName);
                  const isAptPast = isPast(new Date(`${apt.date}T${apt.endTime}`));
                  const isCancellingThis = cancellingAptId === apt.id;

                  return (
                    <div
                      key={apt.id}
                      className="p-4 rounded-xl border-2 border-sky-300 bg-sky-50/50 space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold font-mono text-slate-900">
                              kl. {apt.startTime} - {apt.endTime}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isAptPast 
                                ? 'bg-slate-200 text-slate-700' 
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                              {isAptPast ? 'Gjennomført' : 'Aktiv avtale'}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-slate-800 flex items-center gap-1 mt-1">
                            <User className="w-3.5 h-3.5 text-sky-600" />
                            <span>{therapistName}</span>
                          </p>
                        </div>

                        <span className="text-xs font-bold text-slate-700">kr {apt.price},-</span>
                      </div>

                      {/* Møteform */}
                      <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 border-t border-sky-200/60">
                        {apt.isOnline ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-indigo-700 font-semibold inline-flex items-center gap-1">
                              <Video className="w-3.5 h-3.5" />
                              Online videomøte
                            </span>
                            {apt.meetingLink && (
                              <a
                                href={apt.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Åpne møte</span>
                                <ExternalLink className="w-3 h-3 opacity-80" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            Fysisk oppmøte i klinikk
                          </span>
                        )}
                      </div>

                      {apt.notes && (
                        <p className="text-[11px] text-slate-500 italic bg-white/70 p-2 rounded-lg border border-sky-100">
                          Beskjed: {apt.notes}
                        </p>
                      )}

                      {/* Avbestilling */}
                      {!isAptPast && (
                        <div className="pt-2 border-t border-sky-200/60">
                          {isCancellingThis ? (
                            <div className="space-y-2 bg-white p-3 rounded-xl border border-rose-200">
                              <p className="text-xs font-bold text-rose-900">Bekreft avbestilling:</p>
                              <input
                                type="text"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Årsak til avbestilling (valgfritt)..."
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setCancellingAptId(null)}
                                  className="w-1/2 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                                >
                                  Avbryt
                                </button>
                                <button
                                  onClick={() => handleCancelAppointment(apt.id)}
                                  className="w-1/2 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                                >
                                  Bekreft avbestilling
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setCancellingAptId(apt.id)}
                              className="text-xs text-rose-700 hover:text-rose-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Avbestill denne timen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsDayModalOpen(false);
                  onNavigateToBooking(selectedDateStr);
                }}
                className="text-xs font-bold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Bestill time
              </button>
              <button
                onClick={() => { setIsDayModalOpen(false); setCancellingAptId(null); }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs cursor-pointer"
              >
                Lukk
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
