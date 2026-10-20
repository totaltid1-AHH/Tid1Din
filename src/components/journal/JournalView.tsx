import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  JournalEntry, 
  UserProfile, 
  JournalRevision,
  Appointment 
} from '../../types';
import { dbService } from '../../services/db';
import { encryptData, decryptData, maskPersonalInfo } from '../../utils/crypto';
import { useAuth } from '../../context/AuthContext';
import { jsPDF } from 'jspdf';
import { 
  BookOpen, 
  Lock, 
  History, 
  Plus, 
  Edit3, 
  X, 
  Clock, 
  User, 
  Calendar as CalendarIcon, 
  Video, 
  MapPin, 
  CheckCircle2, 
  MessageSquare,
  Search,
  ChevronDown,
  Printer,
  Sparkles,
  CalendarPlus,
  ArrowUpDown,
  CalendarDays,
  FileCheck2,
  Maximize2,
  Minimize2,
  Download,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { nb } from 'date-fns/locale';
import { AppointmentSmsModal } from '../appointments/AppointmentSmsModal';
import { generateTimeOptions, isValidTimeString } from '../../utils/calendar';
import { smsService } from '../../services/sms';

interface JournalViewProps {
  initialClientId?: string | null;
  onNavigateToCalendar?: (date?: string) => void;
}

interface DecryptedEntry extends JournalEntry {
  decryptedContent: string;
}

// Hurtigmaler for timenotater
const JOURNAL_TEMPLATES = [
  {
    id: 'soap',
    title: 'SOAP (Klinisk standard)',
    description: 'Subjektivt, Objektivt, Analyse og Plan',
    content: `## Subjektivt (S)
- Klientens egne opplevelser og tilbakemeldinger:

## Objektivt (O)
- Kliniske observasjoner, affekt og fremtoning:

## Analyse & Vurdering (A)
- Vurdering av tilstand og respons på tiltak:

## Plan (P)
- Tiltak frem mot neste time og hjemmeoppgaver:`
  },
  {
    id: 'oppfolging',
    title: 'Oppfølgingssamtale',
    description: 'Tema, respons og videre tiltak',
    content: `## Tema for samtalen
- 

## Observasjoner & respons
- 

## Tiltak og avtaler videre
- `
  },
  {
    id: 'anamnese',
    title: 'Anamnese / Førstegangssamtale',
    description: 'Bakgrunn, situasjon, mål og rammer',
    content: `## Henvendelsesårsak & bakgrunn
- 

## Nåværende livssituasjon & symptombilde
- 

## Klientens målsetting for forløpet
- 

## Foreløpig ramme og plan
- `
  },
  {
    id: 'kort',
    title: 'Kort notat',
    description: 'Enkel bekreftelse og oppsummering',
    content: `## Samtalenotat
Time gjennomført som avtalt. God kontakt og positiv respons.`
  }
];

// Hjelpefunksjon: Legg til minutter til klokkeslett (f.eks. "14:00" + 45 -> "14:45")
function calculateEndTime(startTime: string, minutesToAdd: number = 45): string {
  if (!startTime || !startTime.includes(':')) return '12:45';
  const [h, m] = startTime.split(':').map(Number);
  const total = (h * 60 + m + minutesToAdd) % (24 * 60);
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// Sikker datoformatering som unngår krasj ved ugyldige tidsverdier eller uventede formater
function safeFormatDate(value: any, pattern: string, fallback: string = ''): string {
  try {
    if (!value) return fallback;
    const d = new Date(value);
    if (isNaN(d.getTime())) return fallback;
    return format(d, pattern, { locale: nb });
  } catch {
    return fallback;
  }
}

export const JournalView: React.FC<JournalViewProps> = ({ 
  initialClientId,
  onNavigateToCalendar 
}) => {
  const { currentUser } = useAuth();
  
  // Klienter og aktiv klient
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Data for valgt klient
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redigering og skriving av notat
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [sessionTime, setSessionTime] = useState<string>(format(new Date(), 'HH:mm'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Fokusmodus / Fullskjermsskriving
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isTemplatesDropdownOpen, setIsTemplatesDropdownOpen] = useState(false);

  // Avtal neste time samtidig (Forslag 2 & Spørsmål 2: standard 45 min slutt-tid)
  const [shouldBookNext, setShouldBookNext] = useState(false);
  const [sendNextAptSms, setSendNextAptSms] = useState(true);
  const [nextDate, setNextDate] = useState<string>(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [nextStartTime, setNextStartTime] = useState<string>('12:00');
  const [nextEndTime, setNextEndTime] = useState<string>('12:45');
  const [nextIsOnline, setNextIsOnline] = useState(false);
  const [nextNotes, setNextNotes] = useState('');

  // Ny frittstående samtaletime-modal
  const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);
  const [newAptSendSms, setNewAptSendSms] = useState(true);
  const [newAptDate, setNewAptDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [newAptTime, setNewAptTime] = useState<string>('12:00');
  const [newAptEndTime, setNewAptEndTime] = useState<string>('12:45');
  const [newAptIsOnline, setNewAptIsOnline] = useState<boolean>(false);
  const [newAptNotes, setNewAptNotes] = useState<string>('');

  // Sortering og søk i journal
  const [journalSearchQuery, setJournalSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [mobileTab, setMobileTab] = useState<'notes' | 'sessions'>('notes');

  // Synkronisert scrolling & tidslinje
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
  const journalScrollContainerRef = useRef<HTMLDivElement>(null);
  const sessionListContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const noteRefs = useRef<Map<string, HTMLElement>>(new Map());
  const sessionItemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Historikk & SMS modal
  const [selectedRevisionHistory, setSelectedRevisionHistory] = useState<JournalRevision[] | null>(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  const canEdit = currentUser?.role === 'hovedadmin' || 
    (currentUser?.role === 'admin' && currentUser.permissions?.canEditJournals !== false);
  const canViewName = currentUser?.role === 'hovedadmin' || currentUser?.permissions?.canViewClientName !== false;

  // 1. Last inn klienter
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const users = await dbService.getUsers();
      const clientList = users.filter(u => u.role === 'client');
      setClients(clientList);

      if (clientList.length > 0) {
        if (initialClientId) {
          const found = clientList.find(c => c.uid === initialClientId);
          setSelectedClient(found || clientList[0]);
        } else if (!selectedClient) {
          setSelectedClient(clientList[0]);
        }
      } else {
        setIsLoading(false);
      }
    } catch (e) {
      console.error('Feil ved innlasting av klienter:', e);
      setIsLoading(false);
    }
  };

  // 2. Hvis initialClientId endres utenfra, oppdater valgt klient
  useEffect(() => {
    if (initialClientId && clients.length > 0) {
      const found = clients.find(c => c.uid === initialClientId);
      if (found) setSelectedClient(found);
    }
  }, [initialClientId, clients]);

  // 3. Last inn journaler og timer når klient endres
  useEffect(() => {
    if (selectedClient) {
      loadJournalsAndAppointments(selectedClient.uid);
    }
  }, [selectedClient?.uid]);

  const loadJournalsAndAppointments = async (clientId: string) => {
    setIsLoading(true);
    try {
      const [rawEntries, apts] = await Promise.all([
        dbService.getJournalsForClient(clientId),
        dbService.getAppointmentsByClient(clientId)
      ]);

      const decryptedList: DecryptedEntry[] = await Promise.all(
        rawEntries.map(async (entry) => {
          const plain = await decryptData(entry.content);
          return { ...entry, decryptedContent: plain };
        })
      );

      decryptedList.sort((a, b) => {
        const dateA = a.sessionDate ? `${a.sessionDate}T${a.sessionTime || '00:00'}` : a.createdAt;
        const dateB = b.sessionDate ? `${b.sessionDate}T${b.sessionTime || '00:00'}` : b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      apts.sort((a, b) => {
        const dateA = `${a.date}T${a.startTime}`;
        const dateB = `${b.date}T${b.startTime}`;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setEntries(decryptedList);
      setAppointments(apts);

      setIsComposerOpen(false);
      setEditingEntryId(null);
      setNoteContent('');
      setChangeNote('');
      setSelectedAppointmentId('');
      setShouldBookNext(false);
    } catch (e) {
      console.error('Feil ved lasting av journal:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrerte notater basert på søkeord og sortering
  const filteredAndSortedEntries = useMemo(() => {
    let list = [...entries];

    if (journalSearchQuery.trim()) {
      const q = journalSearchQuery.toLowerCase();
      list = list.filter(e => 
        e.decryptedContent.toLowerCase().includes(q) ||
        (e.sessionDate && e.sessionDate.includes(q)) ||
        (e.authorName && e.authorName.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      const dateA = a.sessionDate ? `${a.sessionDate}T${a.sessionTime || '00:00'}` : a.createdAt;
      const dateB = b.sessionDate ? `${b.sessionDate}T${b.sessionTime || '00:00'}` : b.createdAt;
      const diff = new Date(dateB).getTime() - new Date(dateA).getTime();
      return sortOrder === 'desc' ? diff : -diff;
    });

    return list;
  }, [entries, journalSearchQuery, sortOrder]);

  // Tidslinjeliste over samtaletimer
  const timelineSessions = useMemo(() => {
    const sessionMap = new Map<string, {
      key: string;
      appointment?: Appointment;
      entry?: DecryptedEntry;
      date: string;
      time: string;
      title: string;
      hasNote: boolean;
    }>();

    appointments.forEach(apt => {
      const key = `apt_${apt.id}`;
      const matchedEntry = entries.find(e => e.appointmentId === apt.id);
      sessionMap.set(key, {
        key,
        appointment: apt,
        entry: matchedEntry,
        date: apt.date,
        time: apt.startTime,
        title: `Samtaletime (${apt.isOnline ? 'Online' : 'Oppmøte'})`,
        hasNote: !!matchedEntry
      });
    });

    entries.forEach(entry => {
      const linkedApt = entry.appointmentId ? appointments.find(a => a.id === entry.appointmentId) : null;
      if (!linkedApt) {
        const d = entry.sessionDate || safeFormatDate(entry.createdAt, 'yyyy-MM-dd');
        const t = entry.sessionTime || safeFormatDate(entry.createdAt, 'HH:mm');
        const key = `entry_${entry.id}`;
        sessionMap.set(key, {
          key,
          entry,
          date: d,
          time: t,
          title: 'Journalnotat',
          hasNote: true
        });
      }
    });

    const list = Array.from(sessionMap.values());
    list.sort((a, b) => {
      const dateA = `${a.date}T${a.time}`;
      const dateB = `${b.date}T${b.time}`;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return list;
  }, [appointments, entries]);

  // Synkronisert scrolling mellom høyre journal og venstre samtaletimer
  useEffect(() => {
    const container = journalScrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      const containerRect = container.getBoundingClientRect();
      const containerTop = containerRect.top;

      let closestSessionKey: string | null = null;
      let minDistance = Infinity;

      noteRefs.current.forEach((el, sessionKey) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.top - (containerTop + 80));
        if (dist < minDistance) {
          minDistance = dist;
          closestSessionKey = sessionKey;
        }
      });

      if (closestSessionKey && closestSessionKey !== activeSessionKey) {
        setActiveSessionKey(closestSessionKey);

        const sessionEl = sessionItemRefs.current.get(closestSessionKey);
        if (sessionEl) {
          sessionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeSessionKey, timelineSessions]);

  const handleSelectTimelineSession = (sessionKey: string, apt?: Appointment, entry?: DecryptedEntry) => {
    setActiveSessionKey(sessionKey);
    setMobileTab('notes');

    if (entry) {
      setTimeout(() => {
        const targetEl = noteRefs.current.get(sessionKey);
        if (targetEl && journalScrollContainerRef.current) {
          isProgrammaticScrollRef.current = true;
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => {
            isProgrammaticScrollRef.current = false;
          }, 600);
        }
      }, 50);
    } else if (apt) {
      handleStartNewForAppointment(apt);
    }
  };

  const handleStartNew = () => {
    if (!selectedClient) return;
    setMobileTab('notes');
    setEditingEntryId(null);
    setNoteContent('');
    setChangeNote('');
    setSelectedAppointmentId('');
    const nowTime = format(new Date(), 'HH:mm');
    setSessionDate(format(new Date(), 'yyyy-MM-dd'));
    setSessionTime(nowTime);

    // Initialiser neste time 1 uke frem i tid med starttid + 45 min
    setShouldBookNext(false);
    setNextDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setNextStartTime(nowTime);
    setNextEndTime(calculateEndTime(nowTime, 45));

    setIsComposerOpen(true);

    if (journalScrollContainerRef.current) {
      journalScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStartNewForAppointment = (apt: Appointment) => {
    setEditingEntryId(null);
    setNoteContent('');
    setChangeNote('');
    setSelectedAppointmentId(apt.id);
    setSessionDate(apt.date);
    setSessionTime(apt.startTime);

    // Forhåndsutfyll neste time om 1 uke
    setShouldBookNext(false);
    try {
      const aptDateObj = new Date(apt.date + 'T12:00:00');
      setNextDate(format(addDays(aptDateObj, 7), 'yyyy-MM-dd'));
    } catch {
      setNextDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    }
    setNextStartTime(apt.startTime);
    setNextEndTime(calculateEndTime(apt.startTime, 45));

    setIsComposerOpen(true);

    if (journalScrollContainerRef.current) {
      journalScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStartEdit = (entry: DecryptedEntry) => {
    setEditingEntryId(entry.id);
    setNoteContent(entry.decryptedContent);
    setChangeNote('');
    setSelectedAppointmentId(entry.appointmentId || '');
    setSessionDate(entry.sessionDate || safeFormatDate(entry.createdAt, 'yyyy-MM-dd'));
    setSessionTime(entry.sessionTime || safeFormatDate(entry.createdAt, 'HH:mm'));
    setShouldBookNext(false);
    setIsComposerOpen(true);

    if (journalScrollContainerRef.current) {
      journalScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Formatering i tekstfeltet (Fet, Kursiv, Overskrifter, Lister)
  const handleFormat = (prefix: string, suffix: string = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selectedText = text.substring(start, end);
    const replacement = `${prefix}${selectedText || 'tekst'}${suffix}`;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setNoteContent(newText);
    setTimeout(() => {
      el.focus();
      const newCursorPos = start + prefix.length + (selectedText ? selectedText.length : 5);
      el.setSelectionRange(start + prefix.length, newCursorPos);
    }, 0);
  };

  const handleInsertPrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const text = el.value;
    // Sjekk om det er linjestart
    const needsNewline = start > 0 && text[start - 1] !== '\n';
    const insertion = (needsNewline ? '\n' : '') + prefix;
    const newText = text.substring(0, start) + insertion + text.substring(start);
    setNoteContent(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  const handleApplyTemplate = (templateContent: string) => {
    if (noteContent.trim()) {
      if (confirm('Vil du legge til malen i eksisterende notat? (Trykk Avbryt for å erstatte hele teksten)')) {
        setNoteContent(prev => prev + '\n\n' + templateContent);
      } else {
        setNoteContent(templateContent);
      }
    } else {
      setNoteContent(templateContent);
    }
    setIsTemplatesDropdownOpen(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Tastatursnarveier i skrivefeltet (Ctrl+B / Cmd+B for fet, Ctrl+I / Cmd+I for kursiv)
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      handleFormat('**', '**');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      handleFormat('*', '*');
    }
  };

  // Lagre notat og eventuelt neste time samtidig
  const handleSaveNote = async () => {
    if (!noteContent.trim() || !currentUser || !selectedClient) return;

    setIsSubmitting(true);
    try {
      const encrypted = await encryptData(noteContent);
      const now = new Date().toISOString();

      if (editingEntryId) {
        const existing = entries.find(e => e.id === editingEntryId);
        if (!existing) return;

        const newRevision: JournalRevision = {
          id: 'rev_' + Date.now(),
          timestamp: existing.updatedAt || existing.createdAt,
          modifiedBy: existing.lastModifiedBy,
          modifiedById: existing.lastModifiedById,
          previousContentPreview: existing.decryptedContent.slice(0, 150) + (existing.decryptedContent.length > 150 ? '...' : ''),
          changeNote: changeNote || 'Oppdatering av journaltekst'
        };

        const updatedEntry: JournalEntry = {
          ...existing,
          content: encrypted,
          sessionDate: existing.sessionDate || sessionDate || undefined,
          sessionTime: existing.sessionTime || sessionTime || undefined,
          appointmentId: existing.appointmentId || selectedAppointmentId || undefined,
          updatedAt: now,
          lastModifiedBy: currentUser.displayName,
          lastModifiedById: currentUser.uid,
          revisionHistory: [newRevision, ...(existing.revisionHistory || [])]
        };

        await dbService.saveJournalEntry(updatedEntry);

        await dbService.logAction(
          { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
          'update_journal',
          `Oppdaterte journalnotat for klient #${selectedClient.customerNumber || selectedClient.displayName}`
        );

        setSaveFeedback('Journalnotat ble oppdatert og kryptert!');
      } else {
        const newEntry: JournalEntry = {
          id: 'jrn_' + Date.now(),
          clientId: selectedClient.uid,
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
          `Opprettet journalnotat for klient #${selectedClient.customerNumber || selectedClient.displayName} den ${newEntry.sessionDate} kl. ${newEntry.sessionTime}`
        );

        // Hvis "Avtal neste time samtidig" er valgt
        if (shouldBookNext && nextDate && nextStartTime) {
          const nowObj = new Date();
          const nextTarget = new Date(`${nextDate}T${nextStartTime}`);
          if (nextTarget < nowObj) {
            alert('Det er ikke mulig å avtale neste time tilbake i tid. Vennligst velg en fremtidig dato og tid.');
            setIsSubmitting(false);
            return;
          }

          const nextApt: Appointment = {
            id: 'apt_' + Date.now(),
            clientId: selectedClient.uid,
            clientNumber: selectedClient.customerNumber || 1000,
            clientName: selectedClient.displayName,
            clientPhone: selectedClient.phone || '',
            clientEmail: selectedClient.email || '',
            therapistId: currentUser.uid,
            therapistName: currentUser.displayName,
            date: nextDate,
            startTime: nextStartTime,
            endTime: nextEndTime || calculateEndTime(nextStartTime, 45),
            durationMinutes: 45,
            slotType: 'single',
            price: 950,
            isOnline: nextIsOnline,
            status: 'confirmed',
            notes: nextNotes || 'Avtalt ved avslutning av forrige samtale',
            createdAt: now
          };

          await dbService.saveAppointment(nextApt);

          // Send SMS bekreftelse dersom avhuket
          if (sendNextAptSms) {
            try {
              await Promise.race([
                smsService.sendBookingConfirmation(nextApt),
                new Promise<null>((_, reject) => setTimeout(() => reject(new Error('SMS timeout')), 3500))
              ]);
            } catch (err) {
              console.warn('SMS-sending feilet:', err);
            }
          }

          await dbService.logAction(
            { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
            'create_appointment',
            `Avtalte neste time for ${selectedClient.displayName} den ${nextApt.date} kl. ${nextApt.startTime}`
          );

          setSaveFeedback(`Journalnotat lagret & neste time er avtalt for ${safeFormatDate(nextDate + 'T12:00:00', 'd. MMMM', nextDate)} kl. ${nextStartTime}!${sendNextAptSms ? ' (Bekreftelse sendt)' : ''}`);
        } else {
          setSaveFeedback('Nytt journalnotat ble lagret og kryptert!');
        }
      }

      setIsComposerOpen(false);
      setIsFocusMode(false);
      setEditingEntryId(null);
      setNoteContent('');
      setChangeNote('');
      setShouldBookNext(false);
      await loadJournalsAndAppointments(selectedClient.uid);
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (e: any) {
      alert('Feil ved lagring av journalnotat: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Opprett ny avtalt samtaletime (start + standard 45 min slutt)
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !currentUser) return;

    if (!isValidTimeString(newAptTime)) {
      alert('Vennligst oppgi et gyldig klokkeslett (00:00–23:59).');
      return;
    }

    const nowObj = new Date();
    const targetDate = new Date(`${newAptDate}T${newAptTime}`);
    if (targetDate < nowObj) {
      alert('Det er ikke mulig å opprette avtaler tilbake i tid. Vennligst velg en fremtidig dato og tid.');
      return;
    }

    try {
      const finalEndTime = newAptEndTime || calculateEndTime(newAptTime, 45);

      const newAppointment: Appointment = {
        id: 'apt_' + Date.now(),
        clientId: selectedClient.uid,
        clientNumber: selectedClient.customerNumber || 1000,
        clientName: selectedClient.displayName,
        clientPhone: selectedClient.phone || '',
        clientEmail: selectedClient.email || '',
        therapistId: currentUser.uid,
        therapistName: currentUser.displayName,
        date: newAptDate,
        startTime: newAptTime,
        endTime: finalEndTime,
        durationMinutes: 45,
        slotType: 'single',
        price: 950,
        isOnline: newAptIsOnline,
        status: 'confirmed',
        notes: newAptNotes || undefined,
        createdAt: new Date().toISOString()
      };

      await dbService.saveAppointment(newAppointment);

      // Send SMS bekreftelse dersom avhuket
      if (newAptSendSms) {
        try {
          await Promise.race([
            smsService.sendBookingConfirmation(newAppointment),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('SMS timeout')), 3500))
          ]);
        } catch (smsErr) {
          console.warn('SMS-sending feilet:', smsErr);
        }
      }

      await dbService.logAction(
        { uid: currentUser.uid, email: currentUser.email, role: currentUser.role },
        'create_appointment',
        `Avtalte ny time for ${selectedClient.displayName} den ${newAppointment.date} kl. ${newAppointment.startTime}`
      );

      setIsNewAppointmentModalOpen(false);
      setNewAptNotes('');
      await loadJournalsAndAppointments(selectedClient.uid);
      setSaveFeedback(`Samtaletime lagt til for ${safeFormatDate(newAptDate + 'T12:00:00', 'd. MMMM', newAptDate)} kl. ${newAptTime} - ${finalEndTime}. Vises nå i kalenderen!${newAptSendSms ? ' (Bekreftelse sendt)' : ''}`);
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (err: any) {
      alert('Kunne ikke opprette timeavtale: ' + err.message);
    }
  };

  // PDF-EKSPORT (Forslag 5)
  const handleExportPdf = () => {
    if (!selectedClient) return;

    try {
      const doc = new jsPDF();
      const clientName = canViewName ? selectedClient.displayName : `Klient #${selectedClient.customerNumber || 1000}`;
      const customerNr = selectedClient.customerNumber || 1000;

      const primaryColor: [number, number, number] = [2, 132, 199];
      const darkColor: [number, number, number] = [15, 23, 42];
      const grayColor: [number, number, number] = [100, 116, 139];

      // Toppbanner
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 26, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('Tid1Din - Pasientjournal', 14, 16);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Utskriftsdato: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 135, 16);

      let y = 35;

      // Pasientopplysninger
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, y, 182, 32, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 32, 3, 3, 'D');

      doc.setTextColor(...darkColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Pasient: ${clientName} (#${customerNr})`, 18, y + 8);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grayColor);
      doc.text(`Fodselsdato: ${selectedClient.birthDate || 'Ikke oppgitt'}`, 18, y + 16);
      doc.text(`Telefon: ${selectedClient.phone || 'Ikke oppgitt'}`, 18, y + 24);
      doc.text(`Behandler: ${currentUser?.displayName || 'Terapeut'}`, 110, y + 16);
      doc.text(`Antall notater: ${filteredAndSortedEntries.length}`, 110, y + 24);

      y += 42;

      // Journalnotater
      if (filteredAndSortedEntries.length === 0) {
        doc.setTextColor(...grayColor);
        doc.text('Ingen journalnotater registrert for denne klienten.', 14, y);
      } else {
        filteredAndSortedEntries.forEach((entry) => {
          if (y > 245) {
            doc.addPage();
            y = 20;
          }

          const sessionDateStr = entry.sessionDate || safeFormatDate(entry.createdAt, 'yyyy-MM-dd');
          const sessionTimeStr = entry.sessionTime || safeFormatDate(entry.createdAt, 'HH:mm');

          // Tittelbjelke for notat
          doc.setFillColor(241, 245, 249);
          doc.rect(14, y, 182, 7, 'F');
          doc.setTextColor(...darkColor);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.text(`Dato: ${sessionDateStr} kl. ${sessionTimeStr} - Ført av ${entry.authorName}`, 17, y + 5);

          y += 12;

          // Innhold
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(30, 41, 59);

          const splitLines = doc.splitTextToSize(entry.decryptedContent, 178);
          splitLines.forEach((line: string) => {
            if (y > 275) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, 16, y);
            y += 5;
          });

          y += 7;
        });
      }

      const safeName = (selectedClient.displayName || 'Klient').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`Journal_${safeName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      setSaveFeedback('Journal ble lastet ned som PDF!');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (e: any) {
      alert('Feil ved eksport av PDF: ' + e.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Formatering for visning av journalnotat (Spørsmål 3: Fet tekst, overskrifter, punkter)
  const renderFormattedJournalContent = (content: string) => {
    if (!content || typeof content !== 'string') return null;
    const lines = content.split('\n');

    return (
      <div className="space-y-1.5 text-slate-800 text-sm sm:text-base leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          // H2 Overskrift
          if (trimmed.startsWith('## ')) {
            return (
              <h4 key={idx} className="text-base sm:text-lg font-black text-slate-900 mt-3.5 mb-1 flex items-center gap-1.5 border-b border-slate-100 pb-1">
                {parseInlineFormatting(trimmed.replace(/^##\s*/, ''))}
              </h4>
            );
          }

          // H3 Underoverskrift
          if (trimmed.startsWith('### ')) {
            return (
              <h5 key={idx} className="text-sm sm:text-base font-bold text-slate-800 mt-2.5 mb-1">
                {parseInlineFormatting(trimmed.replace(/^###\s*/, ''))}
              </h5>
            );
          }

          // Kulepunkter
          if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 sm:pl-3 my-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 mt-2 flex-shrink-0" />
                <span className="flex-1">{parseInlineFormatting(trimmed.replace(/^[•\-*]\s*/, ''))}</span>
              </div>
            );
          }

          // Nummerert liste
          if (/^\d+\.\s/.test(trimmed)) {
            const match = trimmed.match(/^(\d+\.)\s*(.*)$/);
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 sm:pl-3 my-0.5">
                <span className="font-bold text-slate-600 font-mono text-xs mt-0.5">{match ? match[1] : ''}</span>
                <span className="flex-1">{parseInlineFormatting(match ? match[2] : trimmed)}</span>
              </div>
            );
          }

          // Tom linje
          if (!trimmed) {
            return <div key={idx} className="h-2" />;
          }

          // Vanlig linje
          return (
            <p key={idx} className="my-0.5">
              {parseInlineFormatting(line)}
            </p>
          );
        })}
      </div>
    );
  };

  // Parser **fet** og *kursiv* inline
  const parseInlineFormatting = (text: string): React.ReactNode => {
    // Splitt på fet skrift **tekst**
    const boldParts = text.split(/(\*\*[^*]+\*\*)/g);

    return boldParts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return <strong key={i} className="font-bold text-slate-900">{inner}</strong>;
      }
      // Kursiv *tekst*
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        const inner = part.slice(1, -1);
        return <em key={i} className="italic text-slate-800">{inner}</em>;
      }
      return part;
    });
  };

  const clientDisplayName = selectedClient 
    ? (canViewName ? selectedClient.displayName : `Klient #${selectedClient.customerNumber || 1000}`)
    : 'Ingen klient valgt';

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 overflow-hidden select-text text-slate-800">
      
      {/* 1. TOPPBAR: Navn på klienten øverst, kontaktinfo, klientvelger, PDF-eksport og handlinger */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 flex-shrink-0 z-20 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
          
          {/* Klientens navn og nøkkelinfo */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap sm:flex-nowrap">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold text-base sm:text-lg shadow-sm flex-shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                  {clientDisplayName}
                </h1>
                {selectedClient && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-mono font-bold text-[11px] sm:text-xs border border-sky-200 flex-shrink-0">
                    #{selectedClient.customerNumber || 1000}
                  </span>
                )}
              </div>

              {selectedClient?.notes && (
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                  <span className="text-[11px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 truncate max-w-xs" title={selectedClient.notes}>
                    Notat: {selectedClient.notes}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Handlingsknapper øverst */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto justify-between lg:justify-end">
            
            {/* Klientvelger Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-700 flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <User className="w-3.5 h-3.5 text-sky-600" />
                <span className="max-w-[85px] sm:max-w-[130px] truncate">Bytt klient</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isClientDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-slate-900/30 sm:bg-transparent"
                    onClick={() => setIsClientDropdownOpen(false)}
                  />
                  <div className="fixed inset-x-3 top-28 sm:top-full sm:mt-1.5 sm:absolute sm:inset-auto sm:right-0 w-auto sm:w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in duration-100">
                    <div className="p-1.5 mb-1 border-b border-slate-100">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={clientSearchTerm}
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                          placeholder="Søk navn eller kundenr..."
                          className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {clients
                        .filter(c => {
                          const term = clientSearchTerm.toLowerCase();
                          return c.displayName.toLowerCase().includes(term) ||
                            String(c.customerNumber || '').includes(term);
                        })
                        .map(client => (
                          <button
                            key={client.uid}
                            onClick={() => {
                              setSelectedClient(client);
                              setIsClientDropdownOpen(false);
                              setClientSearchTerm('');
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                              selectedClient?.uid === client.uid 
                                ? 'bg-sky-50 text-sky-800 font-bold' 
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <p className="font-bold text-slate-900 truncate">
                                {canViewName ? client.displayName : `Klient #${client.customerNumber || 1000}`}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">#{client.customerNumber || 1000}</p>
                            </div>
                            {selectedClient?.uid === client.uid && (
                              <CheckCircle2 className="w-4 h-4 text-sky-600 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Ny samtaletime-knapp */}
            {canEdit && (
              <button
                onClick={() => {
                  setNewAptDate(format(new Date(), 'yyyy-MM-dd'));
                  setNewAptTime('12:00');
                  setNewAptEndTime('12:45');
                  setIsNewAppointmentModalOpen(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="Avtal ny samtaletime (vises direkte i kalenderen)"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Avtal ny time</span>
              </button>
            )}

            {/* Skriv nytt journalnotat-knapp */}
            {canEdit && (
              <button
                onClick={handleStartNew}
                disabled={!selectedClient}
                className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Nytt notat</span>
              </button>
            )}

            {/* Fokusmodus-knapp (Forslag 4) */}
            <button
              onClick={() => setIsFocusMode(!isFocusMode)}
              className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer ${
                isFocusMode
                  ? 'bg-sky-50 text-sky-700 border-sky-300 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
              }`}
              title={isFocusMode ? "Avslutt fokusmodus" : "Fokusmodus: 100% ren skriveflate"}
            >
              {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* PDF Eksport (Forslag 5) */}
            <button
              onClick={handleExportPdf}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-sky-700 hover:bg-sky-50 border border-slate-200 transition-colors cursor-pointer"
              title="Last ned journal som PDF"
            >
              <Download className="w-4 h-4 text-sky-600" />
            </button>

            {/* Utskrift */}
            <button
              onClick={handlePrint}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer hidden sm:flex"
              title="Skriv ut journal"
            >
              <Printer className="w-4 h-4 text-slate-600" />
            </button>

            {/* SMS Varsel */}
            <button
              onClick={() => setIsSmsModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              title="Send SMS til klienten"
            >
              <MessageSquare className="w-4 h-4 text-amber-600" />
            </button>

          </div>

        </div>

        {saveFeedback && (
          <div className="mt-2 p-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {saveFeedback}
            </span>
            <button onClick={() => setSaveFeedback(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* Mobil fanebytte mellom Notater og Samtaletimer */}
      <div className="md:hidden flex border-b border-slate-200 bg-white px-3 py-1.5 gap-2 flex-shrink-0">
        <button
          onClick={() => setMobileTab('notes')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
            mobileTab === 'notes'
              ? 'bg-sky-600 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Journal ({filteredAndSortedEntries.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('sessions')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
            mobileTab === 'sessions'
              ? 'bg-sky-600 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Samtaletimer ({timelineSessions.length})</span>
        </button>
      </div>

      {/* 2. HOVEDAREALET: 1/4 venstre (Samtaletimer) + 3/4 høyre (Scrollbar journal) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full">
        
        {/* ===================== VENSTRE KOLONNE (1/4): SAMTALETIMER & TIDSLINJE (Skjules i fokusmodus) ===================== */}
        {!isFocusMode && (
          <aside className={`w-full md:w-80 lg:w-96 md:min-w-[280px] bg-white border-r border-slate-200 flex flex-col justify-between flex-shrink-0 z-10 transition-all ${
            mobileTab === 'sessions' ? 'flex flex-1 min-h-0' : 'hidden md:flex'
          }`}>
            
            {/* Toppen av venstre kolonne */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4.5 h-4.5 text-sky-600" />
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Samtaletimer
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {timelineSessions.length} {timelineSessions.length === 1 ? 'registrert time' : 'registrerte timer'}
                  </p>
                </div>
              </div>

              {canEdit && (
                <button
                  onClick={() => {
                    setNewAptDate(format(new Date(), 'yyyy-MM-dd'));
                    setNewAptTime('12:00');
                    setNewAptEndTime('12:45');
                    setIsNewAppointmentModalOpen(true);
                  }}
                  className="p-1.5 text-sky-700 hover:bg-sky-50 rounded-lg border border-sky-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Legg til timeavtale som vises i kalenderen"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Ny time</span>
                </button>
              )}
            </div>

            {/* Liste over samtaletimer som følger scrollingen i journalen */}
            <div 
              ref={sessionListContainerRef}
              className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2"
            >
              {timelineSessions.length === 0 ? (
                <div className="text-center py-12 px-4 text-slate-400">
                  <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-xs font-bold text-slate-600">Ingen samtaletimer registrert</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Trykk «Ny time» eller «Nytt notat» for å registrere timer for denne klienten.
                  </p>
                </div>
              ) : (
                timelineSessions.map((session) => {
                  const isActive = activeSessionKey === session.key;
                  const formattedDate = safeFormatDate(session.date + 'T12:00:00', 'EEEE d. MMM yyyy', session.date);

                  const apt = session.appointment;
                  const isOnline = apt?.isOnline;

                  return (
                    <div
                      key={session.key}
                      ref={(el) => {
                        if (el) sessionItemRefs.current.set(session.key, el);
                        else sessionItemRefs.current.delete(session.key);
                      }}
                      onClick={() => handleSelectTimelineSession(session.key, session.appointment, session.entry)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer relative group ${
                        isActive
                          ? 'bg-sky-50/90 border-sky-500 shadow-sm ring-1 ring-sky-400/50'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 transition-transform ${
                            isActive 
                              ? 'bg-sky-600 ring-4 ring-sky-200 scale-110' 
                              : session.hasNote 
                                ? 'bg-emerald-500' 
                                : 'bg-slate-300 group-hover:bg-slate-400'
                          }`} />

                          <div>
                            <p className={`text-xs font-extrabold capitalize ${isActive ? 'text-sky-950' : 'text-slate-900'}`}>
                              {formattedDate}
                            </p>

                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-slate-600">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>kl. {session.time}</span>
                              {apt && (
                                <span className="text-slate-400 font-sans">
                                  &bull; {apt.endTime ? `til ${apt.endTime}` : `${apt.durationMinutes || 45} min`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Notatstatus-merke */}
                        <div className="flex items-center gap-1">
                          {session.hasNote ? (
                            <span className="p-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200 flex items-center gap-1" title="Journalnotat er registrert">
                              <FileCheck2 className="w-3 h-3 text-emerald-600" />
                              <span className="hidden sm:inline">Notat</span>
                            </span>
                          ) : (
                            <span className="p-1 rounded-md bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200 flex items-center gap-1" title="Mangler journalnotat – trykk for å skrive">
                              <Edit3 className="w-3 h-3 text-amber-600" />
                              <span className="hidden sm:inline">Skriv</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          {isOnline ? (
                            <span className="text-indigo-600 font-semibold flex items-center gap-1">
                              <Video className="w-3 h-3" /> Online
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Oppmøte
                            </span>
                          )}
                        </span>

                        {apt?.price && (
                          <span className="font-semibold text-slate-600 font-mono">
                            kr {apt.price},-
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {onNavigateToCalendar && (
              <div className="p-3 border-t border-slate-200 bg-slate-50/50 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-3">
                <button
                  onClick={() => onNavigateToCalendar()}
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <CalendarIcon className="w-4 h-4 text-sky-600" />
                  <span>Åpne full kalender</span>
                </button>
              </div>
            )}
          </aside>
        )}

        {/* ===================== HØYRE KOLONNE (3/4 ELLER 100% I FOKUSMODUS): JOURNALFLATE ===================== */}
        <main 
          ref={journalScrollContainerRef}
          className={`flex-1 overflow-y-auto bg-slate-50/40 p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8 transition-all ${
            mobileTab === 'notes' ? 'block' : 'hidden md:block'
          } ${
            isFocusMode ? 'max-w-4xl mx-auto w-full' : ''
          }`}
        >
          
          {/* SØKEFELT OG VERKTØYLINJE */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={journalSearchQuery}
                onChange={(e) => setJournalSearchQuery(e.target.value)}
                placeholder="Søk i journalnotater, observasjoner, datoer..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:border-sky-500 bg-slate-50/60 focus:bg-white transition-all"
              />
              {journalSearchQuery && (
                <button
                  onClick={() => setJournalSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  Nullstill
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Endre rekkefølge på notater"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span>{sortOrder === 'desc' ? 'Nyeste først' : 'Eldste først'}</span>
              </button>

              <button
                onClick={handleExportPdf}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Last ned som PDF"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <span className="text-xs text-slate-400 font-semibold px-2">
                {filteredAndSortedEntries.length} {filteredAndSortedEntries.length === 1 ? 'notat' : 'notater'}
              </span>
            </div>
          </div>

          {/* SKRIVEOMRÅDE (COMPOSER): GOD PLASS TIL Å SKRIVE PÅ IPAD / PC */}
          {isComposerOpen && canEdit && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border-2 border-sky-400 p-3.5 sm:p-7 shadow-lg space-y-4 animate-in fade-in duration-200">
              
              {/* Topplinje for notatskriving */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {editingEntryId ? 'Rediger journalnotat' : 'Skriv nytt journalnotat'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Klient: <strong className="text-slate-800">{clientDisplayName}</strong> &bull; Behandler: <strong>{currentUser?.displayName}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => setIsFocusMode(!isFocusMode)}
                    className="p-1.5 text-slate-500 hover:text-sky-700 rounded-lg hover:bg-slate-100 text-xs font-bold flex items-center gap-1"
                    title={isFocusMode ? "Avslutt fokusmodus" : "Fokusmodus for uforstyrret skriving"}
                  >
                    {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    <span>{isFocusMode ? 'Normal visning' : 'Fokusmodus'}</span>
                  </button>

                  <button
                    onClick={() => setIsComposerOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Timeknytning og dato/tid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Tilknyttet samtaletime
                  </label>
                  <select
                    value={selectedAppointmentId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedAppointmentId(val);
                      if (val) {
                        const found = appointments.find(a => a.id === val);
                        if (found) {
                          setSessionDate(found.date);
                          setSessionTime(found.startTime);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 outline-none focus:border-sky-500"
                  >
                    <option value="">-- Ingen / Egendefinert tidspunkt --</option>
                    {appointments.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        {apt.date} kl. {apt.startTime} ({apt.isOnline ? 'Online' : 'Oppmøte'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>Dato for samtalen *</span>
                    {(editingEntryId || selectedAppointmentId) && (
                      <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Låst
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    required
                    disabled={!!editingEntryId || !!selectedAppointmentId}
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 outline-none focus:border-sky-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>Klokkeslett *</span>
                    {(editingEntryId || selectedAppointmentId) && (
                      <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Låst
                      </span>
                    )}
                  </label>
                  <select
                    required
                    disabled={!!editingEntryId || !!selectedAppointmentId}
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 outline-none focus:border-sky-500 font-mono font-bold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  >
                    {generateTimeOptions([sessionTime]).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(editingEntryId || selectedAppointmentId) && (
                <p className="text-[11px] text-slate-500 italic flex items-center gap-1.5 px-1 -mt-1">
                  <Lock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                  <span>Dato og klokkeslett for gjennomførte eller tilknyttede timer er låst og kan ikke endres.</span>
                </p>
              )}

              {/* FORMATERINGSVERKTØY & MALER (Spørsmål 3: Fet tekst, overskrifter, lister) */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-100/80 border border-slate-200 text-xs">
                <div className="flex items-center gap-1 flex-wrap">
                  
                  {/* Fet tekst */}
                  <button
                    type="button"
                    onClick={() => handleFormat('**', '**')}
                    className="p-1.5 px-2 rounded-lg bg-white hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                    title="Fet tekst (Ctrl+B / Cmd+B)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>

                  {/* Kursiv */}
                  <button
                    type="button"
                    onClick={() => handleFormat('*', '*')}
                    className="p-1.5 px-2 rounded-lg bg-white hover:bg-slate-200 text-slate-800 italic border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                    title="Kursiv tekst (Ctrl+I / Cmd+I)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>

                  <div className="h-4 w-px bg-slate-300 mx-1" />

                  {/* Overskrift H2 */}
                  <button
                    type="button"
                    onClick={() => handleInsertPrefix('## ')}
                    className="p-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-200 text-slate-800 font-black border border-slate-200 transition-colors cursor-pointer shadow-2xs flex items-center gap-1 text-[11px]"
                    title="Sett inn overskrift"
                  >
                    <Heading1 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Overskrift</span>
                  </button>

                  {/* Underoverskrift H3 */}
                  <button
                    type="button"
                    onClick={() => handleInsertPrefix('### ')}
                    className="p-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 transition-colors cursor-pointer shadow-2xs flex items-center gap-1 text-[11px]"
                    title="Sett inn underoverskrift"
                  >
                    <Heading2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Underoverskrift</span>
                  </button>

                  <div className="h-4 w-px bg-slate-300 mx-1" />

                  {/* Punktliste */}
                  <button
                    type="button"
                    onClick={() => handleInsertPrefix('• ')}
                    className="p-1.5 px-2 rounded-lg bg-white hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                    title="Punktliste"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>

                  {/* Nummerert liste */}
                  <button
                    type="button"
                    onClick={() => handleInsertPrefix('1. ')}
                    className="p-1.5 px-2 rounded-lg bg-white hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                    title="Nummerert liste"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* HURTIGMALER DROPDOWN (Forslag 1) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTemplatesDropdownOpen(!isTemplatesDropdownOpen)}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs text-xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Sett inn hurtigmal</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {isTemplatesDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in duration-100">
                      <div className="p-2 border-b border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Velg journalmal</p>
                      </div>
                      <div className="space-y-1 mt-1">
                        {JOURNAL_TEMPLATES.map(tpl => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleApplyTemplate(tpl.content)}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-sky-50 text-slate-700 hover:text-sky-900 transition-colors"
                          >
                            <p className="font-bold text-xs">{tpl.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{tpl.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* RIKELIG MED SKRIVEPLASS TILPASSET IPAD & PC */}
              <div>
                <textarea
                  ref={textareaRef}
                  rows={isFocusMode ? 16 : 12}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Skriv samtalereferat, observasjoner, klientens tilstand, tiltak og plan videre for neste time... (Tips: Merk ord og trykk B eller Ctrl+B for fet skrift, ## for overskrift)"
                  className="w-full p-4 sm:p-5 rounded-2xl border border-slate-300 text-sm sm:text-base leading-relaxed text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-[260px] font-normal"
                  autoFocus
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
                    placeholder="f.eks. Korrigert formulering, lagt til oppfølgingsdetalj..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white outline-none focus:border-sky-500"
                  />
                </div>
              )}

              {/* AVTAL NESTE TIME SAMTIDIG (Forslag 2 & Spørsmål 2: standard 45 min sluttid) */}
              {!editingEntryId && (
                <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={shouldBookNext}
                        onChange={(e) => setShouldBookNext(e.target.checked)}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-xs sm:text-sm font-bold text-sky-950 flex items-center gap-1.5">
                        <CalendarPlus className="w-4 h-4 text-sky-600" />
                        Avtal neste samtaletime samtidig?
                      </span>
                    </label>

                    {shouldBookNext && (
                      <span className="text-[11px] font-semibold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-md">
                        Slutt-tid er standard +45 min
                      </span>
                    )}
                  </div>

                  {shouldBookNext && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-sky-200/60 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Neste dato *
                        </label>
                        <input
                          type="date"
                          min={format(new Date(), 'yyyy-MM-dd')}
                          required={shouldBookNext}
                          value={nextDate}
                          onChange={(e) => setNextDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Starttidspunkt *
                        </label>
                        <select
                          required={shouldBookNext}
                          value={nextStartTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNextStartTime(val);
                            // Beregn sluttid automatisk som +45 minutter (som standard)
                            setNextEndTime(calculateEndTime(val, 45));
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-mono font-bold"
                        >
                          {generateTimeOptions([nextStartTime]).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Sluttidspunkt *
                        </label>
                        <select
                          required={shouldBookNext}
                          value={nextEndTime}
                          onChange={(e) => setNextEndTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-mono font-bold"
                        >
                          {generateTimeOptions([nextEndTime]).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Møteform
                        </label>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setNextIsOnline(false)}
                            className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold ${
                              !nextIsOnline 
                                ? 'bg-emerald-600 text-white border-emerald-600 font-bold' 
                                : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            Oppmøte
                          </button>
                          <button
                            type="button"
                            onClick={() => setNextIsOnline(true)}
                            className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold ${
                              nextIsOnline 
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold' 
                                : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            Online
                          </button>
                        </div>
                      </div>

                      {/* Send bekreftelsesmelding til klient */}
                      <div className="pt-1">
                        <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={sendNextAptSms}
                            onChange={(e) => setSendNextAptSms(e.target.checked)}
                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer accent-sky-600"
                          />
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <MessageSquare className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                            <span className="text-xs font-semibold text-slate-700">
                              Send bekreftelsesmelding med dato og tid til klienten (SMS)
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bunnknapper for lagring */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Notatet krypteres med AES-256 ved lagring.
                </span>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsComposerOpen(false);
                      setIsFocusMode(false);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !noteContent.trim()}
                    onClick={handleSaveNote}
                    className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? 'Lagrer...' : shouldBookNext ? 'Lagre notat & avtal neste time' : 'Lagre journalnotat'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* LISTE OVER JOURNALNOTATER (SCROLLBAR 3/4 FLATE) */}
          {isLoading ? (
            <div className="text-center py-20 text-slate-400">
              <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold">Laster pasientjournal...</p>
            </div>
          ) : filteredAndSortedEntries.length === 0 ? (
            <div className="text-center py-20 px-4 bg-white rounded-3xl border border-slate-200">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
              <h3 className="text-base font-bold text-slate-800">Ingen journalnotater funnet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {journalSearchQuery 
                  ? 'Ingen notater matcher søket ditt.' 
                  : 'Det er ikke skrevet noen journalnotater for denne klienten enda.'}
              </p>
              {canEdit && !isComposerOpen && (
                <button
                  onClick={handleStartNew}
                  className="mt-4 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start første journalnotat</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredAndSortedEntries.map((entry) => {
                const sessionDateStr = entry.sessionDate || safeFormatDate(entry.createdAt, 'yyyy-MM-dd');
                const sessionTimeStr = entry.sessionTime || safeFormatDate(entry.createdAt, 'HH:mm');
                const matchedApt = entry.appointmentId ? appointments.find(a => a.id === entry.appointmentId) : null;
                const sessionKey = matchedApt ? `apt_${matchedApt.id}` : `entry_${entry.id}`;
                const isSelected = activeSessionKey === sessionKey;

                const formattedDateTitle = safeFormatDate(sessionDateStr + 'T12:00:00', 'EEEE d. MMMM yyyy', sessionDateStr);

                return (
                  <article
                    key={entry.id}
                    id={`entry-${entry.id}`}
                    ref={(el) => {
                      if (el) noteRefs.current.set(sessionKey, el);
                      else noteRefs.current.delete(sessionKey);
                    }}
                    className={`bg-white rounded-2xl sm:rounded-3xl border p-3.5 sm:p-6 shadow-xs hover:shadow-sm transition-all space-y-3.5 ${
                      isSelected 
                        ? 'border-sky-400 ring-2 ring-sky-300/60 shadow-md' 
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Header for notatet: Dato, klokkeslett, behandler og revisjonsknapper */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="p-2 rounded-xl bg-sky-100 text-sky-800 font-bold flex items-center gap-1.5 text-xs sm:text-sm">
                          <Clock className="w-4 h-4 text-sky-600" />
                          <span>kl. {sessionTimeStr}</span>
                        </span>

                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 capitalize">
                          {formattedDateTitle}
                        </h3>

                        {matchedApt && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            {matchedApt.isOnline ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                            <span>Tilknyttet samtaletime ({matchedApt.isOnline ? 'Online' : 'Oppmøte'})</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-medium">
                          Ført av: <strong className="text-slate-800">{entry.authorName}</strong>
                        </span>

                        {entry.updatedAt !== entry.createdAt && (
                          <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Endret {safeFormatDate(entry.updatedAt, 'd. MMM HH:mm')}
                          </span>
                        )}

                        {entry.revisionHistory && entry.revisionHistory.length > 0 && (
                          <button
                            onClick={() => setSelectedRevisionHistory(entry.revisionHistory)}
                            className="p-1.5 text-indigo-700 hover:bg-indigo-50 rounded-lg border border-indigo-200 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                            title="Se revisjonsspor og tidligere versjoner"
                          >
                            <History className="w-3.5 h-3.5 text-indigo-600" />
                            <span>({entry.revisionHistory.length})</span>
                          </button>
                        )}

                        {canEdit && (
                          <button
                            onClick={() => handleStartEdit(entry)}
                            className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                            title="Rediger notat"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* FORMATERT JOURNALTEKST: Fet tekst, overskrifter og punkter */}
                    <div className="py-1">
                      {renderFormattedJournalContent(entry.decryptedContent)}
                    </div>

                    {/* Bunndetails */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Loggført: {safeFormatDate(entry.createdAt, 'd. MMMM yyyy')} kl. {safeFormatDate(entry.createdAt, 'HH:mm')}</span>
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <Lock className="w-3 h-3" />
                        AES-256 kryptert
                      </span>
                    </div>

                  </article>
                );
              })}
            </div>
          )}

        </main>

      </div>

      {/* MODAL: AVTAL NY SAMTALETIME (Starttid + standard 45 min slutt-tid) */}
      {/* NY SAMTALETIME-MODAL */}
      {isNewAppointmentModalOpen && selectedClient && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[88dvh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6 shadow-2xl border border-slate-200 overflow-hidden">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5 text-sky-600" />
                  Avtal ny samtaletime
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Timen avtales etter hva som passer for deg og klienten, og vises automatisk i kalenderen.
                </p>
              </div>

              <button
                onClick={() => setIsNewAppointmentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              
              <div className="flex-1 overflow-y-auto space-y-3.5 py-3 pr-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Klient
                  </label>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 flex items-center justify-between">
                    <span>{clientDisplayName}</span>
                    <span className="font-mono text-slate-400">#{selectedClient.customerNumber || 1000}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Dato *
                  </label>
                  <input
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                    value={newAptDate}
                    onChange={(e) => setNewAptDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
                  />
                </div>

                {/* Start- og sluttidspunkt (standard 45 minutter) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Starttidspunkt *
                    </label>
                    <select
                      required
                      value={newAptTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewAptTime(val);
                        // Automatisk slutt-tid satt til +45 minutter som standard
                        setNewAptEndTime(calculateEndTime(val, 45));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold font-mono text-slate-800 outline-none focus:border-sky-500 bg-white"
                    >
                      {generateTimeOptions([newAptTime]).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Sluttidspunkt * (standard 45 min)
                    </label>
                    <select
                      required
                      value={newAptEndTime}
                      onChange={(e) => setNewAptEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold font-mono text-slate-800 outline-none focus:border-sky-500 bg-white"
                    >
                      {generateTimeOptions([newAptEndTime]).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Møteform
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewAptIsOnline(false)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        !newAptIsOnline
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Oppmøte i klinikk
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAptIsOnline(true)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        newAptIsOnline
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Online videomøte
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Valgfritt notat for timen
                  </label>
                  <input
                    type="text"
                    value={newAptNotes}
                    onChange={(e) => setNewAptNotes(e.target.value)}
                    placeholder="f.eks. Oppfølgingssamtale etter forrige uke..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 outline-none focus:border-sky-500"
                  />
                </div>

                {/* Send bekreftelsesmelding til klient */}
                <div>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newAptSendSms}
                      onChange={(e) => setNewAptSendSms(e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer accent-sky-600"
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MessageSquare className="w-4 h-4 text-sky-600 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">
                          Send bekreftelsesmelding med dato og tid
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Klienten mottar bekreftelse på SMS (automatisk avhuket)
                        </span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100 flex-shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
                <button
                  type="button"
                  onClick={() => setIsNewAppointmentModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all"
                >
                  Bekreft & lagre time
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* REVISJONSSPOR MODAL */}
      {selectedRevisionHistory && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 max-h-[85dvh] flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-shrink-0">
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

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {selectedRevisionHistory.map((rev, idx) => (
                <div key={rev.id || idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Endret av {rev.modifiedBy}</span>
                    <span className="text-slate-500 font-normal">
                      {safeFormatDate(rev.timestamp, 'd. MMM yyyy HH:mm')}
                    </span>
                  </div>
                  {rev.changeNote && (
                    <p className="text-[11px] text-indigo-700 font-medium bg-indigo-50/50 p-1.5 rounded-lg">
                      Notat: {rev.changeNote}
                    </p>
                  )}
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 italic">
                    «{rev.previousContentPreview}»
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SMS MODAL */}
      {isSmsModalOpen && selectedClient && (
        <AppointmentSmsModal
          isOpen={isSmsModalOpen}
          onClose={() => setIsSmsModalOpen(false)}
          client={selectedClient}
          initialTab="delay"
          onAppointmentUpdated={() => {
            if (selectedClient) loadJournalsAndAppointments(selectedClient.uid);
          }}
        />
      )}

    </div>
  );
};

export default JournalView;
