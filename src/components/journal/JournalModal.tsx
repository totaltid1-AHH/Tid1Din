import React, { useState, useEffect } from 'react';
import { 
  JournalEntry, 
  UserProfile, 
  JournalRevision,
  Appointment
} from '../../types';
import { dbService } from '../../services/db';
import { encryptData, decryptData } from '../../utils/crypto';
import { useAuth } from '../../context/AuthContext';
import { 
  FileText, 
  Lock, 
  History, 
  Plus, 
  Edit3, 
  Check, 
  X, 
  AlertCircle, 
  ShieldAlert, 
  Clock, 
  User,
  Calendar as CalendarIcon,
  Video,
  MapPin,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { AppointmentSmsModal } from '../appointments/AppointmentSmsModal';

interface JournalModalProps {
  client: UserProfile;
  appointment?: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
}

interface DecryptedEntry extends JournalEntry {
  decryptedContent: string;
}

export const JournalModal: React.FC<JournalModalProps> = ({ 
  client, 
  appointment, 
  isOpen, 
  onClose 
}) => {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  
  // Notatfelter
  const [noteContent, setNoteContent] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [sessionTime, setSessionTime] = useState<string>(format(new Date(), 'HH:mm'));

  const [selectedRevisionHistory, setSelectedRevisionHistory] = useState<JournalRevision[] | null>(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  const canEdit = currentUser?.role === 'hovedadmin' || 
    (currentUser?.role === 'admin' && currentUser.permissions?.canEditJournals);

  useEffect(() => {
    if (isOpen) {
      loadJournalsAndAppointments();
    }
  }, [isOpen, client.uid, appointment?.id]);

  const loadJournalsAndAppointments = async () => {
    setIsLoading(true);
    const [rawEntries, apts] = await Promise.all([
      dbService.getJournalsForClient(client.uid),
      dbService.getAppointmentsByClient(client.uid)
    ]);
    
    // Dekrypter hver journaloppføring
    const decryptedList: DecryptedEntry[] = await Promise.all(
      rawEntries.map(async (entry) => {
        const plain = await decryptData(entry.content);
        return { ...entry, decryptedContent: plain };
      })
    );

    // Sorter med nyeste dato først
    decryptedList.sort((a, b) => {
      const dateA = a.sessionDate ? `${a.sessionDate}T${a.sessionTime || '00:00'}` : a.createdAt;
      const dateB = b.sessionDate ? `${b.sessionDate}T${b.sessionTime || '00:00'}` : b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    setEntries(decryptedList);
    setClientAppointments(apts);

    // Hvis det ble sendt inn en spesifikk time (f.eks. fra kalender eller dashbord), forhåndsutfyll
    if (appointment) {
      setSelectedAppointmentId(appointment.id);
      setSessionDate(appointment.date);
      setSessionTime(appointment.startTime);
      setIsEditing(true);
    } else {
      setSelectedAppointmentId('');
      setSessionDate(format(new Date(), 'yyyy-MM-dd'));
      setSessionTime(format(new Date(), 'HH:mm'));
      setIsEditing(false);
    }

    setIsLoading(false);
  };

  const handleStartNew = () => {
    setEditingEntryId(null);
    setNoteContent('');
    setChangeNote('');
    if (appointment) {
      setSelectedAppointmentId(appointment.id);
      setSessionDate(appointment.date);
      setSessionTime(appointment.startTime);
    } else {
      setSelectedAppointmentId('');
      setSessionDate(format(new Date(), 'yyyy-MM-dd'));
      setSessionTime(format(new Date(), 'HH:mm'));
    }
    setIsEditing(true);
  };

  const handleStartEdit = (entry: DecryptedEntry) => {
    setEditingEntryId(entry.id);
    setNoteContent(entry.decryptedContent);
    setChangeNote('');
    setSelectedAppointmentId(entry.appointmentId || '');
    setSessionDate(entry.sessionDate || format(new Date(entry.createdAt), 'yyyy-MM-dd'));
    setSessionTime(entry.sessionTime || format(new Date(entry.createdAt), 'HH:mm'));
    setIsEditing(true);
  };

  const handleAppointmentSelect = (aptId: string) => {
    setSelectedAppointmentId(aptId);
    if (aptId) {
      const found = clientAppointments.find(a => a.id === aptId);
      if (found) {
        setSessionDate(found.date);
        setSessionTime(found.startTime);
      }
    }
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !currentUser) return;

    try {
      const encrypted = await encryptData(noteContent);
      const now = new Date().toISOString();

      if (editingEntryId) {
        // Redigerer eksisterende notat -> Legg til i revisjonshistorikk
        const existing = entries.find(e => e.id === editingEntryId);
        if (!existing) return;

        const newRevision: JournalRevision = {
          id: 'rev_' + Date.now(),
          timestamp: existing.updatedAt || existing.createdAt,
          modifiedBy: existing.lastModifiedBy,
          modifiedById: existing.lastModifiedById,
          previousContentPreview: existing.decryptedContent.slice(0, 150) + (existing.decryptedContent.length > 150 ? '...' : ''),
          changeNote: changeNote || 'Endring av journaltekst'
        };

        const updatedEntry: JournalEntry = {
          ...existing,
          content: encrypted,
          sessionDate: sessionDate || undefined,
          sessionTime: sessionTime || undefined,
          appointmentId: selectedAppointmentId || undefined,
          updatedAt: now,
          lastModifiedBy: currentUser.displayName,
          lastModifiedById: currentUser.uid,
          revisionHistory: [newRevision, ...(existing.revisionHistory || [])]
        };

        await dbService.saveJournalEntry(updatedEntry);

        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          'update_journal',
          `Redigerte journalnotat for klient #${client.customerNumber || client.displayName}`
        );
      } else {
        // Nytt journalnotat knyttet til timen med dato og klokkeslett
        const newEntry: JournalEntry = {
          id: 'jrn_' + Date.now(),
          clientId: client.uid,
          authorId: currentUser.uid,
          authorName: currentUser.displayName,
          authorRole: currentUser.role,
          content: encrypted,
          sessionDate: sessionDate || format(new Date(), 'yyyy-MM-dd'),
          sessionTime: sessionTime || format(new Date(), 'HH:mm'),
          appointmentId: selectedAppointmentId || undefined,
          createdAt: now,
          updatedAt: now,
          lastModifiedBy: currentUser.displayName,
          lastModifiedById: currentUser.uid,
          revisionHistory: []
        };

        await dbService.saveJournalEntry(newEntry);

        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          'create_journal',
          `Opprettet timenotat for klient #${client.customerNumber || client.displayName} for ${newEntry.sessionDate} kl. ${newEntry.sessionTime}`
        );
      }

      setIsEditing(false);
      setEditingEntryId(null);
      setNoteContent('');
      setChangeNote('');
      await loadJournalsAndAppointments();
    } catch (e: any) {
      alert('Feil ved lagring av journal: ' + e.message);
    }
  };

  if (!isOpen) return null;

  // Masker klientnavn hvis admin uten rettighet
  const displayName = (currentUser?.role === 'admin' && !currentUser.permissions?.canViewClientName)
    ? `Klient #${client.customerNumber || 1000}`
    : `${client.displayName} (#${client.customerNumber || 1000})`;

  // Organiser notater etter dato
  const groupedEntriesMap = new Map<string, DecryptedEntry[]>();
  entries.forEach((entry) => {
    const dateKey = entry.sessionDate || format(new Date(entry.createdAt), 'yyyy-MM-dd');
    if (!groupedEntriesMap.has(dateKey)) {
      groupedEntriesMap.set(dateKey, []);
    }
    groupedEntriesMap.get(dateKey)!.push(entry);
  });

  const sortedDateKeys = Array.from(groupedEntriesMap.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl lg:max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 p-4 sm:p-7 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">Kundejournal & Timenotater</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  Kryptert AES-256
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Klient: <strong className="text-slate-800">{displayName}</strong>
                {client.birthDate && <span className="ml-2 text-slate-400">&bull; Født: {client.birthDate}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSmsModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-1.5 border border-amber-200 transition-colors shadow-2xs cursor-pointer"
              title="Send SMS til klienten (f.eks. forsinkelse, timeflytting eller melding)"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Send SMS / Varsle</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Lukk"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Innhold / Liste over notater & Redigeringsfelt */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          
          {/* Knapp for nytt notat */}
          {canEdit && !isEditing && (
            <button
              onClick={handleStartNew}
              className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-sky-300 hover:border-sky-500 hover:bg-sky-50/50 text-sky-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Skriv nytt timenotat for denne timen</span>
            </button>
          )}

          {/* Romslig redigeringsfelt for PC/Mac */}
          {isEditing && (
            <div className="bg-sky-50/70 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-sky-300 space-y-4 shadow-sm animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-sky-200/80">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-sky-600" />
                    {editingEntryId ? 'Rediger journalnotat' : 'Skriv timenotat for klient'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Notatet knyttes til timen med dato og klokkeslett, og krypteres ved lagring.
                  </p>
                </div>
                <span className="text-xs text-slate-600">
                  Behandler: <strong className="text-slate-800">{currentUser?.displayName}</strong>
                </span>
              </div>

              {/* Time-knytning: dato, klokkeslett og eventuell tilknyttet avtale */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-sky-200 shadow-2xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Tilknyttet timeavtale
                  </label>
                  <select
                    value={selectedAppointmentId}
                    onChange={(e) => handleAppointmentSelect(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Ingen / Egendefinert tid --</option>
                    {clientAppointments.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        {apt.date} kl. {apt.startTime} ({apt.isOnline ? 'Online' : 'Fysisk'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Dato for timen *
                  </label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Klokkeslett for timen *
                  </label>
                  <input
                    type="time"
                    required
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Notatfelt med god plass på PC/Mac */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase mb-1.5">
                  Notatinnhold
                </label>
                <textarea
                  rows={8}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Skriv kliniske observasjoner fra timen, vurderinger, tiltak og plan for videre oppfølging..."
                  className="w-full p-4 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white min-h-[220px] leading-relaxed text-slate-800 placeholder:text-slate-400 font-normal"
                />
              </div>

              {editingEntryId && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Årsak til endring (for revisjonsspor):
                  </label>
                  <input
                    type="text"
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    placeholder="f.eks. Rettet skrivefeil, oppdatert plan..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 cursor-pointer transition-all"
                >
                  Lagre notat for timen
                </button>
              </div>
            </div>
          )}

          {/* Liste over notater organisert etter dato */}
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Laster krypterte journalnotater...
            </div>
          ) : sortedDateKeys.length === 0 ? (
            <div className="text-center py-14 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">Ingen notater registrert for denne klienten enda.</p>
              <p className="text-xs text-slate-400 mt-1">Trykk på «Skriv nytt timenotat» ovenfor for å registrere første notat.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDateKeys.map((dateKey) => {
                const dayEntries = groupedEntriesMap.get(dateKey) || [];
                let formattedDateTitle = dateKey;
                try {
                  formattedDateTitle = format(new Date(dateKey + 'T12:00:00'), 'EEEE d. MMMM yyyy', { locale: nb });
                } catch {}

                return (
                  <div key={dateKey} className="space-y-2.5">
                    {/* Dato-overskrift for enkel oversikt */}
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                      <span className="p-1 rounded bg-sky-100 text-sky-700">
                        <CalendarIcon className="w-3.5 h-3.5" />
                      </span>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 capitalize">
                        {formattedDateTitle}
                      </h4>
                      <span className="text-[11px] font-semibold text-slate-400">
                        ({dayEntries.length} {dayEntries.length === 1 ? 'notat' : 'notater'})
                      </span>
                    </div>

                    {/* Notater for denne datoen */}
                    <div className="space-y-2.5 pl-1 sm:pl-3">
                      {dayEntries.map((entry) => {
                        const timeDisplay = entry.sessionTime || format(new Date(entry.createdAt), 'HH:mm');
                        const matchedApt = entry.appointmentId ? clientAppointments.find(a => a.id === entry.appointmentId) : null;

                        return (
                          <div
                            key={entry.id}
                            className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all space-y-3"
                          >
                            {/* Topplinje for notatet: Tid, forfatter, møtetype og revisjon */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs text-slate-500">
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <span className="inline-flex items-center gap-1 font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                  <Clock className="w-3 h-3 text-sky-600" />
                                  kl. {timeDisplay}
                                </span>

                                <span className="flex items-center gap-1 text-slate-700 font-medium">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  {entry.authorName}
                                </span>

                                {matchedApt && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {matchedApt.isOnline ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                    <span>Tilknyttet time ({matchedApt.isOnline ? 'Online' : 'Oppmøte'})</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {entry.updatedAt !== entry.createdAt && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Endret {format(new Date(entry.updatedAt), 'd. MMM HH:mm', { locale: nb })}
                                  </span>
                                )}

                                {canEdit && (
                                  <button
                                    onClick={() => handleStartEdit(entry)}
                                    className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Rediger notat"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {entry.revisionHistory && entry.revisionHistory.length > 0 && (
                                  <button
                                    onClick={() => setSelectedRevisionHistory(entry.revisionHistory)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                                    title="Se revisjonsspor og historikk"
                                  >
                                    <History className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>({entry.revisionHistory.length})</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Notattekst (dekryptert) */}
                            <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed font-normal">
                              {entry.decryptedContent}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Modal for revisjonshistorikk */}
        {selectedRevisionHistory && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Revisjonsspor & Endringshistorikk
                </h4>
                <button
                  onClick={() => setSelectedRevisionHistory(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {selectedRevisionHistory.map((rev, idx) => (
                  <div key={rev.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Endret av {rev.modifiedBy}</span>
                      <span className="text-slate-500 font-normal">
                        {format(new Date(rev.timestamp), 'd. MMM yyyy HH:mm', { locale: nb })}
                      </span>
                    </div>
                    {rev.changeNote && (
                      <p className="text-[11px] text-indigo-700 font-medium bg-indigo-50/50 p-1.5 rounded">
                        Notat: {rev.changeNote}
                      </p>
                    )}
                    <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100 italic">
                      «{rev.previousContentPreview}»
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SMS & Timeombooking Modal */}
        {isSmsModalOpen && (
          <AppointmentSmsModal
            isOpen={isSmsModalOpen}
            onClose={() => setIsSmsModalOpen(false)}
            appointment={appointment || clientAppointments.find(a => a.id === selectedAppointmentId) || null}
            client={client}
            initialTab="delay"
            onAppointmentUpdated={() => {
              loadJournalsAndAppointments();
            }}
          />
        )}

      </div>
    </div>
  );
};
