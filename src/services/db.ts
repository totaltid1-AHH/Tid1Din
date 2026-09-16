import { 
  UserProfile, 
  WorkingHoursConfig, 
  Appointment, 
  JournalEntry, 
  SmsSettings, 
  SmsLog, 
  SmsTemplate,
  SystemAuditLog, 
  Holiday,
  UserRole
} from '../types';
import { encryptData, decryptData } from '../utils/crypto';
import { db, isFirebaseConfigured } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  addDoc 
} from 'firebase/firestore';

const STORAGE_PREFIX = 'dintid_';

// Hjelpefunksjon for å fjerne felter med undefined som Firestore ikke godtar
function cleanForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

// Initial pre-seed data
const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  id: 'default',
  workDays: [1, 2, 3, 4, 5], // Mandag til fredag
  startTime: '08:00',
  endTime: '16:00',
  slotDurationMinutes: 45,
  breakBetweenMinutes: 15,
  breaks: [
    { start: '12:00', end: '12:30', title: 'Lunsjpause' }
  ],
  prices: {
    single: 950,
    double: 1800,
    triple: 2600
  }
};

const DEFAULT_SMS_SETTINGS: SmsSettings = {
  id: 'default',
  apiKey: import.meta.env.VITE_GATEWAY_API_KEY || '',
  sender: import.meta.env.VITE_GATEWAY_SENDER || 'Tid1Din',
  reminder1Enabled: true,
  reminder1Hours: 24,
  reminder2Enabled: true,
  reminder2Hours: 1,
  bookingTemplate: 'Hei {kunde}! Din time hos Tid1Din er bekreftet: {dato} kl. {klokkeslett} ({varighet} min, kr {pris}). Avbestilling: {avbestillingslenke}',
  reminderTemplate: 'Påminnelse fra Tid1Din: Du har time {dato} kl. {klokkeslett}. {motelenke} Velkommen!'
};

export const DEFAULT_SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: 'tpl_delay_15',
    title: '15 min forsinket',
    category: 'delay',
    isDefault: true,
    message: 'Hei {kunde}! Din behandler er dessverre ca. 15 minutter forsinket i dag ({dato}). Ny oppstartstid er ca. kl. {nytt_klokkeslett}. Beklager ulempen!'
  },
  {
    id: 'tpl_delay_30',
    title: '30 min forsinket',
    category: 'delay',
    isDefault: true,
    message: 'Hei {kunde}! Din behandler er dessverre ca. 30 minutter forsinket i dag ({dato}). Ny oppstartstid er ca. kl. {nytt_klokkeslett}. Beklager ulempen!'
  },
  {
    id: 'tpl_reschedule',
    title: 'Flytting / Ombooking av time',
    category: 'reschedule',
    isDefault: true,
    message: 'Hei {kunde}! Din avtalte time hos Tid1Din er flyttet til ny dato: {ny_dato} kl. {nytt_klokkeslett}. Vennligst ta kontakt dersom tidspunktet ikke passer.'
  },
  {
    id: 'tpl_welcome',
    title: 'Oppmøte / Velkommen',
    category: 'info',
    isDefault: true,
    message: 'Hei {kunde}! Vi minner om timen din i dag ({dato}) kl. {klokkeslett}. Vennligst benytt venterommet ved ankomst. Velkommen!'
  },
  {
    id: 'tpl_online',
    title: 'Videomøte / Online time',
    category: 'info',
    isDefault: true,
    message: 'Hei {kunde}! Her er lenken til din online konsultasjon i dag kl. {klokkeslett}: {motelenke}. Velkommen!'
  }
];

