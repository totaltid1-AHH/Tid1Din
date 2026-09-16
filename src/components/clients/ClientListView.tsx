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
  Mail, 
  MapPin, 
  Trash2, 
  X, 
  ShieldCheck,
  Edit2,
  Calendar,
  UserCheck,
  UserX,
  MessageSquare
} from 'lucide-react';

export const ClientListView: React.FC = () => {
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

  const canViewName = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canViewClientName !== false;
  const canViewPhone = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canViewClientPhone !== false;
  const canViewEmail = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canViewClientEmail !== false;
  const canEditJournals = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canEditJournals !== false;
  const isSuperAdmin = currentUser?.role === 'hovedadmin';

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
    setEditClientName(client.displayName);
    setEditClientEmail(client.email);
    setEditClientPhone(client.phone || '');
    setEditClientAddress(client.address || '');
    setEditClientBirthDate(client.birthDate || '');
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
        displayName: editClientName.trim(),
        email: editClientEmail.trim(),
        phone: editClientPhone.trim(),
        address: editClientAddress.trim(),
        birthDate: editClientBirthDate.trim(),
        notes: editClientNotes.trim(),
        isActive: editClientIsActive
      };

      await dbService.saveUser(updatedUser);
      setClients(prev => prev.map(c => c.uid === editingClient.uid ? updatedUser : c));
      setIsEditClientOpen(false);
      setEditingClient(null);
      setFeedbackMessage(`Endringer for ${updatedUser.displayName} ble lagret!`);
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
      setFeedbackMessage(
        newActiveState
          ? `Klient #${client.customerNumber || 1000} (${client.displayName}) er nå aktivert!`
          : `Klient #${client.customerNumber || 1000} (${client.displayName}) er nå deaktivert!`
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
    <div className="space-y-2.5 sm:space-y-5 w-full">
      
      {/* Header */}
      <div className="bg-white p-3 sm:p-5 rounded-none sm:rounded-2xl border-y sm:border border-slate-200 shadow-xs flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap w-full">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
            <Users className="w-5 h-5 text-sky-600" />
            Klienter & Journaler
          </h1>
          <p className="text-[11px] text-slate-500">Kundenummer starter på 1000.</p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setIsNewClientModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs flex-shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Ny klient
          </button>
        )}
      </div>

      {/* Søk */}
      <div className="bg-white p-3 rounded-none sm:rounded-2xl border-y sm:border border-slate-200 shadow-xs flex items-center gap-2 w-full">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Søk kundenr (#1000), navn, telefon..."
          className="w-full min-w-0 flex-1 text-xs sm:text-sm outline-none text-slate-800 placeholder:text-slate-400"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-[11px] text-slate-400 flex-shrink-0">
            Nullstill
          </button>
        )}
      </div>

      {feedbackMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-xl font-medium flex items-center justify-between shadow-xs">
          <span>{feedbackMessage}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Kolonnebasert tabellvisning for klienter */}
      <div className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left text-xs text-slate-600 min-w-[760px]">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Klient / Navn</th>
                <th className="py-3 px-3">Telefon</th>
                <th className="py-3 px-3">E-post</th>
                <th className="py-3 px-3">Fødselsdato & Adresse</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    Ingen klienter funnet som matcher søket.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const displayName = canViewName ? client.displayName : `Klient #${client.customerNumber || 1000}`;
                  const displayPhone = canViewPhone ? (client.phone || 'Ikke oppgitt') : maskPersonalInfo(client.phone, 'phone');
                  const displayEmail = canViewEmail ? client.email : maskPersonalInfo(client.email, 'email');
                  const isDeactivated = client.isActive === false;

                  return (
                    <tr
                      key={client.uid}
                      onClick={() => {
                        if (canEditJournals) {
                          setSelectedJournalClient(client);
                          setIsJournalOpen(true);
                        }
                      }}
                      className={`hover:bg-sky-50/60 transition-colors cursor-pointer ${isDeactivated ? 'bg-slate-50/50 opacity-75' : ''}`}
                      title={canEditJournals ? "Trykk for å se tidligere notater og skrive timejournal" : undefined}
                    >
                      {/* Navn & Kundenr */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold font-mono text-xs border border-sky-100 flex-shrink-0">
                            #{client.customerNumber || 1000}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm hover:text-sky-700 transition-colors">
                                {displayName}
                              </span>
                              {client.twoFactorEnabled && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                  2FA
                                </span>
                              )}
                            </div>
                            {canEditJournals && (
                              <span className="text-[10px] text-sky-600 flex items-center gap-1 font-medium mt-0.5">
                                <FileText className="w-2.5 h-2.5" />
                                Klikk for å se notater & skrive journal
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

                      {/* E-post */}
                      <td className="py-3 px-3 text-slate-700">
                        {canViewEmail && client.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate max-w-[160px] inline-block" title={client.email}>
                              {client.email}
                            </span>
                          </div>
                        ) : (
                          <span className={canViewEmail ? "text-slate-400 italic" : "text-slate-500 font-mono"}>
                            {displayEmail}
                          </span>
                        )}
                      </td>

                      {/* Fødselsdato & Adresse */}
                      <td className="py-3 px-3 text-slate-600">
                        <div>
                          {client.birthDate ? (
                            <span className="font-mono text-[11px] block text-slate-700">{client.birthDate}</span>
                          ) : null}
                          {client.address ? (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate max-w-[140px]">{client.address}</span>
                            </span>
                          ) : null}
                          {!client.birthDate && !client.address && (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </div>
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
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {canEditJournals ? (
                            <button
                              onClick={() => {
                                setSelectedJournalClient(client);
                                setIsJournalOpen(true);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-2xl p-5 sm:p-6 shadow-2xl space-y-3.5">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setIsEditClientOpen(false); setEditingClient(null); }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-600" />
                Rediger klient
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kundenummer: #{editingClient.customerNumber || 1000}
              </p>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Navn *</label>
                <input
                  type="text"
                  required
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">E-post *</label>
                  <input
                    type="email"
                    required
                    value={editClientEmail}
                    onChange={(e) => setEditClientEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Mobiltelefon</label>
                  <input
                    type="tel"
                    value={editClientPhone}
                    onChange={(e) => setEditClientPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Fødselsdato</label>
                  <input
                    type="date"
                    value={editClientBirthDate}
                    onChange={(e) => setEditClientBirthDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Adresse</label>
                  <input
                    type="text"
                    value={editClientAddress}
                    onChange={(e) => setEditClientAddress(e.target.value)}
                    placeholder="Gateadresse, Poststed"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
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
        />
      )}

    </div>
  );
};
