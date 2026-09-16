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
  isToday 
} from 'date-fns';
import { nb } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { 
  UserProfile, 
  WorkingHoursConfig, 
  AdminPermissions,
  SmsSettings,
  SmsLog,
  Holiday,
  DailySchedule
} from '../../types';
import { smsService } from '../../services/sms';
import { 
  Building2, 
  Users, 
  Clock, 
  Save, 
  Check, 
  Plus,
  MessageSquare,
  Send,
  KeyRound,
  Info,
  User,
  Coffee,
  Palmtree,
  Trash2,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Edit2
} from 'lucide-react';
import { formatTherapistName, isDateInHoliday, isTherapistOnLeave } from '../../utils/calendar';

export const SuperAdminPanel: React.FC = () => {
  const { currentUser, updateUserPermissions } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'working_hours' | 'admins' | 'sms'>('working_hours');
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig | null>(null);
  const [smsSettings, setSmsSettings] = useState<SmsSettings | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState('91234567');
  const [testMessage, setTestMessage] = useState('Test-SMS fra Tid1Din.');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const [isNewAdminOpen, setIsNewAdminOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Redigering av terapeut
  const [editingTherapist, setEditingTherapist] = useState<UserProfile | null>(null);
  const [isEditTherapistOpen, setIsEditTherapistOpen] = useState(false);
  const [editTherapistName, setEditTherapistName] = useState('');
  const [editTherapistEmail, setEditTherapistEmail] = useState('');
  const [editTherapistPhone, setEditTherapistPhone] = useState('');
  const [editTherapistIsActive, setEditTherapistIsActive] = useState(true);
  const [editTherapistPerms, setEditTherapistPerms] = useState<AdminPermissions>({
    canViewClientName: true,
    canViewClientPhone: true,
    canViewClientEmail: true,
    canEditJournals: true,
    canManageAppointments: true
  });

  // Ferie & Fravær tilstand
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);
  const [newHolidayTitle, setNewHolidayTitle] = useState('');
  const [newHolidayStart, setNewHolidayStart] = useState('');
  const [newHolidayEnd, setNewHolidayEnd] = useState('');

  // Kalender for dagsredigering av arbeidstid
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [editingDayDateStr, setEditingDayDateStr] = useState<string | null>(null);
  const [editingDayIsOpen, setEditingDayIsOpen] = useState(true);
  const [editingDayStartTime, setEditingDayStartTime] = useState('08:00');
  const [editingDayEndTime, setEditingDayEndTime] = useState('16:00');

  // Permisjon modal tilstand (fra- og til-dato)
  const [leaveModalTherapistUid, setLeaveModalTherapistUid] = useState<string | null>(null);
  const [leaveStartDate, setLeaveStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [leaveEndDate, setLeaveEndDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));

  useEffect(() => {
    loadAllAdminData();
  }, [currentUser?.uid]);

  const loadAllAdminData = async () => {
    const allUsers = await dbService.getUsers();
    const availableTherapists = allUsers.filter(u => u.role === 'admin' || u.role === 'hovedadmin');

    // Forhåndsvalg av terapeut: terapeuten selv hvis admin, ellers første i listen
    let targetTherapistId = selectedTherapistId;
    if (!targetTherapistId || !availableTherapists.some(t => t.uid === targetTherapistId)) {
      if (currentUser && availableTherapists.some(t => t.uid === currentUser.uid)) {
        targetTherapistId = currentUser.uid;
      } else {
        targetTherapistId = availableTherapists[0]?.uid || '';
      }
    }
    setSelectedTherapistId(targetTherapistId);

    const wh = await dbService.getWorkingHours(targetTherapistId);
    const sms = await dbService.getSmsSettings();
    const sLogs = await dbService.getSmsLogs();
    const allHolidays = await dbService.getHolidays();

    setUsers(allUsers);
    setWorkingHours(wh);
    setSmsSettings(sms);
    setSmsLogs(sLogs);
    setHolidays(allHolidays);
  };

  const handleTherapistSelect = async (therapistId: string) => {
    setSelectedTherapistId(therapistId);
    const wh = await dbService.getWorkingHours(therapistId);
    setWorkingHours(wh);
  };

  const handleOpenLeaveModal = (therapistUid: string) => {
    const user = users.find(u => u.uid === therapistUid);
    setLeaveModalTherapistUid(therapistUid);
    setLeaveStartDate(user?.leaveStartDate || format(new Date(), 'yyyy-MM-dd'));
    setLeaveEndDate(user?.leaveEndDate || format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
  };

  const handleSaveLeavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveModalTherapistUid || !leaveStartDate || !leaveEndDate) {
      alert('Vennligst oppgi både fra-dato og til-dato for permisjonen.');
      return;
    }
    if (leaveEndDate < leaveStartDate) {
      alert('Til-dato må være lik eller etter fra-dato.');
      return;
    }

    const userToUpdate = users.find(u => u.uid === leaveModalTherapistUid);
    if (!userToUpdate) return;

    const updatedUser: UserProfile = {
      ...userToUpdate,
      isActive: false,
      leaveStartDate,
      leaveEndDate
    };

    await dbService.saveUser(updatedUser);
    setUsers(users.map(u => u.uid === leaveModalTherapistUid ? updatedUser : u));
    setLeaveModalTherapistUid(null);
    setSaveSuccessMessage(`Permisjon registrert for ${formatTherapistName(userToUpdate.displayName)} (${leaveStartDate} – ${leaveEndDate})!`);
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  const handleEndLeave = async (therapistUid: string) => {
    const userToUpdate = users.find(u => u.uid === therapistUid);
    if (!userToUpdate) return;

    const updatedUser: UserProfile = {
      ...userToUpdate,
      isActive: true,
      leaveStartDate: undefined,
      leaveEndDate: undefined
    };

    await dbService.saveUser(updatedUser);
    setUsers(users.map(u => u.uid === therapistUid ? updatedUser : u));
    setSaveSuccessMessage(`Permisjon avsluttet for ${formatTherapistName(userToUpdate.displayName)}!`);
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  const handleOpenEditTherapist = (therapist: UserProfile) => {
    setEditingTherapist(therapist);
    setEditTherapistName(therapist.displayName);
    setEditTherapistEmail(therapist.email);
    setEditTherapistPhone(therapist.phone || '');
    setEditTherapistIsActive(therapist.isActive !== false);
    setEditTherapistPerms(therapist.permissions || {
      canViewClientName: true,
      canViewClientPhone: true,
      canViewClientEmail: true,
      canEditJournals: true,
      canManageAppointments: true
    });
    setIsEditTherapistOpen(true);
  };

  const handleSaveTherapist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTherapist) return;
    const updatedUser: UserProfile = {
      ...editingTherapist,
      displayName: editTherapistName.trim(),
      email: editTherapistEmail.trim(),
      phone: editTherapistPhone.trim(),
      isActive: editTherapistIsActive,
      ...(editingTherapist.role === 'admin' ? { permissions: editTherapistPerms } : {})
    };
    await dbService.saveUser(updatedUser);
    setUsers(users.map(u => u.uid === editingTherapist.uid ? updatedUser : u));
    setIsEditTherapistOpen(false);
    setEditingTherapist(null);
    setSaveSuccessMessage(`Endringer for ${formatTherapistName(updatedUser.displayName)} ble lagret!`);
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  const handleToggleTherapistActive = async (therapistUid: string) => {
    const therapist = users.find(u => u.uid === therapistUid);
    if (!therapist) return;
    const newActiveState = therapist.isActive === false;
    const updatedUser: UserProfile = {
      ...therapist,
      isActive: newActiveState,
      ...(newActiveState ? { leaveStartDate: undefined, leaveEndDate: undefined } : {})
    };
    await dbService.saveUser(updatedUser);
    setUsers(users.map(u => u.uid === therapistUid ? updatedUser : u));
    setSaveSuccessMessage(
      newActiveState
        ? `${formatTherapistName(therapist.displayName)} er nå aktivert!`
        : `${formatTherapistName(therapist.displayName)} er nå deaktivert!`
    );
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayTitle || !newHolidayStart || !newHolidayEnd) return;
    const holiday: Holiday = {
      id: 'hol_' + Date.now(),
      therapistId: selectedTherapistId,
      title: newHolidayTitle,
      startDate: newHolidayStart,
      endDate: newHolidayEnd,
      allDay: true
    };
    await dbService.saveHoliday(holiday);
    setHolidays([...holidays, holiday]);
    setIsAddingHoliday(false);
    setNewHolidayTitle('');
    setNewHolidayStart('');
    setNewHolidayEnd('');
    setSaveSuccessMessage('Ferie/fravær lagret!');
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    await dbService.deleteHoliday(holidayId);
    setHolidays(holidays.filter(h => h.id !== holidayId));
    setSaveSuccessMessage('Ferie slettet!');
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  const handleToggleAdminPermission = async (
    adminUid: string, 
    permissionKey: keyof AdminPermissions
  ) => {
    const admin = users.find(u => u.uid === adminUid);
    if (!admin || admin.role !== 'admin') return;

    const currentPerms: AdminPermissions = admin.permissions || {
      canViewClientName: true,
      canViewClientPhone: true,
      canViewClientEmail: true,
      canEditJournals: true,
      canManageAppointments: true
    };

    const updatedPerms: AdminPermissions = {
      ...currentPerms,
      [permissionKey]: !currentPerms[permissionKey]
    };

    await updateUserPermissions(adminUid, updatedPerms);
    await loadAllAdminData();
  };

  const handleSaveWorkingHours = async () => {
    if (!workingHours || !currentUser) return;
    const sanitizedWorkingHours: WorkingHoursConfig = {
      ...workingHours,
      breakBetweenMinutes: Number(workingHours.breakBetweenMinutes) || 0,
      prices: {
        single: Number(workingHours.prices?.single) || 0,
        double: Number(workingHours.prices?.double) || 0,
        triple: Number(workingHours.prices?.triple) || 0,
      }
    };
    await dbService.saveWorkingHours(sanitizedWorkingHours, selectedTherapistId);
    setWorkingHours(sanitizedWorkingHours);
    setSaveSuccessMessage('Arbeidstid, pauser og priser lagret!');
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  // Fyll kalender fra fast arbeidstid
  const handleFillCalendarFromTemplate = async () => {
    if (!workingHours || !selectedTherapistId) return;
    if (workingHours.isScheduleApproved) {
      alert('Kalenderen er godkjent og låst. Lås opp først dersom du vil overskrive med faste tider.');
      return;
    }

    const monthStart = startOfMonth(calendarDate);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const newDailySchedules: Record<string, DailySchedule> = { ...(workingHours.dailySchedules || {}) };

    days.forEach(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayOfWeek = d.getDay();
      const isWorkDay = workingHours.workDays.includes(dayOfWeek);
      newDailySchedules[dateStr] = {
        isOpen: isWorkDay,
        startTime: workingHours.startTime || '08:00',
        endTime: workingHours.endTime || '16:00'
      };
    });

    const updated: WorkingHoursConfig = {
      ...workingHours,
      dailySchedules: newDailySchedules
    };

    setWorkingHours(updated);
    await dbService.saveWorkingHours(updated, selectedTherapistId);
    setSaveSuccessMessage(`Kalenderen for ${format(calendarDate, 'MMMM yyyy', { locale: nb })} er fylt fra fast arbeidstid!`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Godkjenn og lås kalender
  const handleApproveSchedule = async () => {
    if (!workingHours || !selectedTherapistId) return;
    const updated: WorkingHoursConfig = {
      ...workingHours,
      isScheduleApproved: true
    };
    setWorkingHours(updated);
    await dbService.saveWorkingHours(updated, selectedTherapistId);
    setSaveSuccessMessage('Arbeidskalenderen er godkjent og låst!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Lås opp kalender for redigering av faste tider
  const handleUnlockSchedule = async () => {
    if (!workingHours || !selectedTherapistId) return;
    const updated: WorkingHoursConfig = {
      ...workingHours,
      isScheduleApproved: false
    };
    setWorkingHours(updated);
    await dbService.saveWorkingHours(updated, selectedTherapistId);
    setSaveSuccessMessage('Kalender låst opp for endring av faste tider.');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Åpne dagsredigering
  const handleOpenDayEditor = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayOfWeek = day.getDay();
    const existing = workingHours?.dailySchedules?.[dateStr];

    setEditingDayDateStr(dateStr);
    if (existing) {
      setEditingDayIsOpen(existing.isOpen);
      setEditingDayStartTime(existing.startTime || workingHours?.startTime || '08:00');
      setEditingDayEndTime(existing.endTime || workingHours?.endTime || '16:00');
    } else {
      const isTemplateWorkDay = workingHours?.workDays.includes(dayOfWeek) ?? false;
      setEditingDayIsOpen(isTemplateWorkDay);
      setEditingDayStartTime(workingHours?.startTime || '08:00');
      setEditingDayEndTime(workingHours?.endTime || '16:00');
    }
  };

  // Lagre redigert dag
  const handleSaveDaySchedule = async () => {
    if (!editingDayDateStr || !workingHours || !selectedTherapistId) return;

    const updatedDailySchedules: Record<string, DailySchedule> = {
      ...(workingHours.dailySchedules || {}),
      [editingDayDateStr]: {
        isOpen: editingDayIsOpen,
        startTime: editingDayStartTime,
        endTime: editingDayEndTime
      }
    };

    const updated: WorkingHoursConfig = {
      ...workingHours,
      dailySchedules: updatedDailySchedules
    };

    setWorkingHours(updated);
    await dbService.saveWorkingHours(updated, selectedTherapistId);
    setEditingDayDateStr(null);
    setSaveSuccessMessage(`Arbeidstid for ${editingDayDateStr} oppdatert!`);
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName || !newAdminEmail || !currentUser) return;

    const newAdmin: UserProfile = {
      uid: 'u_admin_' + Date.now(),
      email: newAdminEmail,
      role: 'admin',
      displayName: newAdminName,
      twoFactorEnabled: true,
      permissions: {
        canViewClientName: true,
        canViewClientPhone: false,
        canViewClientEmail: false,
        canEditJournals: true,
        canManageAppointments: true
      },
      createdAt: new Date().toISOString()
    };

    await dbService.saveUser(newAdmin);
    setIsNewAdminOpen(false);
    setNewAdminName('');
    setNewAdminEmail('');
    await loadAllAdminData();
  };

  const handleSaveSmsSettings = async () => {
    if (!smsSettings || !currentUser) return;
    await dbService.saveSmsSettings(smsSettings);
    setSaveSuccessMessage('SMS-innstillinger lagret!');
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  const handleSendTestSms = async () => {
    if (!testPhone || !testMessage) return;
    setTestStatus('Sender test-SMS...');
    const res = await smsService.sendSms(testPhone, testMessage, 'booking');
    setTestStatus(`SMS ${res.status === 'sent' ? 'sendt' : res.status === 'simulated' ? 'simulert' : 'feilet'} til ${testPhone}`);
    const logs = await dbService.getSmsLogs();
    setSmsLogs(logs);
    setTimeout(() => setTestStatus(null), 4000);
  };

  const therapistList = users.filter(u => u.role === 'admin' || u.role === 'hovedadmin');

  return (
    <div className="space-y-2.5 sm:space-y-5 w-full">
      
      {/* Header og faner */}
      <div className="bg-white rounded-none sm:rounded-2xl p-3 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-3 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
              <Building2 className="w-5 h-5 text-sky-600" />
              Klinikkinnstillinger
            </h1>
          </div>

          {saveSuccessMessage && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold self-start sm:self-center">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              {saveSuccessMessage}
            </span>
          )}
        </div>

        {/* Faner */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveSubTab('working_hours')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
              activeSubTab === 'working_hours' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Arbeidstid & Pris</span>
          </button>

          <button
            onClick={() => setActiveSubTab('admins')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
              activeSubTab === 'admins' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="sm:hidden">Personell ({therapistList.length})</span>
            <span className="hidden sm:inline">Terapeuter & Administratorer ({therapistList.length})</span>
          </button>

          {currentUser?.role === 'hovedadmin' && (
            <button
              onClick={() => setActiveSubTab('sms')}
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                activeSubTab === 'sms' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>SMS-innstillinger</span>
            </button>
          )}
        </div>
      </div>

      {/* FANE: TERAPEUTER & PERSONELL (KOLONNEBASERT TABELL) */}
      {activeSubTab === 'admins' && (
        <div className="bg-white rounded-none sm:rounded-2xl p-3 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-4 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-sky-600" />
                Terapeutliste & Personell
              </h2>
              <p className="text-xs text-slate-500">
                Oversikt over klinikkens behandlere og administratorer med status og tilgangsrettigheter.
              </p>
            </div>
            <button
              onClick={() => setIsNewAdminOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-center cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ny terapeut / admin</span>
            </button>
          </div>

          {/* Kolonnebasert tabellvisning */}
          <div className="overflow-x-auto max-w-full -mx-3 sm:mx-0">
            <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Terapeut / Navn</th>
                  <th className="py-3 px-3">Telefon</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Tilganger & Innsyn</th>
                  <th className="py-3 px-4 text-right">Handlinger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {therapistList.map((therapist) => {
                  const isMainAdmin = therapist.role === 'hovedadmin';
                  const isDeactivated = therapist.isActive === false;
                  const onLeave = isTherapistOnLeave(therapist);
                  const perms = therapist.permissions || {
                    canViewClientName: true,
                    canViewClientPhone: true,
                    canViewClientEmail: true,
                    canEditJournals: true,
                    canManageAppointments: true
                  };

                  return (
                    <tr key={therapist.uid} className={`hover:bg-slate-50/80 transition-colors ${isDeactivated ? 'bg-slate-50/50 opacity-75' : ''}`}>
                      {/* Navn & Rolle */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            isMainAdmin ? 'bg-indigo-100 text-indigo-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{therapist.displayName}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isMainAdmin ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {isMainAdmin ? 'Hovedadmin' : 'Terapeut'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block">{therapist.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Telefon */}
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {therapist.phone || <span className="text-slate-400 italic">Ikke oppgitt</span>}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {isDeactivated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            Deaktivert
                          </span>
                        ) : onLeave ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200" title={`Permisjon: ${therapist.leaveStartDate} til ${therapist.leaveEndDate}`}>
                            <UserX className="w-3 h-3 text-amber-700" />
                            I permisjon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Aktiv
                          </span>
                        )}
                      </td>

                      {/* Tilganger */}
                      <td className="py-3 px-3">
                        {isMainAdmin ? (
                          <span className="text-[11px] font-semibold text-indigo-700">Full klinikk-tilgang</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                              perms.canViewClientName ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-slate-100 text-slate-400 line-through'
                            }`}>
                              Navn
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                              perms.canViewClientPhone ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-slate-100 text-slate-400 line-through'
                            }`}>
                              Telefon
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                              perms.canEditJournals ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400 line-through'
                            }`}>
                              Journal
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                              perms.canManageAppointments ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400 line-through'
                            }`}>
                              Timeavtaler
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Handlinger */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Rediger knapp */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditTherapist(therapist)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            title="Rediger terapeut"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-sky-600" />
                            <span>Rediger</span>
                          </button>

                          {/* Deaktiver / Aktiver knapp */}
                          {!isMainAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleTherapistActive(therapist.uid)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                                isDeactivated
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                              title={isDeactivated ? 'Aktiver terapeut for bestilling' : 'Deaktiver terapeut'}
                            >
                              {isDeactivated ? 'Aktiver' : 'Deaktiver'}
                            </button>
                          )}

                          {/* Permisjon */}
                          {!isDeactivated && (
                            onLeave ? (
                              <button
                                type="button"
                                onClick={() => handleEndLeave(therapist.uid)}
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 transition-colors cursor-pointer"
                                title="Avslutt permisjon"
                              >
                                Avslutt perm.
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenLeaveModal(therapist.uid)}
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 transition-colors cursor-pointer"
                                title="Sett terapeut i permisjon"
                              >
                                Permisjon
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FANE: ARBEIDSTID & PRISER */}
      {activeSubTab === 'working_hours' && workingHours && (() => {
        const therapistList = users.filter(u => u.role === 'admin' || u.role === 'hovedadmin');
        const selectedTherapistObj = therapistList.find(t => t.uid === selectedTherapistId);

        return (
          <div className="bg-white rounded-none sm:rounded-2xl p-3 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-4 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-600" />
                  Arbeidstid, Pauser & Priser
                </h2>
                <p className="text-[11px] text-slate-500">
                  Hver terapeut har egne tilpassede arbeidstider, pauser og priser.
                </p>
              </div>

              <button
                onClick={handleSaveWorkingHours}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer self-start sm:self-auto"
              >
                <Save className="w-3.5 h-3.5" />
                Lagre innstillinger
              </button>
            </div>

            {/* Terapeut-velger & Status (Aktiv/Permisjon) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                {/* 1. Terapeutens navn */}
                {currentUser?.role === 'hovedadmin' ? (
                  <select
                    id="select-therapist-settings"
                    aria-label="Terapeut"
                    value={selectedTherapistId}
                    onChange={(e) => handleTherapistSelect(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-2xs"
                  >
                    {therapistList.map((t) => (
                      <option key={t.uid} value={t.uid}>
                        {formatTherapistName(t.displayName)} {isTherapistOnLeave(t) ? '(I permisjon)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs sm:text-sm font-bold text-slate-900 px-1">
                    {formatTherapistName(selectedTherapistObj?.displayName)}
                  </span>
                )}

                {/* 2. Sett i permisjon */}
                {selectedTherapistObj && (
                  isTherapistOnLeave(selectedTherapistObj) ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEndLeave(selectedTherapistObj.uid)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                      >
                        Avslutt permisjon
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenLeaveModal(selectedTherapistObj.uid)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
                      >
                        Endre datoer
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenLeaveModal(selectedTherapistObj.uid)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs bg-white hover:bg-amber-50 text-amber-800 border-amber-300"
                    >
                      Sett i permisjon
                    </button>
                  )
                )}
              </div>

              {selectedTherapistObj && isTherapistOnLeave(selectedTherapistObj) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  I permisjon {selectedTherapistObj.leaveStartDate && selectedTherapistObj.leaveEndDate 
                    ? `(${selectedTherapistObj.leaveStartDate} – ${selectedTherapistObj.leaveEndDate})` 
                    : ''}
                </span>
              )}
            </div>

            <div className="space-y-5">
              {/* FASTE ARBEIDSDAGER OG TID (MAL) */}
              <div className="p-3.5 sm:p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-600" />
                      Faste arbeidsdager og klokkeslett (Mal)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sett faste dager og standard arbeidstid fra/til før du redigerer hver dag i kalenderen under.
                    </p>
                  </div>

                  {workingHours.isScheduleApproved && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                        Låst (Godkjent)
                      </span>
                      <button
                        type="button"
                        onClick={handleUnlockSchedule}
                        className="text-xs font-semibold px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <Unlock className="w-3 h-3" />
                        Lås opp
                      </button>
                    </div>
                  )}
                </div>

                {workingHours.isScheduleApproved && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <span>
                      <strong>Kalenderen er godkjent og låst.</strong> Det er ikke mulig å overskrive med faste arbeidsdager og tider mens kalenderen er godkjent.
                    </span>
                  </div>
                )}

                <div className={`space-y-3 transition-opacity ${workingHours.isScheduleApproved ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                      Faste arbeidsdager
                    </label>
                    <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-center">
                      {[
                        { num: 1, label: 'Man' },
                        { num: 2, label: 'Tir' },
                        { num: 3, label: 'Ons' },
                        { num: 4, label: 'Tor' },
                        { num: 5, label: 'Fre' },
                        { num: 6, label: 'Lør' },
                        { num: 0, label: 'Søn' }
                      ].map((d) => {
                        const isActive = workingHours.workDays.includes(d.num);
                        return (
                          <button
                            key={d.num}
                            type="button"
                            disabled={workingHours.isScheduleApproved}
                            onClick={() => {
                              const newDays = isActive
                                ? workingHours.workDays.filter(x => x !== d.num)
                                : [...workingHours.workDays, d.num];
                              setWorkingHours({ ...workingHours, workDays: newDays });
                            }}
                            className={`py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                              isActive ? 'bg-sky-600 text-white border-sky-600 shadow-2xs' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-600">Fast starttid</span>
                      <input
                        type="time"
                        disabled={workingHours.isScheduleApproved}
                        value={workingHours.startTime}
                        onChange={(e) => setWorkingHours({ ...workingHours, startTime: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold mt-1 bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-600">Fast sluttid</span>
                      <input
                        type="time"
                        disabled={workingHours.isScheduleApproved}
                        value={workingHours.endTime}
                        onChange={(e) => setWorkingHours({ ...workingHours, endTime: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold mt-1 bg-white"
                      />
                    </div>
                  </div>

                  {!workingHours.isScheduleApproved && (
                    <button
                      type="button"
                      onClick={handleFillCalendarFromTemplate}
                      className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 active:scale-98 text-sky-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-sky-200 shadow-2xs"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-sky-700" />
                      Fyll kalender for {format(calendarDate, 'MMMM yyyy', { locale: nb })} fra fast arbeidstid
                    </button>
                  )}
                </div>
              </div>

              {/* HEL KALENDER FOR DAG-FOR-DAG REDIGERING */}
              {(() => {
                const calMonthStart = startOfMonth(calendarDate);
                const calMonthEnd = endOfMonth(calMonthStart);
                const calStartDate = startOfWeek(calMonthStart, { weekStartsOn: 1 });
                const calEndDate = endOfWeek(calMonthEnd, { weekStartsOn: 1 });
                const calDays = eachDayOfInterval({ start: calStartDate, end: calEndDate });

                const therapistHolidays = holidays.filter(h => 
                  !h.therapistId || h.therapistId === 'all' || h.therapistId === selectedTherapistId
                );

                return (
                  <div className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-2xl space-y-3.5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <CalendarIcon className="w-4 h-4 text-sky-600" />
                          Arbeidstidskalender (Rediger hver dag for seg)
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Klikk på en dato i kalenderen for å endre arbeidstid eller sette som fridag.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {workingHours.isScheduleApproved ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 shadow-2xs">
                            <Check className="w-4 h-4 text-emerald-700" />
                            Godkjent arbeidstid
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleApproveSchedule}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Godkjenn arbeidstid i kalenderen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Månedskontroller */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 capitalize">
                        {format(calendarDate, 'MMMM yyyy', { locale: nb })}
                      </h4>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCalendarDate(subMonths(calendarDate, 1))}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                          aria-label="Forrige måned"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarDate(new Date())}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                        >
                          I dag
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarDate(addMonths(calendarDate, 1))}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                          aria-label="Neste måned"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Ukedagsnavn */}
                    <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 uppercase">
                      <span>Man</span>
                      <span>Tir</span>
                      <span>Ons</span>
                      <span>Tor</span>
                      <span>Fre</span>
                      <span>Lør</span>
                      <span>Søn</span>
                    </div>

                    {/* Kalenderruter */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                      {calDays.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isCurrentMonth = isSameMonth(day, calendarDate);
                        const isDayToday = isToday(day);
                        const dayHoliday = isDateInHoliday(dateStr, therapistHolidays);

                        const customSched = workingHours.dailySchedules?.[dateStr];
                        const isWorkDay = customSched !== undefined ? customSched.isOpen : workingHours.workDays.includes(day.getDay());
                        const startHour = customSched?.startTime || workingHours.startTime || '08:00';
                        const endHour = customSched?.endTime || workingHours.endTime || '16:00';

                        let cellBg = 'bg-slate-50 border-slate-200 text-slate-600';
                        if (dayHoliday) {
                          cellBg = 'bg-amber-50/60 border-amber-200 text-amber-900';
                        } else if (isWorkDay) {
                          cellBg = 'bg-emerald-50/40 border-emerald-200 text-emerald-950 hover:bg-emerald-50';
                        } else {
                          cellBg = 'bg-slate-50/60 border-slate-200 text-slate-400 hover:bg-slate-100';
                        }

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => handleOpenDayEditor(day)}
                            className={`min-h-[58px] sm:min-h-[72px] p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer hover:shadow-xs active:scale-[0.98] ${cellBg} ${
                              !isCurrentMonth ? 'opacity-35' : 'opacity-100'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-xs font-bold ${
                                isDayToday ? 'w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px]' : ''
                              }`}>
                                {format(day, 'd')}
                              </span>
                              <Edit2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 opacity-60" />
                            </div>

                            <div className="mt-1">
                              {dayHoliday ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold text-amber-800 truncate max-w-full">
                                  <Palmtree className="w-2.5 h-2.5 text-amber-600 flex-shrink-0" />
                                  <span className="truncate">Ferie</span>
                                </span>
                              ) : isWorkDay ? (
                                <span className="inline-block text-[9px] sm:text-[10px] font-bold text-emerald-800">
                                  Åpen
                                </span>
                              ) : (
                                <span className="inline-block text-[9px] sm:text-[10px] font-semibold text-slate-400">
                                  Fri
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* MODAL FOR REDIGERING AV ENKELTDAG */}
              {editingDayDateStr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
                  <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-5">
                    <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                          Rediger arbeidsdag
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 capitalize mt-1">
                          {format(new Date(editingDayDateStr), 'EEEE d. MMMM yyyy', { locale: nb })}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingDayDateStr(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                        aria-label="Lukk"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="py-4 space-y-4">
                      {/* Status for dagen */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                          Status for denne dagen
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setEditingDayIsOpen(true)}
                            className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              editingDayIsOpen
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Check className="w-4 h-4 text-emerald-600" />
                            Arbeidsdag
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDayIsOpen(false)}
                            className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              !editingDayIsOpen
                                ? 'bg-slate-100 text-slate-800 border-slate-400 ring-2 ring-slate-500'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <X className="w-4 h-4 text-slate-600" />
                            Fridag / Fri
                          </button>
                        </div>
                      </div>

                      {/* Klokkeslett hvis arbeidsdag */}
                      {editingDayIsOpen && (
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[11px] font-semibold text-slate-600">Start klokkeslett</span>
                              <input
                                type="time"
                                value={editingDayStartTime}
                                onChange={(e) => setEditingDayStartTime(e.target.value)}
                                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 font-bold mt-1 text-sm bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold text-slate-600">Slutt klokkeslett</span>
                              <input
                                type="time"
                                value={editingDayEndTime}
                                onChange={(e) => setEditingDayEndTime(e.target.value)}
                                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 font-bold mt-1 text-sm bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingDayDateStr(null)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                      >
                        Avbryt
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDaySchedule}
                        className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Lagre dag
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pausetid i minutter */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <label htmlFor="custom-break-input" className="block text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-amber-600" />
                  Pausetid mellom timer (i minutter)
                </label>
                <div className="flex items-center gap-2 max-w-[160px]">
                  <input
                    id="custom-break-input"
                    type="number"
                    min={0}
                    max={180}
                    value={workingHours.breakBetweenMinutes ?? ''}
                    placeholder="0"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWorkingHours({
                        ...workingHours,
                        breakBetweenMinutes: val === '' ? ('' as unknown as number) : Math.max(0, parseInt(val, 10) || 0)
                      });
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || isNaN(Number(e.target.value))) {
                        setWorkingHours({
                          ...workingHours,
                          breakBetweenMinutes: 0
                        });
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-xs bg-white"
                  />
                  <span className="text-xs font-semibold text-slate-500">min</span>
                </div>
              </div>

              {/* Fast Lunsjpause */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Fast lunsjpause
                </label>
                <p className="text-[11px] text-slate-500">
                  Blokkerer automatisk dette tidsrommet hver arbeidsdag slik at det ikke kan bookes time da.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs max-w-sm">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold">Lunsj start</span>
                    <input
                      type="time"
                      value={workingHours.breaks?.[0]?.start || '12:00'}
                      onChange={(e) => {
                        const updatedBreaks = [...(workingHours.breaks || [])];
                        if (updatedBreaks.length === 0) {
                          updatedBreaks.push({ start: e.target.value, end: '12:30', title: 'Lunsjpause' });
                        } else {
                          updatedBreaks[0] = { ...updatedBreaks[0], start: e.target.value, title: 'Lunsjpause' };
                        }
                        setWorkingHours({ ...workingHours, breaks: updatedBreaks });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold mt-1"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold">Lunsj slutt</span>
                    <input
                      type="time"
                      value={workingHours.breaks?.[0]?.end || '12:30'}
                      onChange={(e) => {
                        const updatedBreaks = [...(workingHours.breaks || [])];
                        if (updatedBreaks.length === 0) {
                          updatedBreaks.push({ start: '12:00', end: e.target.value, title: 'Lunsjpause' });
                        } else {
                          updatedBreaks[0] = { ...updatedBreaks[0], end: e.target.value, title: 'Lunsjpause' };
                        }
                        setWorkingHours({ ...workingHours, breaks: updatedBreaks });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Priser */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Timepriser (i kr)
                </label>
                <p className="text-[11px] text-slate-500">
                  Priser som belastes og vises for klienter ved bestilling hos denne terapeuten.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-700 font-bold block">Enkelttime (45m)</span>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        min={0}
                        value={workingHours.prices.single ?? ''}
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWorkingHours({
                            ...workingHours,
                            prices: {
                              ...workingHours.prices,
                              single: val === '' ? ('' as unknown as number) : Math.max(0, parseInt(val, 10) || 0)
                            }
                          });
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '' || isNaN(Number(e.target.value))) {
                            setWorkingHours({
                              ...workingHours,
                              prices: {
                                ...workingHours.prices,
                                single: 0
                              }
                            });
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
                      />
                      <span className="text-slate-500 font-semibold text-xs">kr</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-700 font-bold block">Dobbelttime (90m)</span>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        min={0}
                        value={workingHours.prices.double ?? ''}
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWorkingHours({
                            ...workingHours,
                            prices: {
                              ...workingHours.prices,
                              double: val === '' ? ('' as unknown as number) : Math.max(0, parseInt(val, 10) || 0)
                            }
                          });
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '' || isNaN(Number(e.target.value))) {
                            setWorkingHours({
                              ...workingHours,
                              prices: {
                                ...workingHours.prices,
                                double: 0
                              }
                            });
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
                      />
                      <span className="text-slate-500 font-semibold text-xs">kr</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-700 font-bold block">Trippeltime (135m)</span>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        min={0}
                        value={workingHours.prices.triple ?? ''}
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWorkingHours({
                            ...workingHours,
                            prices: {
                              ...workingHours.prices,
                              triple: val === '' ? ('' as unknown as number) : Math.max(0, parseInt(val, 10) || 0)
                            }
                          });
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '' || isNaN(Number(e.target.value))) {
                            setWorkingHours({
                              ...workingHours,
                              prices: {
                                ...workingHours.prices,
                                triple: 0
                              }
                            });
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
                      />
                      <span className="text-slate-500 font-semibold text-xs">kr</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ferie & Fravær i kalender */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                      <Palmtree className="w-3.5 h-3.5 text-amber-600" />
                      Ferie & Fravær i kalender
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Registrer ferieuker eller fridager. Disse datoene blokkeres automatisk mot timebestilling i kalenderen.
                    </p>
                  </div>

                  {!isAddingHoliday && (
                    <button
                      type="button"
                      onClick={() => setIsAddingHoliday(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Legg til ferie
                    </button>
                  )}
                </div>

                {/* Skjema for ny ferie */}
                {isAddingHoliday && (
                  <form onSubmit={handleAddHoliday} className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2.5">
                    <p className="text-xs font-bold text-amber-900">Registrer ny ferie eller fraværsperiode</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-600">Beskrivelse / Tittel</span>
                        <input
                          type="text"
                          required
                          value={newHolidayTitle}
                          onChange={(e) => setNewHolidayTitle(e.target.value)}
                          placeholder="f.eks. Sommerferie, Avspasering"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium bg-white text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-600">Fra og med dato</span>
                        <input
                          type="date"
                          required
                          value={newHolidayStart}
                          onChange={(e) => setNewHolidayStart(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-600">Til og med dato</span>
                        <input
                          type="date"
                          required
                          value={newHolidayEnd}
                          onChange={(e) => setNewHolidayEnd(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-xs mt-0.5"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingHoliday(false);
                          setNewHolidayTitle('');
                          setNewHolidayStart('');
                          setNewHolidayEnd('');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                      >
                        Avbryt
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Lagre ferie
                      </button>
                    </div>
                  </form>
                )}

                {/* Liste over registrerte ferier */}
                <div className="space-y-1.5">
                  {(() => {
                    const currentTherapistHolidays = holidays.filter(
                      h => !h.therapistId || h.therapistId === 'all' || h.therapistId === selectedTherapistId
                    );

                    if (currentTherapistHolidays.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 italic py-1">
                          Ingen registrerte ferieperioder for denne terapeuten.
                        </p>
                      );
                    }

                    return currentTherapistHolidays.map((h) => (
                      <div key={h.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Palmtree className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <div>
                            <span className="font-bold text-slate-900">{h.title}</span>
                            <span className="text-slate-500 ml-2">
                              {h.startDate} til {h.endDate}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Slett ferie"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FANE: SMS-INNSTILLINGER (KUN HOVEDADMIN) */}
      {activeSubTab === 'sms' && currentUser?.role === 'hovedadmin' && smsSettings && (
        <div className="bg-white rounded-none sm:rounded-2xl p-3 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-4 w-full">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-sky-600" />
                SMS-innstillinger & Varsler
              </h2>
              <p className="text-[11px] text-slate-500">
                Styr avsendernavn, påminnelsestidspunkter og meldingsmaler for automatiske varsler.
              </p>
            </div>
            <button
              onClick={handleSaveSmsSettings}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Lagre oppsett
            </button>
          </div>

          {/* Notis om GatewayAPI Nøkkel */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <span className="text-slate-600">
                GatewayAPI REST-nøkkel (tilkobling) administreres under <strong>Super-admin</strong>.
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold self-start sm:self-auto ${
              smsSettings.apiKey ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {smsSettings.apiKey ? 'API-forbindelse aktiv' : 'Simulert testmodus'}
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Avsendernavn (Sender ID)
              </label>
              <input
                type="text"
                value={smsSettings.sender || 'Tid1Din'}
                onChange={(e) => setSmsSettings({ ...smsSettings, sender: e.target.value })}
                placeholder="Tid1Din"
                className="w-full sm:w-64 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Maks 11 tegn (f.eks. klinikkens navn). Vises som avsender på klientens mobil.
              </p>
            </div>

            {/* Påminnelser */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-[11px] text-slate-800">Påminnelse 1</span>
                  <input
                    type="checkbox"
                    checked={smsSettings.reminder1Enabled}
                    onChange={(e) => setSmsSettings({ ...smsSettings, reminder1Enabled: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="number"
                    value={smsSettings.reminder1Hours}
                    onChange={(e) => setSmsSettings({ ...smsSettings, reminder1Hours: Number(e.target.value) })}
                    className="w-14 px-2 py-1 rounded border border-slate-300 font-bold text-center"
                  />
                  <span>timer før timen starter</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-[11px] text-slate-800">Påminnelse 2 (Kort varsel)</span>
                  <input
                    type="checkbox"
                    checked={smsSettings.reminder2Enabled}
                    onChange={(e) => setSmsSettings({ ...smsSettings, reminder2Enabled: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="number"
                    value={smsSettings.reminder2Hours}
                    onChange={(e) => setSmsSettings({ ...smsSettings, reminder2Hours: Number(e.target.value) })}
                    className="w-14 px-2 py-1 rounded border border-slate-300 font-bold text-center"
                  />
                  <span>timer før timen starter</span>
                </div>
              </div>
            </div>

            {/* Meldingsmaler */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Maler for timebekreftelse & påminnelse
              </label>
              <div className="p-2 rounded-lg bg-sky-50/60 border border-sky-100 text-[10px] text-sky-800 flex flex-wrap gap-1.5">
                <span className="font-bold">Tilgjengelige variabler:</span>
                <code className="bg-white px-1 rounded border border-sky-200 font-mono">&#123;kunde&#125;</code>
                <code className="bg-white px-1 rounded border border-sky-200 font-mono">&#123;kundenummer&#125;</code>
                <code className="bg-white px-1 rounded border border-sky-200 font-mono">&#123;dato&#125;</code>
                <code className="bg-white px-1 rounded border border-sky-200 font-mono">&#123;klokkeslett&#125;</code>
                <code className="bg-white px-1 rounded border border-sky-200 font-mono">&#123;varighet&#125;</code>
                <code className="bg-white px-1 rounded border border-sky-200 font-mono">&#123;pris&#125;</code>
                <code className="bg-white px-1 rounded border border-sky-200 font-mono">&#123;avbestillingslenke&#125;</code>
                <code className="bg-white px-1 rounded border border-sky-200 font-mono">&#123;motelenke&#125;</code>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-600">Bekreftelsesmal (sendes ved ny booking):</span>
                <textarea
                  rows={2}
                  value={smsSettings.bookingTemplate}
                  onChange={(e) => setSmsSettings({ ...smsSettings, bookingTemplate: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-600">Påminnelsesmal (sendes før timen):</span>
                <textarea
                  rows={2}
                  value={smsSettings.reminderTemplate}
                  onChange={(e) => setSmsSettings({ ...smsSettings, reminderTemplate: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>

            {/* Test-SMS sending */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="block text-[11px] font-bold text-slate-700 uppercase">Test SMS-utsendelse</span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Mobilnummer (f.eks. 91234567)"
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs sm:w-48 font-mono"
                />
                <button
                  onClick={handleSendTestSms}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send test-melding
                </button>
              </div>
              {testStatus && <p className="text-[11px] font-semibold text-emerald-700">{testStatus}</p>}
            </div>

            {/* Siste SMS-logger */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="block text-[11px] font-bold text-slate-700 uppercase">Siste utsendte SMS ({smsLogs.length})</span>
              {smsLogs.length === 0 ? (
                <p className="text-xs text-slate-400">Ingen SMS-meldinger logget ennå.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-1.5">
                  {smsLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800">{log.recipientPhone}</span>
                        <span className="text-slate-400 ml-1.5">({log.type})</span>
                        <p className="text-[10px] text-slate-500 truncate max-w-xs sm:max-w-md">{log.message}</p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        log.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {log.status === 'sent' ? 'Sendt' : 'Simulert'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}



      {/* Modal: Ny admin */}
      {isNewAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3">
            <h3 className="text-base font-bold text-slate-900">Opprett administrator</h3>
            <form onSubmit={handleCreateAdmin} className="space-y-2.5 text-xs">
              <input
                type="text"
                required
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="Navn"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="E-post"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsNewAdminOpen(false)}
                  className="w-1/2 py-2 rounded-xl border border-slate-300"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-xl bg-indigo-600 text-white font-bold"
                >
                  Opprett
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FOR Å SETTE PERMISJON (MED FRA- OG TIL-DATO) */}
      {leaveModalTherapistUid && (() => {
        const modalUser = users.find(u => u.uid === leaveModalTherapistUid);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-6">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                      <UserX className="w-3 h-3 text-amber-700" />
                      Registrer permisjon
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {formatTherapistName(modalUser?.displayName) || 'Behandler'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setLeaveModalTherapistUid(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  aria-label="Lukk"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveLeavePeriod} className="space-y-4 py-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Angi tidsrommet for permisjonen. I denne perioden vil timebestilling hos denne behandleren være sperret.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Fra dato
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Til dato (inkludert)
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveModalTherapistUid(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Lagre permisjon
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL FOR Å REDIGERE TERAPEUT */}
      {isEditTherapistOpen && editingTherapist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Edit2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Rediger terapeut</h3>
                  <p className="text-xs text-slate-500">{editingTherapist.displayName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTherapistOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTherapist} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Navn *</label>
                <input
                  type="text"
                  required
                  value={editTherapistName}
                  onChange={(e) => setEditTherapistName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">E-post *</label>
                  <input
                    type="email"
                    required
                    value={editTherapistEmail}
                    onChange={(e) => setEditTherapistEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={editTherapistPhone}
                    onChange={(e) => setEditTherapistPhone(e.target.value)}
                    placeholder="98822000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Status bryter */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Aktiv behandler</p>
                  <p className="text-[11px] text-slate-500">Deaktiverte behandlere kan ikke motta timebestillinger.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editTherapistIsActive}
                    onChange={(e) => setEditTherapistIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Rettigheter hvis admin */}
              {editingTherapist.role === 'admin' && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-700 uppercase">Innsynsrettigheter & Tilgang</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTherapistPerms.canViewClientName}
                        onChange={(e) => setEditTherapistPerms({ ...editTherapistPerms, canViewClientName: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Innsyn klientnavn</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTherapistPerms.canViewClientPhone}
                        onChange={(e) => setEditTherapistPerms({ ...editTherapistPerms, canViewClientPhone: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Innsyn telefon</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTherapistPerms.canViewClientEmail}
                        onChange={(e) => setEditTherapistPerms({ ...editTherapistPerms, canViewClientEmail: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Innsyn e-post</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTherapistPerms.canEditJournals}
                        onChange={(e) => setEditTherapistPerms({ ...editTherapistPerms, canEditJournals: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Skrive i journal</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer col-span-1 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={editTherapistPerms.canManageAppointments}
                        onChange={(e) => setEditTherapistPerms({ ...editTherapistPerms, canManageAppointments: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Administrere timeavtaler</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditTherapistOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 cursor-pointer transition-all"
                >
                  Lagre endringer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