// Startverdier for brukere
const SEED_USERS: UserProfile[] = [
  {
    uid: 'u_hovedadmin',
    email: 'hovedadmin@dintid.no',
    role: 'hovedadmin',
    displayName: 'Dr. Kari Nordmann',
    phone: '90011000',
    twoFactorEnabled: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    uid: 'u_admin_full',
    email: 'admin.jonas@dintid.no',
    role: 'admin',
    displayName: 'Jonas Berg',
    phone: '98822000',
    twoFactorEnabled: true,
    isActive: true,
    permissions: {
      canViewClientName: true,
      canViewClientPhone: true,
      canViewClientEmail: true,
      canEditJournals: true,
      canManageAppointments: true
    },
    createdAt: new Date().toISOString()
  },
  {
    uid: 'u_admin_restricted',
    email: 'admin.eva@dintid.no',
    role: 'admin',
    displayName: 'Eva Lund',
    phone: '45533000',
    twoFactorEnabled: true,
    isActive: true,
    permissions: {
      canViewClientName: false, // Navn skjules for denne
      canViewClientPhone: false, // Telefon skjules
      canViewClientEmail: false, // E-post skjules
      canEditJournals: true,
      canManageAppointments: true
    },
    createdAt: new Date().toISOString()
  },
  {
    uid: 'u_client_1000',
    email: 'ola.hansen@eksempel.no',
    role: 'client',
    displayName: 'Ola Hansen',
    customerNumber: 1000,
    phone: '91234567',
    address: 'Storgata 14, 0182 Oslo',
    birthDate: '1985-04-12',
    twoFactorEnabled: true,
    notes: 'Klient ønsker påminnelse på SMS. Følsom for sterkt lys.',
    createdAt: new Date().toISOString()
  },
  {
    uid: 'u_client_1001',
    email: 'silje.tangen@eksempel.no',
    role: 'client',
    displayName: 'Silje Tangen',
    customerNumber: 1001,
    phone: '48123456',
    address: 'Bjørkeveien 3B, 5003 Bergen',
    birthDate: '1992-09-22',
    twoFactorEnabled: false,
    notes: 'Online konsultasjoner foretrekkes.',
    createdAt: new Date().toISOString()
  }
];

