import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { UserProfile } from '../../types';
import { maskPersonalInfo } from '../../utils/crypto';
import { JournalModal } from '../journal/JournalModal';
import { AppointmentSmsModal } from '../appointments/AppointmentSmsModal';
import { 
  Users, 
  UserPlus, 
  Search, 
  FileText, 
  Phone, 
  Trash2, 
  X, 
  ShieldCheck,
  Edit2,
  Calendar,
  UserCheck,
  UserX,
  MessageSquare,
  Lock,
  ShieldAlert
} from 'lucide-react';

interface ClientListViewProps {
  onOpenJournal?: (clientId: string) => void;
}

export const ClientListView: React.FC<ClientListViewProps> = ({ onOpenJournal }) => {
  const { currentUser, registerClient } = useAuth();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJournalClient, setSelectedJournalClient] = useState<UserProfile | null>(null);
  const [isJournalOpen, setIsJournalOpen] = useState(false);

  // SMS Modal State
  const [smsModalClient, setSmsModalClient] = useState<UserProfile | null>(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Ny klient modal-state
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientBirthDate, setNewClientBirthDate] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');

  // Rediger klient modal-state
  const [editingClient, setEditingClient] = useState<UserProfile | null>(null);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editClientEmail, setEditClientEmail] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editClientAddress, setEditClientAddress] = useState('');
  const [editClientBirthDate, setEditClientBirthDate] = useState('');
  const [editClientNotes, setEditClientNotes] = useState('');
  const [editClientIsActive, setEditClientIsActive] = useState(true);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canViewName = (currentUser?.role === 'superadmin' || currentUser?.role === 'hovedadmin') || currentUser?.permissions?.canViewClientName !== false;
  const canViewPhone = (currentUser?.role === 'superadmin' || currentUser?.role === 'hovedadmin') || currentUser?.permissions?.canViewClientPhone !== false;
  const canViewEmail = (currentUser?.role === 'superadmin' || currentUser?.role === 'hovedadmin') || currentUser?.permissions?.canViewClientEmail !== false;
  const canEditJournals = (currentUser?.role === 'superadmin' || currentUser?.role === 'hovedadmin') || currentUser?.permissions?.canEditJournals !== false;
  const isSuperAdmin = (currentUser?.role === 'superadmin' || currentUser?.role === 'hovedadmin');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const users = await dbService.getUsers();
    setClients(users.filter(u => u.role === 'client'));
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientEmail) return;

    setIsSubmitting(true);
    try {
      await registerClient({
        displayName: newClientName,
        email: newClientEmail,
        phone: newClientPhone,
        address: newClientAddress,
        birthDate: newClientBirthDate,
        notes: newClientNotes
      });

      await loadClients();
      setIsNewClientModalOpen(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientAddress('');
      setNewClientBirthDate('');
      setNewClientNotes('');
    } catch (e: any) {
      alert('Kunne ikke opprette klient: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (uid: string, name: string) => {
    if (!confirm(`Slette klienten "${name}"?`)) return;
    await dbService.deleteUser(uid);
    await loadClients();
    setFeedbackMessage(`Klienten "${name}" ble slettet.`);
    setTimeout(() => setFeedbackMessage(null), 2500);
  };

  const handleOpenEditClient = (client: UserProfile) => {
    setEditingClient(client);
    setEditClientName(canViewName ? client.displayName : '');
    setEditClientEmail((canViewEmail && canViewName) ? client.email : '');
    setEditClientPhone((canViewPhone && canViewName) ? (client.phone || '') : '');
    setEditClientAddress(canViewName ? (client.address || '') : '');
    setEditClientBirthDate(canViewName ? (client.birthDate || '') : '');
    setEditClientNotes(client.notes || '');
    setEditClientIsActive(client.isActive !== false);
    setIsEditClientOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    setIsSubmitting(true);
    try {
      const updatedUser: UserProfile = {
        ...editingClient,
        displayName: canViewName ? editClientName.trim() : editingClient.displayName,
        email: (canViewEmail && canViewName) ? editClientEmail.trim() : editingClient.email,
        phone: (canViewPhone && canViewName) ? editClientPhone.trim() : editingClient.phone,
        address: canViewName ? editClientAddress.trim() : editingClient.address,
        birthDate: canViewName ? editClientBirthDate.trim() : editingClient.birthDate,
        notes: editClientNotes.trim(),
        isActive: editClientIsActive,
        role: editingClient.role || 'client'
      };

      await dbService.saveUser(updatedUser);
      setClients(prev => prev.map(c => c.uid === editingClient.uid ? updatedUser : c));
      setIsEditClientOpen(false);
      setEditingClient(null);
      const targetLabel = canViewName ? updatedUser.displayName : `Klient #${updatedUser.customerNumber || 1000}`;
      setFeedbackMessage(`Endringer for ${targetLabel} ble lagret!`);
      setTimeout(() => setFeedbackMessage(null), 2500);
    } catch (err: any) {
      alert('Kunne ikke oppdatere klient: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleClientActive = async (client: UserProfile) => {
    const newActiveState = client.isActive === false;
    try {
      const updatedUser: UserProfile = {
        ...client,
        isActive: newActiveState
      };
      await dbService.saveUser(updatedUser);
      setClients(prev => prev.map(c => c.uid === client.uid ? updatedUser : c));
      const targetName = canViewName ? ` (${client.displayName})` : '';
      setFeedbackMessage(
        newActiveState
          ? `Klient #${client.customerNumber || 1000}${targetName} er nå aktivert!`
          : `Klient #${client.customerNumber || 1000}${targetName} er nå deaktivert!`
      );
      setTimeout(() => setFeedbackMessage(null), 2500);
    } catch (err: any) {
      alert('Kunne ikke endre status: ' + err.message);
    }
  };

  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesNumber = String(c.customerNumber || '').includes(term);
    const matchesName = canViewName && c.displayName.toLowerCase().includes(term);
    const matchesPhone = canViewPhone && c.phone && c.phone.includes(term);
    return matchesNumber || matchesName || matchesPhone;
  });

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap w-full">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-sky-600" />
          <span>Klienter</span>
          <span className="text-xs font-normal text-slate-400">({clients.length})</span>
        </h1>

        {isSuperAdmin && (
          <button
            onClick={() => setIsNewClientModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors flex-shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Ny klient</span>
          </button>
        )}
      </div>

      {/* Søk */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2.5 w-full">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Søk etter kundenr (#1000), navn eller telefon..."
          className="w-full min-w-0 flex-1 text-xs sm:text-sm outline-none text-slate-800 placeholder:text-slate-400 bg-transparent"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-xs text-slate-400 hover:text-slate-600 px-2 flex-shrink-0">
            Nullstill
          </button>
        )}
      </div>

      {feedbackMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-xl font-medium flex items-center justify-between shadow-2xs">
          <span>{feedbackMessage}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Kolonnebasert tabellvisning for klienter (desktop) + Kortvisning (mobil) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden w-full">
        {/* Mobil kortliste */}
        <div className="sm:hidden divide-y divide-slate-100">
          {filteredClients.length === 0 ? (
            <div className="py-8 text-center text-slate-400 italic text-xs">
              Ingen klienter funnet som matcher søket.
            </div>
          ) : (
            filteredClients.map((client) => {
              const displayName = canViewName ? client.displayName : `Klient #${client.customerNumber || 1000}`;
              const displayPhone = canViewPhone ? (client.phone || 'Ikke oppgitt') : maskPersonalInfo(client.phone, 'phone');
              const isDeactivated = client.isActive === false;

              return (
                <div key={client.uid} className={`p-3.5 flex flex-col gap-2.5 transition-colors ${isDeactivated ? 'bg-slate-50/50 opacity-75' : 'bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold font-mono text-xs border border-sky-100 flex-shrink-0">
                        #{client.customerNumber || 1000}
                      </span>
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {displayName}
                      </span>
                      {client.twoFactorEnabled && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 flex-shrink-0">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                          2FA
                        </span>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {isDeactivated ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                          Deaktivert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Aktiv
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="text-xs text-slate-500 font-mono truncate">
                      {canViewPhone && client.phone ? (
                        <span className="flex items-center gap-1 text-slate-700">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {client.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">{displayPhone}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {canEditJournals && (
                        <button
                          onClick={() => {
                            if (onOpenJournal) {
                              onOpenJournal(client.uid);
                            } else {
                              setSelectedJournalClient(client);
                              setIsJournalOpen(true);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs flex items-center gap-1 border border-sky-200 shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Journal
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setSmsModalClient(client);
                          setIsSmsModalOpen(true);
                        }}
                        className="p-1.5 text-slate-600 hover:text-sky-600 rounded-lg border border-slate-200 bg-white"
                        title="SMS"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenEditClient(client)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 bg-white"
                        title="Rediger"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleClientActive(client)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isDeactivated 
                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' 
                            : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 border-slate-200 bg-white'
                        }`}
                        title={isDeactivated ? "Aktiver klient" : "Deaktiver klient"}
                      >
                        {isDeactivated ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop tabell */}
        <div className="hidden sm:block overflow-x-auto max-w-full">
          <table className="w-full text-left text-xs text-slate-600 min-w-[460px]">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Klient / Navn</th>
                <th className="py-3 px-3">Telefon</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    Ingen klienter funnet som matcher søket.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const displayName = canViewName ? client.displayName : `Klient #${client.customerNumber || 1000}`;
                  const displayPhone = canViewPhone ? (client.phone || 'Ikke oppgitt') : maskPersonalInfo(client.phone, 'phone');
                  const isDeactivated = client.isActive === false;

                  return (
                    <tr
                      key={client.uid}
                      className={`hover:bg-slate-50/80 transition-colors ${isDeactivated ? 'bg-slate-50/50 opacity-75' : ''}`}
                    >
                      {/* Navn & Kundenr */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold font-mono text-xs border border-sky-100 flex-shrink-0">
                            #{client.customerNumber || 1000}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">
                              {displayName}
                            </span>
                            {client.twoFactorEnabled && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                2FA
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Telefon */}
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {canViewPhone && client.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span>{client.phone}</span>
                          </div>
                        ) : (
                          <span className={canViewPhone ? "text-slate-400 italic" : "text-slate-500 font-mono"}>
                            {displayPhone}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {isDeactivated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            Deaktivert
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Aktiv
                          </span>
                        )}
                      </td>

                      {/* Handlinger */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEditJournals ? (
                            <button
                              onClick={() => {
                                if (onOpenJournal) {
                                  onOpenJournal(client.uid);
                                } else {
                                  setSelectedJournalClient(client);
                                  setIsJournalOpen(true);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs flex items-center gap-1 transition-colors border border-sky-200 shadow-xs"
                              title="Åpne journal og notater"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Journal
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Ingen innsyn</span>
                          )}

                          <button
                            onClick={() => {
                              setSmsModalClient(client);
                              setIsSmsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors border border-slate-200 bg-white"
                            title="Send SMS eller ombook time for klienten"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEditClient(client)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white"
                            title="Rediger klient"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleClientActive(client)}
                            className={`p-1.5 rounded-lg transition-colors border ${
                              isDeactivated 
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' 
                                : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 border-slate-200 bg-white'
                            }`}
                            title={isDeactivated ? "Aktiver klient" : "Deaktiver klient"}
                          >
                            {isDeactivated ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                          </button>

                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDeleteClient(client.uid, client.displayName)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 bg-white"
                              title="Slett klient"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Ny klient */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl space-y-3.5 max-h-[85dvh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-6">
            <button
              onClick={() => setIsNewClientModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">Opprett ny klient</h3>

            <form onSubmit={handleCreateClient} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Navn *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ola Nordmann"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">E-post *</label>
                <input
                  type="email"
                  required
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="ola@eksempel.no"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Mobiltelefon</label>
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="91234567"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="w-1/2 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  Opprett
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rediger klient */}
      {isEditClientOpen && editingClient && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-6">
            <button
              onClick={() => { setIsEditClientOpen(false); setEditingClient(null); }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-600" />
                <span>Rediger klient</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kundenummer: #{editingClient.customerNumber || 1000} {canViewName ? `(${editingClient.displayName})` : ''}
              </p>
            </div>

            {!canViewName && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Begrenset innsyn (GDPR)</span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Din brukerkonto har ikke innsyn i klientens personopplysninger (navn, e-post, telefon, adresse, fødselsdato). Disse feltene er låst for redigering for å beskytte personvernet. Du kan administrere faste notater og status.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveClient} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Navn *</label>
                  {!canViewName && (
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" /> Låst & skjult
                    </span>
                  )}
                </div>
                {canViewName ? (
                  <input
                    type="text"
                    required
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                ) : (
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={`Klient #${editingClient.customerNumber || 1000}`}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-500 font-mono cursor-not-allowed select-none"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase">E-post *</label>
                    {(!canViewEmail || !canViewName) && (
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" /> Låst & skjult
                      </span>
                    )}
                  </div>
                  {canViewEmail && canViewName ? (
                    <input
                      type="email"
                      required
                      value={editClientEmail}
                      onChange={(e) => setEditClientEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  ) : (
                    <input
                      type="text"
                      disabled
                      readOnly
                      value={maskPersonalInfo(editingClient.email, 'email')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-500 font-mono cursor-not-allowed select-none"
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase">Mobiltelefon</label>
                    {(!canViewPhone || !canViewName) && (
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" /> Låst & skjult
                      </span>
                    )}
                  </div>
                  {canViewPhone && canViewName ? (
                    <input
                      type="tel"
                      value={editClientPhone}
                      onChange={(e) => setEditClientPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  ) : (
                    <input
                      type="text"
                      disabled
                      readOnly
                      value={maskPersonalInfo(editingClient.phone, 'phone')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-500 font-mono cursor-not-allowed select-none"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase">Fødselsdato</label>
                    {!canViewName && (
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" /> Låst & skjult
                      </span>
                    )}
                  </div>
                  {canViewName ? (
                    <input
                      type="date"
                      value={editClientBirthDate}
                      onChange={(e) => setEditClientBirthDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  ) : (
                    <input
                      type="text"
                      disabled
                      readOnly
                      value="••••-••-••"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-500 font-mono cursor-not-allowed select-none"
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase">Adresse</label>
                    {!canViewName && (
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" /> Låst & skjult
                      </span>
                    )}
                  </div>
                  {canViewName ? (
                    <input
                      type="text"
                      value={editClientAddress}
                      onChange={(e) => setEditClientAddress(e.target.value)}
                      placeholder="Gateadresse, Poststed"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  ) : (
                    <input
                      type="text"
                      disabled
                      readOnly
                      value="••••••••••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-500 font-mono cursor-not-allowed select-none"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Faste klientnotater / info</label>
                <textarea
                  rows={2}
                  value={editClientNotes}
                  onChange={(e) => setEditClientNotes(e.target.value)}
                  placeholder="Faste notater eller allergier/info..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>



              {/* Aktiv / Deaktivert status */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Aktiv klient</p>
                  <p className="text-[11px] text-slate-500">Deaktiverte klienter kan ikke bestille nye timer.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editClientIsActive}
                    onChange={(e) => setEditClientIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsEditClientOpen(false); setEditingClient(null); }}
                  className="w-1/2 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
                >
                  Lagre endringer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Journal Modal */}
      {selectedJournalClient && (
        <JournalModal
          client={selectedJournalClient}
          isOpen={isJournalOpen}
          onClose={() => { setIsJournalOpen(false); setSelectedJournalClient(null); }}
        />
      )}

      {/* SMS & Timeombooking Modal */}
      {isSmsModalOpen && (
        <AppointmentSmsModal
          isOpen={isSmsModalOpen}
          onClose={() => {
            setIsSmsModalOpen(false);
            setSmsModalClient(null);
          }}
          client={smsModalClient}
          initialTab="delay"
          onAppointmentUpdated={() => {
            loadClients();
          }}
        />
      )}

    </div>
  );
};
