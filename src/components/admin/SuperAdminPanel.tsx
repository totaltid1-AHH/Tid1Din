import React, { useState, useEffect } from 'react';
import { format, addMonths } from 'date-fns';
import { nb } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { 
  UserProfile, 
  WorkingHoursConfig, 
  AdminPermissions,
  SmsSettings,
  SmsLog,
  Holiday
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
  X,
  Edit2,
  ChevronDown,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { formatTherapistName, isDateInHoliday, isTherapistOnLeave, generateTimeOptions } from '../../utils/calendar';

export const SuperAdminPanel: React.FC = () => {
  const { currentUser, updateUserPermissions, open2FASetupModal } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'working_hours' | 'admins' | 'sms'>('working_hours');
  const [smsSettings, setSmsSettings] = useState<SmsSettings | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [testPhone, setTestPhone] = useState('91234567');
  const [testMessage, setTestMessage] = useState('Test-SMS fra klinikken.');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const [isNewAdminOpen, setIsNewAdminOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminIsActive, setNewAdminIsActive] = useState(true);
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'hovedadmin'>('admin');
  const [newAdminPerms, setNewAdminPerms] = useState<AdminPermissions>({
    canViewClientName: true,
    canViewClientPhone: true,
    canViewClientEmail: true,
    canEditJournals: true,
    canManageAppointments: true
  });
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);

  // Redigering av terapeut
  const [editingTherapist, setEditingTherapist] = useState<UserProfile | null>(null);
  const [isEditTherapistOpen, setIsEditTherapistOpen] = useState(false);
  const [editTherapistName, setEditTherapistName] = useState('');
  const [editTherapistUsername, setEditTherapistUsername] = useState('');
  const [editTherapistPassword, setEditTherapistPassword] = useState('');
  const [editTherapistEmail, setEditTherapistEmail] = useState('');
  const [editTherapistPhone, setEditTherapistPhone] = useState('');
  const [editTherapistIsActive, setEditTherapistIsActive] = useState(true);
  const [editTherapistRole, setEditTherapistRole] = useState<'admin' | 'hovedadmin'>('admin');
  const [editTherapistPerms, setEditTherapistPerms] = useState<AdminPermissions>({
    canViewClientName: true,
    canViewClientPhone: true,
    canViewClientEmail: true,
    canEditJournals: true,
    canManageAppointments: true
  });
  const [showEditTherapistPassword, setShowEditTherapistPassword] = useState(false);

  // Ferie & Fravær tilstand
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);
  const [newHolidayTitle, setNewHolidayTitle] = useState('');
  const [newHolidayStart, setNewHolidayStart] = useState('');
  const [newHolidayEnd, setNewHolidayEnd] = useState('');


  // Permisjon modal tilstand (fra- og til-dato)
  const [leaveModalTherapistUid, setLeaveModalTherapistUid] = useState<string | null>(null);
  const [leaveStartDate, setLeaveStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [leaveEndDate, setLeaveEndDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));

  useEffect(() => {
    loadAllAdminData();
  }, [currentUser?.uid]);

  const loadAllAdminData = async (targetIdOverride?: string) => {
    const allUsers = await dbService.getUsers();
    const availableTherapists = allUsers.filter(u => u.role === 'admin' || u.role === 'hovedadmin');

    // Forhåndsvalg av terapeut: behold aktivt valgt terapeut dersom gyldig, ellers innlogget admin, ellers første
    let targetTherapistId = targetIdOverride || selectedTherapistId;
    if (!targetTherapistId || !availableTherapists.some(t => t.uid === targetTherapistId)) {
      if (currentUser && availableTherapists.some(t => t.uid === currentUser.uid)) {
        targetTherapistId = currentUser.uid;
      } else {
        targetTherapistId = availableTherapists[0]?.uid || '';
      }
    }
    setSelectedTherapistId(targetTherapistId);

    const wh = await dbService.getWorkingHours(targetTherapistId);
    const allHolidays = await dbService.getHolidays();
    const sms = await dbService.getSmsSettings();
    const sLogs = await dbService.getSmsLogs();

    setUsers(allUsers);
    setWorkingHours(wh);
    setHolidays(allHolidays);
    setSmsSettings(sms);
    setSmsLogs(sLogs);
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
    setEditTherapistUsername(therapist.username || '');
    setEditTherapistPassword(therapist.password || '');
    setEditTherapistEmail(therapist.email);
    setEditTherapistPhone(therapist.phone || '');
    setEditTherapistIsActive(therapist.isActive !== false);
    setEditTherapistRole(therapist.role === 'hovedadmin' ? 'hovedadmin' : 'admin');
    setEditTherapistPerms(therapist.permissions || {
      canViewClientName: true,
      canViewClientPhone: true,
      canViewClientEmail: true,
      canEditJournals: true,
      canManageAppointments: true
    });
    setShowEditTherapistPassword(false);
    setIsEditTherapistOpen(true);
  };

  const handleSaveTherapist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTherapist) return;
    const isPromotingToMain = editTherapistRole === 'hovedadmin';
    const updatedUser: UserProfile = {
      ...editingTherapist,
      displayName: editTherapistName.trim(),
      username: editTherapistUsername.trim() || undefined,
      password: editTherapistPassword.trim() || undefined,
      email: editTherapistEmail.trim(),
      phone: editTherapistPhone.trim() || undefined,
      isActive: editTherapistIsActive,
      role: editTherapistRole,
      ...(isPromotingToMain ? {
        permissions: {
          canViewClientName: true,
          canViewClientPhone: true,
          canViewClientEmail: true,
          canEditJournals: true,
          canManageAppointments: true
        }
      } : { permissions: editTherapistPerms })
    };
    await dbService.saveUser(updatedUser);
    setUsers(users.map(u => u.uid === editingTherapist.uid ? updatedUser : u));
    setIsEditTherapistOpen(false);
    setEditingTherapist(null);
    if (currentUser) {
      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'update_admin_permissions',
        `Endret profil og rolle for ${updatedUser.displayName} til ${updatedUser.role === 'hovedadmin' ? 'Hovedadministrator (Super-admin)' : 'Terapeut/Klinikkadministrator'}`
      );
    }
    setSaveSuccessMessage(`Endringer for ${formatTherapistName(updatedUser.displayName)} ble lagret!`);
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  const handleQuickRoleToggle = async (therapist: UserProfile, newRole: 'admin' | 'hovedadmin') => {
    if (therapist.uid === currentUser?.uid && newRole !== 'hovedadmin') {
      alert('Du kan ikke fjerne hovedadministrator-rollen fra din egen innloggede brukerkonto.');
      return;
    }

    const isPromote = newRole === 'hovedadmin';
    const confirmMsg = isPromote 
      ? `Vil du gjøre ${therapist.displayName} til Hovedadministrator (Super-admin)?\n\nBrukeren vil få nøyaktig samme rettigheter som super-admin, inkludert full tilgang til systeminnstillinger, API-nøkler, SMS-konfigurasjon og alle pasientopplysninger.`
      : `Vil du endre rollen for ${therapist.displayName} fra Hovedadministrator til Terapeut/Klinikkadministrator?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    const updatedUser: UserProfile = {
      ...therapist,
      role: newRole,
      ...(isPromote ? {
        permissions: {
          canViewClientName: true,
          canViewClientPhone: true,
          canViewClientEmail: true,
          canEditJournals: true,
          canManageAppointments: true
        }
      } : {})
    };

    await dbService.saveUser(updatedUser);
    setUsers(users.map(u => u.uid === therapist.uid ? updatedUser : u));

    if (currentUser) {
      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'update_admin_permissions',
        `Endret rolle for ${updatedUser.displayName} til ${isPromote ? 'Hovedadministrator (Super-admin)' : 'Terapeut/Klinikkadministrator'}`
      );
    }

    setSaveSuccessMessage(`${updatedUser.displayName} er nå oppdatert til ${isPromote ? 'Hovedadministrator (Super-admin)' : 'Terapeut'}!`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
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
      slotDurationMinutes: Math.max(15, Number(workingHours.slotDurationMinutes) || 45),
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


  const resetNewAdminForm = () => {
    setNewAdminName('');
    setNewAdminUsername('');
    setNewAdminPassword('');
    setNewAdminEmail('');
    setNewAdminPhone('');
    setNewAdminIsActive(true);
    setNewAdminRole('admin');
    setNewAdminPerms({
      canViewClientName: true,
      canViewClientPhone: true,
      canViewClientEmail: true,
      canEditJournals: true,
      canManageAppointments: true
    });
    setShowNewAdminPassword(false);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName || !newAdminEmail || !currentUser) return;

    const newAdmin: UserProfile = {
      uid: 'u_admin_' + Date.now(),
      email: newAdminEmail.trim(),
      username: newAdminUsername.trim() || undefined,
      password: newAdminPassword.trim() || undefined,
      role: newAdminRole,
      displayName: newAdminName.trim(),
      phone: newAdminPhone.trim() || undefined,
      twoFactorEnabled: false,
      isActive: newAdminIsActive,
      permissions: newAdminPerms,
      createdAt: new Date().toISOString()
    };

    await dbService.saveUser(newAdmin);
    setIsNewAdminOpen(false);
    resetNewAdminForm();
    await loadAllAdminData();
    setSaveSuccessMessage(`Ny ansatt/terapeut ${newAdmin.displayName} ble opprettet!`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handleSaveSmsSettings = async () => {
    if (!smsSettings || !currentUser) return;
    await dbService.saveSmsSettings(smsSettings);
    setSaveSuccessMessage('Klinikkens SMS-innstillinger er lagret!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handleSendTestSms = async () => {
    if (!testPhone.trim() || !testMessage.trim()) return;
    setIsSendingTest(true);
    setTestStatus('Sender test-SMS med klinikkens avsendernavn...');
    try {
      const res = await smsService.sendSms(testPhone.trim(), testMessage.trim(), 'booking');
      if (res.status === 'sent') {
        setTestStatus(`✅ SMS sendt vellykket til ${testPhone} fra ${smsSettings?.sender || 'klinikken'}!`);
      } else if (res.status === 'simulated') {
        setTestStatus('ℹ️ Simulert SMS sendt');
      } else {
        setTestStatus(`❌ Feil: ${res.response || 'SMS feilet'}`);
      }
      const logs = await dbService.getSmsLogs();
      setSmsLogs(logs);
    } catch (err: any) {
      setTestStatus(`❌ Feil: ${err.message || 'SMS feilet'}`);
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestStatus(null), 8000);
    }
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

          <button
            onClick={() => setActiveSubTab('sms')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
              activeSubTab === 'sms' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>SMS-innstillinger</span>
          </button>


        </div>
      </div>

      {/* FANE: TERAPEUTER & PERSONELL (KOLONNEBASERT TABELL) */}
      {activeSubTab === 'admins' && (
        <div className="bg-white rounded-none sm:rounded-2xl p-3 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-4 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-sky-600" />
                Terapeutliste &amp; Personell
              </h2>
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
                            {therapist.username && (
                              <span className="text-[11px] text-slate-400 font-mono block">@{therapist.username}</span>
                            )}
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
                          {/* Hurtigknapp for å sette eller fjerne Hovedadmin */}
                          {(currentUser?.role === 'superadmin' || currentUser?.role === 'hovedadmin') && therapist.uid !== currentUser.uid && (
                            therapist.role !== 'hovedadmin' ? (
                              <button
                                type="button"
                                onClick={() => handleQuickRoleToggle(therapist, 'hovedadmin')}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                title="Gjør til Hovedadministrator (Super-admin med fulle rettigheter)"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Gjør til Hovedadmin</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickRoleToggle(therapist, 'admin')}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                title="Sett rolle tilbake til vanlig Terapeut / Klinikkadministrator"
                              >
                                <span>Endre til Terapeut</span>
                              </button>
                            )
                          )}

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

                          {/* 2FA Google Authenticator knapp */}
                          <button
                            type="button"
                            onClick={() => open2FASetupModal(therapist)}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer ${
                              therapist.twoFactorEnabled
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                            title="Konfigurer Google Authenticator (2FA)"
                          >
                            <ShieldCheck className={`w-3.5 h-3.5 ${therapist.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span>{therapist.twoFactorEnabled ? '2FA På' : 'Sett opp 2FA'}</span>
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
                  Arbeidstid, Pauser &amp; Priser
                </h2>
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
                {(currentUser?.role === 'superadmin' || currentUser?.role === 'hovedadmin') ? (
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
              {/* Lengde på timene (varighet per time) */}
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label htmlFor="slot-duration-input" className="block text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    Lengde på timene (i minutter)
                  </label>
                  <span className="text-[11px] text-slate-400">Standard varighet for enkelttimer og tidsluker</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 max-w-[160px]">
                    <input
                      id="slot-duration-input"
                      type="number"
                      min={15}
                      max={240}
                      step={5}
                      value={workingHours.slotDurationMinutes ?? 45}
                      placeholder="45"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWorkingHours({
                          ...workingHours,
                          slotDurationMinutes: val === '' ? ('' as unknown as number) : Math.max(0, parseInt(val, 10) || 0)
                        });
                      }}
                      onBlur={(e) => {
                        const val = parseInt(String(e.target.value), 10);
                        if (!val || isNaN(val) || val < 15) {
                          setWorkingHours({
                            ...workingHours,
                            slotDurationMinutes: 45
                          });
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-xs bg-white"
                    />
                    <span className="text-xs font-semibold text-slate-500">min</span>
                  </div>

                  {/* Hurtigvalg */}
                  <div className="flex items-center gap-1">
                    {[30, 45, 60, 90].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setWorkingHours({ ...workingHours, slotDurationMinutes: dur })}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          workingHours.slotDurationMinutes === dur
                            ? 'bg-sky-600 text-white border-sky-600 shadow-2xs font-bold'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {dur}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs max-w-md">
                  <div className="bg-white rounded-xl border border-slate-300 p-2 sm:p-2.5 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all min-w-0">
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
                      Lunsj start
                    </span>
                    <div className="relative flex items-center">
                      <select
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
                        className="w-full bg-transparent font-mono text-sm sm:text-base font-extrabold text-slate-900 focus:outline-none cursor-pointer appearance-none pr-5 py-0.5 text-center"
                      >
                        {generateTimeOptions([workingHours.breaks?.[0]?.start || '12:00']).map((t) => (
                          <option key={`lunch-start-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 pointer-events-none" />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-300 p-2 sm:p-2.5 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all min-w-0">
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5 truncate">
                      Lunsj slutt
                    </span>
                    <div className="relative flex items-center">
                      <select
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
                        className="w-full bg-transparent font-mono text-sm sm:text-base font-extrabold text-slate-900 focus:outline-none cursor-pointer appearance-none pr-5 py-0.5 text-center"
                      >
                        {generateTimeOptions([workingHours.breaks?.[0]?.end || '12:30']).map((t) => (
                          <option key={`lunch-end-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Priser */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Timepriser (i kr)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] text-slate-700 font-bold block">
                      Enkelttime ({workingHours.slotDurationMinutes || 45}m)
                    </span>
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
                    <span className="text-[11px] text-slate-700 font-bold block">
                      Dobbelttime ({(workingHours.slotDurationMinutes || 45) * 2}m)
                    </span>
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
                    <span className="text-[11px] text-slate-700 font-bold block">
                      Trippeltime ({(workingHours.slotDurationMinutes || 45) * 3}m)
                    </span>
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
                      Ferie &amp; Fravær i kalender
                    </label>
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


      {/* FANE: SMS-INNSTILLINGER FOR DENNE BEDRIFTEN (KUN HOVEDADMIN) */}
      {activeSubTab === 'sms' && smsSettings && (
        <div className="bg-white rounded-none sm:rounded-2xl p-3 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-4 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-sky-600" />
                Klinikkens SMS-avsender & Varsler
              </h2>
              <p className="text-[11px] text-slate-500">
                Styr eget avsendernavn, behandlingssted, påminnelsestidspunkter og meldingsmaler for dine klienter.
              </p>
            </div>
            <button
              onClick={handleSaveSmsSettings}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-center cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lagre SMS-oppsett</span>
            </button>
          </div>

          {/* 1. Avsendernavn og Behandlingssted */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Avsendernavn i SMS (Sender ID) *
              </label>
              <input
                type="text"
                maxLength={11}
                value={smsSettings.sender || 'Hovden'}
                onChange={(e) => setSmsSettings({ ...smsSettings, sender: e.target.value })}
                placeholder="f.eks. Hovden"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Maks 11 tegn.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Navn på behandlingssted
              </label>
              <input
                type="text"
                value={smsSettings.treatmentPlace || ''}
                onChange={(e) => setSmsSettings({ ...smsSettings, treatmentPlace: e.target.value })}
                placeholder="f.eks. Hovden Terapi"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Erstatter variabelen <code className="font-mono text-sky-700">&#123;behandlingssted&#125;</code> i utsendte meldinger.
              </p>
            </div>
          </div>

          {/* 2. Automatiske påminnelser */}
          <div className="space-y-2 text-xs pt-1">
            <span className="block text-[11px] font-bold text-slate-700 uppercase">
              Automatiske SMS-påminnelser før timen
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[11px] text-slate-800">Påminnelse 1</span>
                  <input
                    type="checkbox"
                    checked={smsSettings.reminder1Enabled}
                    onChange={(e) => setSmsSettings({ ...smsSettings, reminder1Enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={smsSettings.reminder1Hours}
                    onChange={(e) => setSmsSettings({ ...smsSettings, reminder1Hours: Number(e.target.value) })}
                    className="w-14 px-2 py-1 rounded border border-slate-300 font-bold text-center bg-white"
                  />
                  <span>timer før avtalen</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[11px] text-slate-800">Påminnelse 2 (Kort varsel)</span>
                  <input
                    type="checkbox"
                    checked={smsSettings.reminder2Enabled}
                    onChange={(e) => setSmsSettings({ ...smsSettings, reminder2Enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="number"
                    min={1}
                    max={48}
                    value={smsSettings.reminder2Hours}
                    onChange={(e) => setSmsSettings({ ...smsSettings, reminder2Hours: Number(e.target.value) })}
                    className="w-14 px-2 py-1 rounded border border-slate-300 font-bold text-center bg-white"
                  />
                  <span>timer før avtalen</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Meldingsmaler */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <label className="block text-[11px] font-bold text-slate-700 uppercase">
              Maler for timebekreftelse & påminnelse
            </label>
            <div className="p-2 rounded-lg bg-sky-50/60 border border-sky-100 text-[10px] text-sky-800 flex flex-wrap gap-1.5 items-center">
              <span className="font-bold">Flettefelt:</span>
              <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 font-mono">&#123;kunde&#125;</code>
              <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 font-mono">&#123;dato&#125;</code>
              <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 font-mono">&#123;klokkeslett&#125;</code>
              <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 font-mono">&#123;behandlingssted&#125;</code>
              <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 font-mono">&#123;behandler&#125;</code>
              <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 font-mono">&#123;varighet&#125;</code>
              <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 font-mono">&#123;pris&#125;</code>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[10px] font-semibold text-slate-600 block mb-0.5">Timebekreftelse:</span>
                <textarea
                  rows={2}
                  value={smsSettings.bookingTemplate}
                  onChange={(e) => setSmsSettings({ ...smsSettings, bookingTemplate: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-600 block mb-0.5">Påminnelse:</span>
                <textarea
                  rows={2}
                  value={smsSettings.reminderTemplate}
                  onChange={(e) => setSmsSettings({ ...smsSettings, reminderTemplate: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* 4. Test-SMS for denne klinikken */}
          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
            <span className="block text-[11px] font-bold text-slate-700 uppercase">Test utsendelse fra denne klinikken</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Mobilnummer (f.eks. 91234567)"
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs sm:w-48 font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleSendTestSms}
                disabled={isSendingTest}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTest ? 'Sender...' : 'Send test-melding'}</span>
              </button>
            </div>
            {testStatus && <p className="text-[11px] font-semibold text-slate-700">{testStatus}</p>}
          </div>

          {/* 5. Siste utsendte SMS for denne klinikken */}
          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
            <span className="block text-[11px] font-bold text-slate-700 uppercase">Siste utsendte SMS for klinikken ({smsLogs.length})</span>
            {smsLogs.length === 0 ? (
              <p className="text-xs text-slate-400">Ingen SMS-meldinger logget ennå.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {smsLogs.slice(0, 15).map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 font-mono">{log.recipientPhone}</span>
                        <span className="text-slate-400">({log.type})</span>
                      </div>
                      <p className="text-[10px] text-slate-600 truncate max-w-xs sm:max-w-md">{log.message}</p>
                      {log.status === 'failed' && log.response && (
                        <p className="text-[10px] text-rose-600 font-medium">{log.response}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold self-start sm:self-center flex-shrink-0 ${
                      log.status === 'sent' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : log.status === 'failed'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
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
      )}

      {/* Modal: Ny ansatt / terapeut */}
      {isNewAdminOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-4 sm:p-7 max-w-lg w-full space-y-4 border border-slate-200 shadow-2xl max-h-[85dvh] sm:max-h-[92vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-7">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <UserCheck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Opprett ny ansatt / terapeut</h3>
                  <p className="text-xs text-slate-500">Opprett profil med innlogging og tilganger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsNewAdminOpen(false); resetNewAdminForm(); }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fullt navn *</label>
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="f.eks. Dr. Jonas Berg"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Brukernavn</label>
                  <input
                    type="text"
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value)}
                    placeholder="f.eks. jonas"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Passord</label>
                  <div className="relative flex items-center">
                    <input
                      type={showNewAdminPassword ? 'text' : 'password'}
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewAdminPassword(!showNewAdminPassword)}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showNewAdminPassword ? 'Skjul passord' : 'Vis passord'}
                    >
                      {showNewAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">E-post *</label>
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="jonas@klinikk.no"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={newAdminPhone}
                    onChange={(e) => setNewAdminPhone(e.target.value)}
                    placeholder="f.eks. 98822000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Rolle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rolle</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'hovedadmin')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs bg-white font-medium"
                >
                  <option value="admin">Terapeut / Administrator</option>
                  {(currentUser?.role === 'superadmin' || currentUser?.role === 'hovedadmin') && (
                    <option value="hovedadmin">Hovedadministrator (Full klinikk-tilgang)</option>
                  )}
                </select>
              </div>

              {/* Status bryter */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Aktiv behandler</p>
                  <p className="text-[11px] text-slate-500">Aktive behandlere er synlige i kalender og timebestilling.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAdminIsActive}
                    onChange={(e) => setNewAdminIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Rettighetsstyring */}
              {newAdminRole === 'admin' && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-700 uppercase">Innsynsrettigheter & Tilgang</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.canViewClientName}
                        onChange={(e) => setNewAdminPerms({ ...newAdminPerms, canViewClientName: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Innsyn klientnavn</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.canViewClientPhone}
                        onChange={(e) => setNewAdminPerms({ ...newAdminPerms, canViewClientPhone: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Innsyn telefon</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.canViewClientEmail}
                        onChange={(e) => setNewAdminPerms({ ...newAdminPerms, canViewClientEmail: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Innsyn e-post</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.canEditJournals}
                        onChange={(e) => setNewAdminPerms({ ...newAdminPerms, canEditJournals: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Skrive i journal</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.canManageAppointments}
                        onChange={(e) => setNewAdminPerms({ ...newAdminPerms, canManageAppointments: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-800">Administrere avtaler</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsNewAdminOpen(false); resetNewAdminForm(); }}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  Opprett ansatt
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
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-6">
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
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-4 sm:p-7 space-y-4 max-h-[85dvh] sm:max-h-[92vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-7">
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
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Brukernavn</label>
                  <input
                    type="text"
                    value={editTherapistUsername}
                    onChange={(e) => setEditTherapistUsername(e.target.value)}
                    placeholder="f.eks. kari"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Passord</label>
                  <div className="relative flex items-center">
                    <input
                      type={showEditTherapistPassword ? 'text' : 'password'}
                      value={editTherapistPassword}
                      onChange={(e) => setEditTherapistPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditTherapistPassword(!showEditTherapistPassword)}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showEditTherapistPassword ? 'Skjul passord' : 'Vis passord'}
                    >
                      {showEditTherapistPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
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

              {/* Rolle (kun Hovedadmin kan endre) */}
              {(currentUser?.role === 'superadmin' || currentUser?.role === 'hovedadmin') && (
                <div className="space-y-1.5 pt-1 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Brukertype / Rolle
                  </label>
                  <select
                    value={editTherapistRole}
                    disabled={editingTherapist.uid === currentUser?.uid}
                    onChange={(e) => setEditTherapistRole(e.target.value as 'admin' | 'hovedadmin')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="admin">Terapeut / Klinikkadministrator (admin)</option>
                    <option value="hovedadmin">Hovedadministrator / Super-admin (hovedadmin - fulle rettigheter)</option>
                  </select>
                  {editingTherapist.uid === currentUser?.uid && (
                    <p className="text-[10px] text-slate-400">
                      Du kan ikke fjerne hovedadministrator-rollen fra din egen innloggede konto.
                    </p>
                  )}
                  {editTherapistRole === 'hovedadmin' && (
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-start gap-2.5 mt-2">
                      <ShieldAlert className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold block">Fulle super-admin rettigheter</span>
                        <p className="text-[11px] text-indigo-800 leading-relaxed">
                          Hovedadministrator har nøyaktig samme rettigheter som Super-admin (full tilgang til Super-admin-menyen, GatewayAPI, SMS-maler, systemlogger, behandlingssted og alle pasientjournaler).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rettigheter hvis admin */}
              {editTherapistRole === 'admin' && (
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
