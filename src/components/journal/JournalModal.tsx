import React, { useState, useEffect } from 'react';
import { 
  JournalEntry, 
  UserProfile, 
  JournalRevision 
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
  User 
} from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface JournalModalProps {
  client: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

interface DecryptedEntry extends JournalEntry {
  decryptedContent: string;
}

export const JournalModal: React.FC<JournalModalProps> = ({ client, isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [selectedRevisionHistory, setSelectedRevisionHistory] = useState<JournalRevision[] | null>(null);

  const canEdit = currentUser?.role === 'hovedadmin' || 
    (currentUser?.role === 'admin' && currentUser.permissions?.canEditJournals);

  useEffect(() => {
    if (isOpen) {
      loadJournals();
    }
  }, [isOpen, client.uid]);

  const loadJournals = async () => {
    setIsLoading(true);
    const rawEntries = await dbService.getJournalsForClient(client.uid);
    
    // Dekrypter hver journaloppføring
    const decryptedList: DecryptedEntry[] = await Promise.all(
      rawEntries.map(async (entry) => {
        const plain = await decryptData(entry.content);
        return { ...entry, decryptedContent: plain };
      })
    );

    // Sorter med nyeste først
    decryptedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setEntries(decryptedList);
    setIsLoading(false);
  };

  const handleStartNew = () => {
    setEditingEntryId(null);
    setNoteContent('');
    setChangeNote('');
    setIsEditing(true);
  };

  const handleStartEdit = (entry: DecryptedEntry) => {
    setEditingEntryId(entry.id);
    setNoteContent(entry.decryptedContent);
    setChangeNote('');
    setIsEditing(true);
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
        // Nytt journalnotat
        const newEntry: JournalEntry = {
          id: 'jrn_' + Date.now(),
          clientId: client.uid,
          authorId: currentUser.uid,
          authorName: currentUser.displayName,
          authorRole: currentUser.role,
          content: encrypted,
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
          `Opprettet nytt journalnotat for klient #${client.customerNumber || client.displayName}`
        );
      }

      setIsEditing(false);
      setEditingEntryId(null);
      setNoteContent('');
      setChangeNote('');
      await loadJournals();
    } catch (e: any) {
      alert('Feil ved lagring av journal: ' + e.message);
    }
  };

  if (!isOpen) return null;

  // Masker klientnavn hvis admin uten rettighet
  const displayName = (currentUser?.role === 'admin' && !currentUser.permissions?.canViewClientName)
    ? `Klient #${client.customerNumber || 1000}`
    : `${client.displayName} (#${client.customerNumber || 1000})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Kundejournal</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  Kryptert AES-256
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Journal for: <strong className="text-slate-800">{displayName}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Innhold / Liste */}
        <div className="flex-1 overflow-y-auto py-5 space-y-4 pr-1">
          
          {/* Handlingsknapp for nytt notat */}
          {canEdit && !isEditing && (
            <button
              onClick={handleStartNew}
              className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-sky-300 hover:border-sky-500 hover:bg-sky-50/50 text-sky-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              Skriv nytt journalnotat
            </button>
          )}

          {/* Redigeringsform */}
          {isEditing && (
            <div className="bg-sky-50/60 p-5 rounded-2xl border border-sky-200 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-900">
                  {editingEntryId ? 'Rediger journalnotat' : 'Nytt journalnotat'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Forfatter: <strong className="text-slate-700">{currentUser?.displayName}</strong>
                </span>
              </div>

              <textarea
                rows={5}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Skriv kliniske observasjoner, behandlingsnotat, vurdering eller oppfølgingsplan..."
                className="w-full p-3.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
              />

              {editingEntryId && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Årsak til endring (for revisjonsspor):
                  </label>
                  <input
                    type="text"
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    placeholder="f.eks. Rettet oppfølgingsdato, utfyllende observasjoner..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20"
                >
                  Lagre kryptert notat
                </button>
              </div>
            </div>
          )}

          {/* Notatliste */}
          {isLoading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Laster kryptert journal...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Ingen journalnotater registrert for denne klienten enda.</p>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition-all space-y-3"
              >
                {/* Notat-metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {format(new Date(entry.createdAt), "d. MMMM yyyy 'kl.' HH:mm", { locale: nb })}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-sky-700">
                      <User className="w-3.5 h-3.5 text-sky-600" />
                      Skrevet av: {entry.authorName} ({entry.authorRole})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {entry.updatedAt !== entry.createdAt && (
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Endret {format(new Date(entry.updatedAt), 'd. MMM HH:mm', { locale: nb })} av {entry.lastModifiedBy}
                      </span>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => handleStartEdit(entry)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100"
                        title="Rediger notat"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {entry.revisionHistory && entry.revisionHistory.length > 0 && (
                      <button
                        onClick={() => setSelectedRevisionHistory(entry.revisionHistory)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 flex items-center gap-1 text-[11px] font-semibold"
                        title="Se revisjonsspor og historikk"
                      >
                        <History className="w-3.5 h-3.5 text-indigo-500" />
                        <span>({entry.revisionHistory.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Notattekst (dekryptert visning) */}
                <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed pl-1 font-normal">
                  {entry.decryptedContent}
                </div>
              </div>
            ))
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
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
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

      </div>
    </div>
  );
};