class DatabaseService {
  private getLocal<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setLocal<T>(key: string, value: T): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  }

  constructor() {
    this.initSeedData();
  }

  // Initialiser testdata i LocalStorage dersom tomt
  public async initSeedData() {
    if (!localStorage.getItem(STORAGE_PREFIX + 'initialized')) {
      this.setLocal('users', SEED_USERS);
      this.setLocal('working_hours', DEFAULT_WORKING_HOURS);
      this.setLocal('sms_settings', DEFAULT_SMS_SETTINGS);
      this.setLocal('holidays', []);
      this.setLocal('sms_logs', []);
      this.setLocal('system_logs', [
        {
          id: 'log_' + Date.now(),
          timestamp: new Date().toISOString(),
          userId: 'u_hovedadmin',
          userEmail: 'hovedadmin@dintid.no',
          userRole: 'hovedadmin',
          action: 'login',
          details: 'Systemet initialisert med standardinnstillinger'
        }
      ]);

      // Opprett eksempel-avtale for Ola Hansen
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const seedAppointments: Appointment[] = [
        {
          id: 'apt_1',
          clientId: 'u_client_1000',
          clientNumber: 1000,
          clientName: 'Ola Hansen',
          clientPhone: '91234567',
          clientEmail: 'ola.hansen@eksempel.no',
          date: dateStr,
          startTime: '09:00',
          endTime: '09:45',
          durationMinutes: 45,
          slotType: 'single',
          price: 950,
          isOnline: false,
          status: 'confirmed',
          notes: 'Første konsultasjon',
          createdAt: new Date().toISOString()
        }
      ];
      this.setLocal('appointments', seedAppointments);

      // Opprett eksempel journalnotat (kryptert)
      const encryptedNote = await encryptData(
        'Førstegangssamtale gjennomført. Klient opplever god respons på oppsatt plan. Fortsetter ukentlig oppfølging.'
      );

      const seedJournals: JournalEntry[] = [
        {
          id: 'jrn_1',
          clientId: 'u_client_1000',
          authorId: 'u_hovedadmin',
          authorName: 'Dr. Kari Nordmann',
          authorRole: 'hovedadmin',
          content: encryptedNote,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          lastModifiedBy: 'Dr. Kari Nordmann',
          lastModifiedById: 'u_hovedadmin',
          revisionHistory: []
        }
      ];
      this.setLocal('journals', seedJournals);

      localStorage.setItem(STORAGE_PREFIX + 'initialized', 'true');
    }
  }

  // --- BRUKERE & KLIENTER ---
  public async getUsers(): Promise<UserProfile[]> {
    const sanitizeUsers = (list: UserProfile[]) => {
      return list.map(u => {
        const base = {
          ...u,
          isActive: u.isActive !== false
        };
        if (u.role === 'admin' || u.role === 'hovedadmin') {
          return {
            ...base,
            displayName: u.displayName.replace(/\s*\([^)]*\)/g, '').trim()
          };
        }
        return base;
      });
    };

    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (!snap.empty) {
          const users = snap.docs.map(d => d.data() as UserProfile);
          const cleaned = sanitizeUsers(users);
          this.setLocal('users', cleaned);
          return cleaned;
        } else {
          for (const u of SEED_USERS) {
            await setDoc(doc(db, 'users', u.uid), u);
          }
          this.setLocal('users', SEED_USERS);
          return SEED_USERS;
        }
      } catch (e) {
        console.warn('Firebase feilet, faller tilbake til lokal lagring', e);
      }
    }
    const local = this.getLocal<UserProfile[]>('users', SEED_USERS);
    return sanitizeUsers(local);
  }

  public async getUserById(uid: string): Promise<UserProfile | null> {
    const users = await this.getUsers();
    return users.find(u => u.uid === uid) || null;
  }

  public async saveUser(user: UserProfile): Promise<void> {
    const cleanUser = cleanForFirestore(user);
    const users = await this.getUsers();
    const index = users.findIndex(u => u.uid === user.uid);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    this.setLocal('users', users);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'users', user.uid), cleanUser);
      } catch (e) {
        console.error('Kunne ikke lagre til Firestore:', e);
      }
    }
  }

  public async deleteUser(uid: string): Promise<void> {
    let users = await this.getUsers();
    users = users.filter(u => u.uid !== uid);
    this.setLocal('users', users);

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (e) {
        console.error('Kunne ikke slette fra Firestore:', e);
      }
    }
  }

  // Generer neste kundenummer (starter på 1000)
  public async getNextCustomerNumber(): Promise<number> {
    const users = await this.getUsers();
    const clientNumbers = users
      .filter(u => u.role === 'client' && typeof u.customerNumber === 'number')
      .map(u => u.customerNumber as number);

    if (clientNumbers.length === 0) return 1000;
    const max = Math.max(...clientNumbers);
    return Math.max(1000, max + 1);
  }

  // --- ARBEIDSTID & INNSTILLINGER ---
  public async getWorkingHours(therapistId?: string): Promise<WorkingHoursConfig> {
    const docId = therapistId ? `wh_${therapistId}` : 'default';
    const storageKey = therapistId ? `working_hours_${therapistId}` : 'working_hours';

    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDoc(doc(db, 'workingHours', docId));
        if (snap.exists()) {
          const config = snap.data() as WorkingHoursConfig;
          this.setLocal(storageKey, config);
          return config;
        } else if (!therapistId) {
          await setDoc(doc(db, 'workingHours', 'default'), DEFAULT_WORKING_HOURS);
          this.setLocal('working_hours', DEFAULT_WORKING_HOURS);
          return DEFAULT_WORKING_HOURS;
        }
      } catch (e) {
        console.warn('Firebase error fetching working hours:', e);
      }
    }

    const local = this.getLocal<WorkingHoursConfig | null>(storageKey, null);
    if (local) {
      return local;
    }

    const baseDefault = this.getLocal<WorkingHoursConfig>('working_hours', DEFAULT_WORKING_HOURS);
    if (therapistId) {
      return {
        ...baseDefault,
        id: docId,
        therapistId: therapistId
      };
    }
    return baseDefault;
  }

  public async saveWorkingHours(config: WorkingHoursConfig, therapistId?: string): Promise<void> {
    const targetTherapistId = therapistId || config.therapistId;
    const docId = targetTherapistId ? `wh_${targetTherapistId}` : 'default';
    const storageKey = targetTherapistId ? `working_hours_${targetTherapistId}` : 'working_hours';

    const cleanConfig = cleanForFirestore({
      ...config,
      id: docId,
      therapistId: targetTherapistId || undefined
    });

    this.setLocal(storageKey, cleanConfig);
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'workingHours', docId), cleanConfig);
      } catch (e) {
        console.error('Kunne ikke lagre arbeidstid til Firestore:', e);
      }
    }
  }

  // --- TIMEAVTALER (APPOINTMENTS) ---
  public async getAppointments(): Promise<Appointment[]> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'appointments'));
        if (!snap.empty) {
          const apts = snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
          this.setLocal('appointments', apts);
          return apts;
        } else {
          const localApts = this.getLocal<Appointment[]>('appointments', []);
          if (localApts.length > 0) {
            for (const apt of localApts) {
              await setDoc(doc(db, 'appointments', apt.id), apt);
            }
            return localApts;
          }
        }
      } catch (e) {
        console.warn('Firebase error fetching appointments:', e);
      }
    }
    return this.getLocal<Appointment[]>('appointments', []);
  }

  public async getAppointmentsByClient(clientId: string): Promise<Appointment[]> {
    const all = await this.getAppointments();
    return all.filter(a => a.clientId === clientId);
  }

  public async saveAppointment(apt: Appointment): Promise<void> {
    const cleanApt = cleanForFirestore(apt);
    const appointments = await this.getAppointments();
    const idx = appointments.findIndex(a => a.id === apt.id);
    if (idx >= 0) {
      appointments[idx] = { ...apt, updatedAt: new Date().toISOString() };
    } else {
      appointments.push(apt);
    }
    this.setLocal('appointments', appointments);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'appointments', apt.id), cleanApt);
      } catch (e: any) {
        console.error('Feil ved lagring av avtale i Firestore:', e);
        throw new Error('Kunne ikke lagre timen i databasen: ' + (e?.message || 'Ukjent feil'));
      }
    }
  }

  public async cancelAppointment(id: string, reason?: string): Promise<void> {
    const appointments = await this.getAppointments();
    const apt = appointments.find(a => a.id === id);
    if (apt) {
      apt.status = 'cancelled';
      apt.cancellationReason = reason || 'Avbestilt av bruker/admin';
      apt.updatedAt = new Date().toISOString();
      await this.saveAppointment(apt);
    }
  }

  // --- JOURNALER ---
  public async getJournalsForClient(clientId: string): Promise<JournalEntry[]> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'journals'));
        if (!snap.empty) {
          const allJournals = snap.docs.map(d => d.data() as JournalEntry);
          this.setLocal('journals', allJournals);
          return allJournals.filter(j => j.clientId === clientId);
        } else {
          const localJournals = this.getLocal<JournalEntry[]>('journals', []);
          if (localJournals.length > 0) {
            for (const j of localJournals) {
              await setDoc(doc(db, 'journals', j.id), j);
            }
            return localJournals.filter(j => j.clientId === clientId);
          }
        }
      } catch (e) {
        console.warn('Firebase error fetching journals:', e);
      }
    }
    const all = this.getLocal<JournalEntry[]>('journals', []);
    return all.filter(j => j.clientId === clientId);
  }

  public async saveJournalEntry(entry: JournalEntry): Promise<void> {
    const all = this.getLocal<JournalEntry[]>('journals', []);
    const idx = all.findIndex(j => j.id === entry.id);
    if (idx >= 0) {
      all[idx] = entry;
    } else {
      all.push(entry);
    }
    this.setLocal('journals', all);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'journals', entry.id), cleanForFirestore(entry));
      } catch (e) {
        console.error('Feil ved lagring av journal i Firestore:', e);
      }
    }
  }

  public async deleteJournalEntry(id: string): Promise<void> {
    let all = this.getLocal<JournalEntry[]>('journals', []);
    all = all.filter(j => j.id !== id);
    this.setLocal('journals', all);

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'journals', id));
      } catch (e) {
        console.error('Feil ved sletting av journal i Firestore:', e);
      }
    }
  }

  // --- SMS-INNSTILLINGER & LOGGER ---
  public async getSmsSettings(): Promise<SmsSettings> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDoc(doc(db, 'smsSettings', 'default'));
        if (snap.exists()) {
          const settings = snap.data() as SmsSettings;
          this.setLocal('sms_settings', settings);
          return settings;
        } else {
          await setDoc(doc(db, 'smsSettings', 'default'), DEFAULT_SMS_SETTINGS);
          this.setLocal('sms_settings', DEFAULT_SMS_SETTINGS);
          return DEFAULT_SMS_SETTINGS;
        }
      } catch (e) {
        console.warn('Firebase error fetching SMS settings:', e);
      }
    }
    return this.getLocal<SmsSettings>('sms_settings', DEFAULT_SMS_SETTINGS);
  }

  public async saveSmsSettings(settings: SmsSettings): Promise<void> {
    this.setLocal('sms_settings', settings);
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'smsSettings', 'default'), settings);
      } catch (e) {
        console.error('Kunne ikke lagre SMS-innstillinger til Firestore:', e);
      }
    }
  }

  public async getSmsLogs(): Promise<SmsLog[]> {
    return this.getLocal<SmsLog[]>('sms_logs', []);
  }

  public async logSms(log: SmsLog): Promise<void> {
    const logs = await this.getSmsLogs();
    logs.unshift(log);
    this.setLocal('sms_logs', logs.slice(0, 100)); // Bevar de 100 siste
  }

  // --- SMS MALER / STANDARDTEKSTER ---
  public async getSmsTemplates(): Promise<SmsTemplate[]> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'smsTemplates'));
        if (!snap.empty) {
          const list: SmsTemplate[] = [];
          snap.forEach(d => list.push(d.data() as SmsTemplate));
          this.setLocal('sms_templates', list);
          return list;
        }
      } catch (e) {
        console.warn('Firebase error fetching SMS templates:', e);
      }
    }
    return this.getLocal<SmsTemplate[]>('sms_templates', DEFAULT_SMS_TEMPLATES);
  }

  public async saveSmsTemplate(template: SmsTemplate): Promise<void> {
    const templates = await this.getSmsTemplates();
    const index = templates.findIndex(t => t.id === template.id);
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }
    this.setLocal('sms_templates', templates);
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'smsTemplates', template.id), cleanForFirestore(template));
      } catch (e) {
        console.error('Kunne ikke lagre SMS-mal i Firestore:', e);
      }
    }
  }

  public async deleteSmsTemplate(id: string): Promise<void> {
    const templates = await this.getSmsTemplates();
    const filtered = templates.filter(t => t.id !== id);
    this.setLocal('sms_templates', filtered);
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'smsTemplates', id));
      } catch (e) {
        console.error('Kunne ikke slette SMS-mal i Firestore:', e);
      }
    }
  }

  // --- SYSTEMLOGG (AUDIT TRAIL) ---
  public async getSystemLogs(): Promise<SystemAuditLog[]> {
    return this.getLocal<SystemAuditLog[]>('system_logs', []);
  }

  public async logAction(
    user: { uid: string; email: string; role: UserRole },
    action: SystemAuditLog['action'],
    details: string
  ): Promise<void> {
    const logEntry: SystemAuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userId: user.uid,
      userEmail: user.email,
      userRole: user.role,
      action,
      details
    };

    const logs = await this.getSystemLogs();
    logs.unshift(logEntry);
    this.setLocal('system_logs', logs.slice(0, 200));

    if (isFirebaseConfigured && db) {
      try {
        await addDoc(collection(db, 'systemLogs'), logEntry);
      } catch (e) {
        console.warn('Kunne ikke skrive systemlogg til Firestore:', e);
      }
    }
  }

  // --- FERIER & FRAVÆR ---
  public async getHolidays(): Promise<Holiday[]> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'holidays'));
        if (!snap.empty) {
          const holidays = snap.docs.map(d => ({ ...d.data(), id: d.id } as Holiday));
          this.setLocal('holidays', holidays);
          return holidays;
        }
      } catch (e) {
        console.warn('Firebase error fetching holidays:', e);
      }
    }
    return this.getLocal<Holiday[]>('holidays', []);
  }

  public async saveHoliday(holiday: Holiday): Promise<void> {
    const cleanHoliday = cleanForFirestore(holiday);
    const holidays = await this.getHolidays();
    const idx = holidays.findIndex(h => h.id === holiday.id);
    if (idx >= 0) {
      holidays[idx] = holiday;
    } else {
      holidays.push(holiday);
    }
    this.setLocal('holidays', holidays);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'holidays', holiday.id), cleanHoliday);
      } catch (e) {
        console.error('Kunne ikke lagre ferie til Firestore:', e);
      }
    }
  }

  public async deleteHoliday(holidayId: string): Promise<void> {
    const holidays = await this.getHolidays();
    const filtered = holidays.filter(h => h.id !== holidayId);
    this.setLocal('holidays', filtered);

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'holidays', holidayId));
      } catch (e) {
        console.error('Kunne ikke slette ferie fra Firestore:', e);
      }
    }
  }

  // Tilbakestill testdata
  public resetToDefaultSeed(): void {
    localStorage.removeItem(STORAGE_PREFIX + 'initialized');
    this.initSeedData();
  }
}

export const dbService = new DatabaseService();
