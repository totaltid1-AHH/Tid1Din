import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { Appointment, UserProfile } from '../../types';
import { maskPersonalInfo } from '../../utils/crypto';
import { JournalModal } from '../journal/JournalModal';
import { AppointmentSmsModal } from '../appointments/AppointmentSmsModal';
import { 
  Calendar, 
  Clock, 
  Search, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Video, 
  MapPin, 
  Phone, 
  UserCheck, 
  EyeOff,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface AdminDashboardProps {
  onNavigateToCalendar: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateToCalendar }) => {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJournalClient, setSelectedJournalClient] = useState<UserProfile | null>(null);
  const [selectedJournalAppointment, setSelectedJournalAppointment] = useState<Appointment | null>(null);
  const [isJournalOpen, setIsJournalOpen] = useState(false);

  // SMS & Timeombooking modal state
  const [smsModalAppointment, setSmsModalAppointment] = useState<Appointment | null>(null);
  const [smsModalClient, setSmsModalClient] = useState<UserProfile | null>(null);
  const [smsModalTab, setSmsModalTab] = useState<'delay' | 'reschedule' | 'templates'>('delay');
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  const canViewName = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canViewClientName !== false;
  const canViewPhone = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canViewClientPhone !== false;
  const canViewEmail = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canViewClientEmail !== false;
  const canEditJournals = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canEditJournals !== false;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const apts = await dbService.getAppointments();
    const users = await dbService.getUsers();
    setAppointments(apts);
    setClients(users.filter(u => u.role === 'client'));
  };

  const handleUpdateStatus = async (id: string, newStatus: Appointment['status']) => {
    const apt = appointments.find(a => a.id === id);
    if (!apt || !currentUser) return;

    apt.status = newStatus;
    await dbService.saveAppointment(apt);
    await loadData();
  };

  const handleOpenJournalForClient = (clientId: string, apt?: Appointment) => {
    const client = clients.find(c => c.uid === clientId);
    if (client) {
      setSelectedJournalClient(client);
      setSelectedJournalAppointment(apt || null);
      setIsJournalOpen(true);
    }
  };

  const handleOpenSmsModal = (apt: Appointment, tab: 'delay' | 'reschedule' | 'templates' = 'delay') => {
    const client = clients.find(c => c.uid === apt.clientId) || null;
    setSmsModalAppointment(apt);
    setSmsModalClient(client);
    setSmsModalTab(tab);
    setIsSmsModalOpen(true);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayAppointments = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled');
  const upcomingAppointments = appointments.filter(
    a => a.date >= todayStr && a.status === 'confirmed'
  ).sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime());

  const cancelledAppointments = appointments.filter(a => a.status === 'cancelled');

  const filteredAppointments = appointments.filter(a => {
    const term = searchTerm.toLowerCase();
    const matchesNumber = String(a.clientNumber).includes(term);
    const matchesName = canViewName && a.clientName.toLowerCase().includes(term);
    const matchesPhone = canViewPhone && a.clientPhone && a.clientPhone.includes(term);
    return matchesNumber || matchesName || matchesPhone;
  });

  return (
    <div className="space-y-2.5 sm:space-y-5 w-full">
      
      {!canViewName && (
        <div className="p-3 rounded-none sm:rounded-xl bg-amber-50 border-y sm:border border-amber-200 text-amber-900 text-xs flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-medium">Skjermet modus: Klientnavn, telefon og e-post er maskert.</span>
          </div>
        </div>
      )}

      {/* Hurtigstatistikk - Kompakt grid på mobil */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 px-2 sm:px-0 w-full">
        
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">I dag</p>
            <p className="text-lg sm:text-xl font-black text-slate-900">{todayAppointments.length}</p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Kommende</p>
            <p className="text-lg sm:text-xl font-black text-slate-900">{upcomingAppointments.length}</p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Klienter</p>
            <p className="text-lg sm:text-xl font-black text-slate-900">{clients.length}</p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Avbestilt</p>
            <p className="text-lg sm:text-xl font-black text-slate-900">{cancelledAppointments.length}</p>
          </div>
        </div>

      </div>

      {/* Hurtigsøk etter klient - full bredde */}
      <div className="bg-white rounded-none sm:rounded-2xl p-3 border-y sm:border border-slate-200 shadow-xs flex items-center gap-2.5 w-full">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Søk etter klient (#1000, navn, telefon)..."
          className="w-full text-xs sm:text-sm outline-none text-slate-800 placeholder:text-slate-400"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-[11px] text-slate-400">
            Nullstill
          </button>
        )}
      </div>

      {/* Dagens Timer */}
      <div className="bg-white rounded-none sm:rounded-3xl p-3 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-3 w-full">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-sky-600" />
            Dagens timer ({format(new Date(), 'd. MMMM', { locale: nb })})
          </h2>
          <button
            onClick={onNavigateToCalendar}
            className="text-[11px] font-bold text-sky-600 hover:text-sky-800"
          >
            Kalender &rarr;
          </button>
        </div>

        {todayAppointments.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Ingen timer planlagt for i dag.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {todayAppointments.map((apt) => {
              const displayName = canViewName ? apt.clientName : `Klient #${apt.clientNumber}`;
              const displayPhone = canViewPhone ? (apt.clientPhone || 'Ingen tlf') : maskPersonalInfo(apt.clientPhone, 'phone');

              return (
                <div key={apt.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">{displayName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-mono font-bold">
                          #{apt.clientNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono font-bold text-slate-800">{apt.startTime} - {apt.endTime}</span>
                        <span>•</span>
                        <span>{apt.isOnline ? 'Online' : 'Fysisk'}</span>
                      </div>

                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{displayPhone}</span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      {apt.status === 'confirmed' ? 'Bekreftet' : apt.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {canEditJournals && (
                        <button
                          onClick={() => handleOpenJournalForClient(apt.clientId, apt)}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-[11px] flex items-center gap-1 transition-colors border border-sky-100"
                        >
                          <FileText className="w-3 h-3" />
                          Journal
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenSmsModal(apt, 'delay')}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] flex items-center gap-1 transition-colors border border-amber-200 shadow-2xs"
                        title="Send forsinkelses-SMS (+15 min) eller ombook time"
                      >
                        <MessageSquare className="w-3 h-3 text-amber-600" />
                        Varsle / Flytt
                      </button>

                      {apt.isOnline && apt.meetingLink && (
                        <a
                          href={apt.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] flex items-center gap-1 transition-colors border border-indigo-100"
                        >
                          <Video className="w-3 h-3" />
                          Møterom
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateStatus(apt.id, 'completed')}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Fullført"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(apt.id, 'cancelled')}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        title="Avbestill"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Kommende Timer Tabell */}
      <div className="bg-white rounded-none sm:rounded-3xl p-3 sm:p-5 border-y sm:border border-slate-200 shadow-xs space-y-3 w-full max-w-full overflow-hidden">
        <h3 className="text-xs sm:text-sm font-bold text-slate-900">
          {searchTerm ? `Søk: "${searchTerm}" (${filteredAppointments.length})` : `Kommende timer (${upcomingAppointments.length})`}
        </h3>

        <div className="overflow-x-auto max-w-full -mx-3 px-3 sm:mx-0 sm:px-0">
          <table className="w-full text-left text-xs text-slate-600 min-w-[500px]">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Dato & Tid</th>
                <th className="py-2.5 px-3">Klient</th>
                <th className="py-2.5 px-3">Møteform</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(searchTerm ? filteredAppointments : upcomingAppointments).map((apt) => {
                const displayName = canViewName ? apt.clientName : `Klient #${apt.clientNumber}`;
                return (
                  <tr key={apt.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {apt.date} <span className="font-mono text-slate-400 font-normal">({apt.startTime})</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-900">{displayName}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-1">#{apt.clientNumber}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      {apt.isOnline ? (
                        <span className="inline-flex items-center gap-1 text-indigo-700">
                          <Video className="w-3 h-3" /> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <MapPin className="w-3 h-3" /> Fysisk
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                        apt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {apt.status === 'confirmed' ? 'Bekreftet' : apt.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEditJournals && (
                          <button
                            onClick={() => handleOpenJournalForClient(apt.clientId, apt)}
                            className="px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold text-[11px] transition-colors border border-sky-100"
                          >
                            Journal
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenSmsModal(apt, 'reschedule')}
                          className="px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors border border-slate-200"
                          title="Send SMS eller ombook time"
                        >
                          <MessageSquare className="w-3 h-3 text-slate-500" />
                          Varsle / Flytt
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Journal Modal */}
      {selectedJournalClient && (
        <JournalModal
          client={selectedJournalClient}
          appointment={selectedJournalAppointment}
          isOpen={isJournalOpen}
          onClose={() => { 
            setIsJournalOpen(false); 
            setSelectedJournalClient(null); 
            setSelectedJournalAppointment(null);
          }}
        />
      )}

      {/* SMS & Timeombooking Modal */}
      {isSmsModalOpen && (
        <AppointmentSmsModal
          isOpen={isSmsModalOpen}
          onClose={() => {
            setIsSmsModalOpen(false);
            setSmsModalAppointment(null);
            setSmsModalClient(null);
          }}
          appointment={smsModalAppointment}
          client={smsModalClient}
          initialTab={smsModalTab}
          onAppointmentUpdated={() => {
            loadData();
          }}
        />
      )}

    </div>
  );
};
