import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dbService } from '../../services/db';
import { UserProfile } from '../../types';
import { maskPersonalInfo } from '../../utils/crypto';
import { JournalModal } from '../journal/JournalModal';
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
  ShieldCheck 
} from 'lucide-react';

export const ClientListView: React.FC = () => {
  const { currentUser, registerClient } = useAuth();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJournalClient, setSelectedJournalClient] = useState<UserProfile | null>(null);
  const [isJournalOpen, setIsJournalOpen] = useState(false);

  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientBirthDate, setNewClientBirthDate] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
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

      {/* Rutenett - full bredde på mobil */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 w-full">
        {filteredClients.map((client) => {
          const displayName = canViewName ? client.displayName : `Klient #${client.customerNumber || 1000}`;
          const displayPhone = canViewPhone ? (client.phone || 'Ikke oppgitt') : maskPersonalInfo(client.phone, 'phone');
          const displayEmail = canViewEmail ? client.email : maskPersonalInfo(client.email, 'email');

          return (
            <div
              key={client.uid}
              className="bg-white rounded-none sm:rounded-2xl border-y sm:border border-slate-200 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between space-y-3 w-full"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold font-mono text-xs">
                    #{client.customerNumber || 1000}
                  </span>
                  {client.twoFactorEnabled && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      2FA
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <h3 className="font-bold text-slate-900 text-sm">{displayName}</h3>
                  <div className="space-y-1 mt-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{displayPhone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{displayEmail}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                {canEditJournals ? (
                  <button
                    onClick={() => {
                      setSelectedJournalClient(client);
                      setIsJournalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-xs font-semibold flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Journal
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic">Ingen innsyn</span>
                )}

                {isSuperAdmin && (
                  <button
                    onClick={() => handleDeleteClient(client.uid, client.displayName)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    title="Slett"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

            </div>
          );
        })}
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

      {/* Journal Modal */}
      {selectedJournalClient && (
        <JournalModal
          client={selectedJournalClient}
          isOpen={isJournalOpen}
          onClose={() => { setIsJournalOpen(false); setSelectedJournalClient(null); }}
        />
      )}

    </div>
  );
};
