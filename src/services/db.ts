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
  sender: import.meta.env.VITE_GATEWAY_SENDER || 'Hovden',
  treatmentPlace: 'Hovden',
  reminder1Enabled: true,
  reminder1Hours: 24,
  reminder2Enabled: true,
  reminder2Hours: 1,
  bookingTemplate: 'Hei {kunde}! Din time hos {behandlingssted} er bekreftet: {dato} kl. {klokkeslett} ({varighet} min, kr {pris}). Avbestilling må skje senest 24t før. Velkommen!',
  reminderTemplate: 'Påminnelse fra {behandlingssted}: Du har time {dato} kl. {klokkeslett}. Velkommen!'
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
    message: 'Hei {kunde}! Din avtalte time hos {behandlingssted} er flyttet til ny dato: {ny_dato} kl. {nytt_klokkeslett}. Vennligst ta kontakt dersom tidspunktet ikke passer.'
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
    username: 'hovedadmin',
    password: 'demo1234',
    role: 'hovedadmin',
    displayName: 'Dr. Kari Nordmann',
    phone: '90011000',
    twoFactorEnabled: true,
    twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    uid: 'u_admin_full',
    email: 'admin.jonas@dintid.no',
    username: 'jonas',
    password: 'demo1234',
    role: 'admin',
    displayName: 'Jonas Berg',
    phone: '98822000',
    twoFactorEnabled: false,
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
    username: 'eva',
    password: 'demo1234',
    role: 'admin',
    displayName: 'Eva Lund',
    phone: '45533000',
    twoFactorEnabled: false,
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
    username: 'ola',
    password: 'demo1234',
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
    username: 'silje',
    password: 'demo1234',
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
  private memoryAppointments: Appointment[] | null = null;
  private memoryAppointmentsTime = 0;
  private memoryUsers: UserProfile[] | null = null;
  private memoryUsersTime = 0;
  private memoryWorkingHours: Map<string, { config: WorkingHoursConfig; timestamp: number }> = new Map();
  private memoryHolidays: Holiday[] | null = null;
  private memoryHolidaysTime = 0;

  private notifyDataUpdated(type: 'appointments' | 'users' | 'working_hours' | 'holidays') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dintid_data_updated', { detail: { type } }));
    }
  }

  private sanitizeUsers(list: UserProfile[]): UserProfile[] {
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
  }

  public getCachedUsers(): UserProfile[] {
    if (this.memoryUsers) {
      return this.memoryUsers;
    }
    const local = this.getLocal<UserProfile[]>('users', SEED_USERS);
    const cleaned = this.sanitizeUsers(local);
    this.memoryUsers = cleaned;
    return cleaned;
  }

  public getCachedAppointments(): Appointment[] {
    if (this.memoryAppointments) {
      return this.memoryAppointments;
    }
    const local = this.getLocal<Appointment[]>('appointments', []);
    this.memoryAppointments = local;
    return local;
  }

  public getCachedWorkingHours(therapistId?: string): WorkingHoursConfig {
    const docId = therapistId ? `wh_${therapistId}` : 'default';
    const storageKey = therapistId ? `working_hours_${therapistId}` : 'working_hours';

    const mem = this.memoryWorkingHours.get(docId);
    if (mem) {
      return mem.config;
    }

    const local = this.getLocal<WorkingHoursConfig | null>(storageKey, null);
    if (local) {
      const merged: WorkingHoursConfig = {
        ...DEFAULT_WORKING_HOURS,
        ...local,
        // Behold terapeuten sine faktiske arbeidsdager selv om listen er tom (f.eks. ved ferie/stengt)
        workDays: Array.isArray(local.workDays) ? local.workDays : DEFAULT_WORKING_HOURS.workDays,
        breaks: Array.isArray(local.breaks) ? local.breaks : DEFAULT_WORKING_HOURS.breaks,
        prices: { ...DEFAULT_WORKING_HOURS.prices, ...(local.prices || {}) },
        dailySchedules: local.dailySchedules ? { ...local.dailySchedules } : {},
        isScheduleApproved: !!local.isScheduleApproved,
        id: docId,
        therapistId: therapistId || local.therapistId
      };
      this.memoryWorkingHours.set(docId, { config: merged, timestamp: Date.now() });
      return merged;
    }

    const baseDefault = this.getLocal<WorkingHoursConfig>('working_hours', DEFAULT_WORKING_HOURS);
    const fallback: WorkingHoursConfig = {
      ...DEFAULT_WORKING_HOURS,
      ...baseDefault,
      workDays: Array.isArray(baseDefault.workDays) ? baseDefault.workDays : DEFAULT_WORKING_HOURS.workDays,
      breaks: Array.isArray(baseDefault.breaks) ? baseDefault.breaks : DEFAULT_WORKING_HOURS.breaks,
      prices: { ...DEFAULT_WORKING_HOURS.prices, ...(baseDefault.prices || {}) },
      dailySchedules: baseDefault.dailySchedules ? { ...baseDefault.dailySchedules } : {},
      isScheduleApproved: !!baseDefault.isScheduleApproved,
      id: docId,
      therapistId: therapistId || baseDefault.therapistId
    };
    this.memoryWorkingHours.set(docId, { config: fallback, timestamp: Date.now() });
    return fallback;
  }

  public getCachedHolidays(): Holiday[] {
    if (this.memoryHolidays) {
      return this.memoryHolidays;
    }
    const local = this.getLocal<Holiday[]>('holidays', []);
    this.memoryHolidays = local;
    return local;
  }

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
  public async getUsers(forceRefresh = false): Promise<UserProfile[]> {
    const now = Date.now();
    if (!forceRefresh && this.memoryUsers && (now - this.memoryUsersTime < 10000)) {
      return this.memoryUsers;
    }

    const cached = this.getCachedUsers();

    const fetchPromise = (async () => {
      if (isFirebaseConfigured && db) {
        try {
          const snap = await getDocs(collection(db, 'users'));
          if (!snap.empty) {
            const users = snap.docs.map(d => d.data() as UserProfile);
            const cleaned = this.sanitizeUsers(users);
            const hasChanged = JSON.stringify(cleaned) !== JSON.stringify(this.memoryUsers);
            this.memoryUsers = cleaned;
            this.memoryUsersTime = Date.now();
            this.setLocal('users', cleaned);
            if (hasChanged) {
              this.notifyDataUpdated('users');
            }
            return cleaned;
          } else {
            for (const u of SEED_USERS) {
              await setDoc(doc(db, 'users', u.uid), u);
            }
            this.memoryUsers = SEED_USERS;
            this.memoryUsersTime = Date.now();
            this.setLocal('users', SEED_USERS);
            return SEED_USERS;
          }
        } catch (e) {
          console.warn('Firebase feilet, faller tilbake til lokal lagring', e);
        }
      }
      this.memoryUsers = cached;
      this.memoryUsersTime = Date.now();
      return cached;
    })();

    if (cached.length > 0 && !forceRefresh) {
      fetchPromise.catch(console.error);
      return cached;
    }

    return await fetchPromise;
  }

  public async getUserById(uid: string): Promise<UserProfile | null> {
    const users = await this.getUsers();
    return users.find(u => u.uid === uid) || null;
  }

  public async saveUser(user: UserProfile): Promise<void> {
    const cleanUser = cleanForFirestore(user);
    const users = [...this.getCachedUsers()];
    const index = users.findIndex(u => u.uid === user.uid);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    this.memoryUsers = users;
    this.memoryUsersTime = Date.now();
    this.setLocal('users', users);
    this.notifyDataUpdated('users');

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'users', user.uid), cleanUser);
      } catch (e) {
        console.error('Kunne ikke lagre til Firestore:', e);
      }
    }
  }

  public async deleteUser(uid: string): Promise<void> {
    const users = this.getCachedUsers().filter(u => u.uid !== uid);
    this.memoryUsers = users;
    this.memoryUsersTime = Date.now();
    this.setLocal('users', users);
    this.notifyDataUpdated('users');

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
  public async getWorkingHours(therapistId?: string, forceRefresh = false): Promise<WorkingHoursConfig> {
    const docId = therapistId ? `wh_${therapistId}` : 'default';
    const storageKey = therapistId ? `working_hours_${therapistId}` : 'working_hours';
    const now = Date.now();

    const mem = this.memoryWorkingHours.get(docId);
    if (!forceRefresh && mem && (now - mem.timestamp < 10000)) {
      return mem.config;
    }

    const cached = this.getCachedWorkingHours(therapistId);

    const fetchPromise = (async () => {
      if (isFirebaseConfigured && db) {
        try {
          const snap = await getDoc(doc(db, 'workingHours', docId));

          if (snap.exists()) {
            const config = snap.data() as WorkingHoursConfig;
            const merged: WorkingHoursConfig = {
              ...DEFAULT_WORKING_HOURS,
              ...config,
              workDays: Array.isArray(config.workDays) ? config.workDays : DEFAULT_WORKING_HOURS.workDays,
              breaks: Array.isArray(config.breaks) ? config.breaks : DEFAULT_WORKING_HOURS.breaks,
              prices: { ...DEFAULT_WORKING_HOURS.prices, ...(config.prices || {}) },
              dailySchedules: config.dailySchedules ? { ...config.dailySchedules } : {},
              isScheduleApproved: !!config.isScheduleApproved,
              id: docId,
              therapistId: therapistId || config.therapistId
            };
            const previous = this.memoryWorkingHours.get(docId)?.config;
            const hasChanged = JSON.stringify(merged) !== JSON.stringify(previous);
            this.memoryWorkingHours.set(docId, { config: merged, timestamp: Date.now() });
            this.setLocal(storageKey, merged);
            if (hasChanged) {
              this.notifyDataUpdated('working_hours');
            }
            return merged;
          } else {
            // Hvis dokumentet ikke finnes i Firestore ennå:
            // Sjekk om vi allerede har et lokalt lagret oppsett for denne terapeuten
            const localSaved = this.getLocal<WorkingHoursConfig | null>(storageKey, null);
            if (localSaved) {
              // Last opp terapeuten sitt eksisterende lokale oppsett til Firestore i stedet for å overskrive med defaults
              const cleanConfig = cleanForFirestore({
                ...localSaved,
                id: docId,
                therapistId: therapistId || localSaved.therapistId
              });
              await setDoc(doc(db, 'workingHours', docId), cleanConfig).catch(e =>
                console.warn(`Kunne ikke initiere ${docId} i Firestore:`, e)
              );
              this.memoryWorkingHours.set(docId, { config: cleanConfig, timestamp: Date.now() });
              return cleanConfig;
            }

            // Hvis det heller ikke finnes noe lokalt for terapeuten, sjekk om det finnes klinikk-default i Firestore
            if (therapistId) {
              const defaultSnap = await getDoc(doc(db, 'workingHours', 'default')).catch(() => null);
              if (defaultSnap && defaultSnap.exists()) {
                const defData = defaultSnap.data() as WorkingHoursConfig;
                const cloned: WorkingHoursConfig = {
                  ...DEFAULT_WORKING_HOURS,
                  ...defData,
                  id: docId,
                  therapistId
                };
                this.memoryWorkingHours.set(docId, { config: cloned, timestamp: Date.now() });
                this.setLocal(storageKey, cloned);
                await setDoc(doc(db, 'workingHours', docId), cleanForFirestore(cloned)).catch(() => null);
                return cloned;
              }
            } else {
              // For selve 'default' klinikkoppsettet
              await setDoc(doc(db, 'workingHours', 'default'), cleanForFirestore(cached)).catch(() => null);
              this.memoryWorkingHours.set(docId, { config: cached, timestamp: Date.now() });
              this.setLocal('working_hours', cached);
              return cached;
            }
          }
        } catch (e) {
          console.warn('Firebase error fetching working hours, using cached fallback:', e);
        }
      }
      this.memoryWorkingHours.set(docId, { config: cached, timestamp: Date.now() });
      return cached;
    })();

    if (cached && !forceRefresh) {
      fetchPromise.catch(console.error);
      return cached;
    }

    return await fetchPromise;
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

    // 1. Alltid lagre i minne og LocalStorage umiddelbart
    this.memoryWorkingHours.set(docId, { config: cleanConfig, timestamp: Date.now() });
    this.setLocal(storageKey, cleanConfig);
    this.notifyDataUpdated('working_hours');

    // 2. Synkroniser til Firestore med robust feilhåndtering
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'workingHours', docId), cleanConfig);
      } catch (e) {
        console.error(`Kunne ikke lagre arbeidstid (${docId}) til Firestore:`, e);
      }
    }
  }

  // --- TIMEAVTALER (APPOINTMENTS) ---
  public async getAppointments(forceRefresh = false): Promise<Appointment[]> {
    const now = Date.now();
    if (!forceRefresh && this.memoryAppointments && (now - this.memoryAppointmentsTime < 10000)) {
      return this.memoryAppointments;
    }

    const cached = this.getCachedAppointments();

    const fetchPromise = (async () => {
      if (isFirebaseConfigured && db) {
        try {
          const snap = await getDocs(collection(db, 'appointments'));
          if (!snap.empty) {
            const apts = snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
            const hasChanged = JSON.stringify(apts) !== JSON.stringify(this.memoryAppointments);
            this.memoryAppointments = apts;
            this.memoryAppointmentsTime = Date.now();
            this.setLocal('appointments', apts);
            if (hasChanged) {
              this.notifyDataUpdated('appointments');
            }
            return apts;
          } else if (cached.length > 0) {
            for (const apt of cached) {
              await setDoc(doc(db, 'appointments', apt.id), apt);
            }
          }
        } catch (e) {
          console.warn('Firebase error fetching appointments:', e);
        }
      }
      this.memoryAppointments = cached;
      this.memoryAppointmentsTime = Date.now();
      return cached;
    })();

    if (cached.length > 0 && !forceRefresh) {
      fetchPromise.catch(console.error);
      return cached;
    }

    return await fetchPromise;
  }

  public async getAppointmentsByClient(clientId: string): Promise<Appointment[]> {
    const all = await this.getAppointments();
    return all.filter(a => a.clientId === clientId);
  }

  public async saveAppointment(apt: Appointment): Promise<void> {
    const cleanApt = cleanForFirestore(apt);
    const appointments = [...this.getCachedAppointments()];
    const idx = appointments.findIndex(a => a.id === apt.id);
    if (idx >= 0) {
      appointments[idx] = { ...apt, updatedAt: new Date().toISOString() };
    } else {
      appointments.push(apt);
    }
    this.memoryAppointments = appointments;
    this.memoryAppointmentsTime = Date.now();
    this.setLocal('appointments', appointments);
    this.notifyDataUpdated('appointments');

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
    const appointments = [...this.getCachedAppointments()];
    const apt = appointments.find(a => a.id === id);
    if (apt) {
      apt.status = 'cancelled';
      apt.cancellationReason = reason || 'Avbestilt av bruker/admin';
      apt.updatedAt = new Date().toISOString();
      this.memoryAppointments = appointments;
      this.memoryAppointmentsTime = Date.now();
      this.setLocal('appointments', appointments);
      this.notifyDataUpdated('appointments');

      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'appointments', apt.id), cleanForFirestore(apt));
        } catch (e) {
          console.error('Kunne ikke oppdatere avbestilling i Firestore:', e);
        }
      }
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
  public getSmsSettingsSync(): SmsSettings {
    return this.getLocal<SmsSettings>('sms_settings', DEFAULT_SMS_SETTINGS);
  }

  public async getSmsSettings(): Promise<SmsSettings> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDoc(doc(db, 'smsSettings', 'default'));
        if (snap.exists()) {
          const settings = snap.data() as SmsSettings;
          let changed = false;

          // Sørg for at behandlingssted er satt
          if (!settings.treatmentPlace) {
            settings.treatmentPlace = settings.sender || 'Hovden';
            changed = true;
          }

          // Fjern automatisk {avbestillingslenke} dersom den finnes, da GatewayAPI blokkerer ikke-hvitelistede lenker
          if (settings.bookingTemplate && settings.bookingTemplate.includes('{avbestillingslenke}')) {
            settings.bookingTemplate = settings.bookingTemplate
              .replace(/\s*Avbestilling:\s*\{avbestillingslenke\}/g, ' Avbestilling må skje senest 24t før. Velkommen!')
              .replace(/\{avbestillingslenke\}/g, '');
            changed = true;
          }
          if (settings.reminderTemplate && settings.reminderTemplate.includes('{motelenke}')) {
            settings.reminderTemplate = settings.reminderTemplate.replace(/\s*\{motelenke\}/g, '');
            changed = true;
          }

          // Migrer eksplisitt Tid1Din i maler til {behandlingssted}
          if (settings.bookingTemplate && settings.bookingTemplate.includes('Tid1Din')) {
            settings.bookingTemplate = settings.bookingTemplate
              .replace(/hos Tid1Din/gi, 'hos {behandlingssted}')
              .replace(/fra Tid1Din/gi, 'fra {behandlingssted}')
              .replace(/Tid1Din/g, '{behandlingssted}');
            changed = true;
          }
          if (settings.reminderTemplate && settings.reminderTemplate.includes('Tid1Din')) {
            settings.reminderTemplate = settings.reminderTemplate
              .replace(/hos Tid1Din/gi, 'hos {behandlingssted}')
              .replace(/fra Tid1Din/gi, 'fra {behandlingssted}')
              .replace(/Tid1Din/g, '{behandlingssted}');
            changed = true;
          }

          if (changed) {
            await this.saveSmsSettings(settings);
          }
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
  public async getHolidays(forceRefresh = false): Promise<Holiday[]> {
    const now = Date.now();
    if (!forceRefresh && this.memoryHolidays && (now - this.memoryHolidaysTime < 10000)) {
      return this.memoryHolidays;
    }

    const cached = this.getCachedHolidays();

    const fetchPromise = (async () => {
      if (isFirebaseConfigured && db) {
        try {
          const snap = await getDocs(collection(db, 'holidays'));
          if (!snap.empty) {
            const holidays = snap.docs.map(d => ({ ...d.data(), id: d.id } as Holiday));
            const hasChanged = JSON.stringify(holidays) !== JSON.stringify(this.memoryHolidays);
            this.memoryHolidays = holidays;
            this.memoryHolidaysTime = Date.now();
            this.setLocal('holidays', holidays);
            if (hasChanged) {
              this.notifyDataUpdated('holidays');
            }
            return holidays;
          }
        } catch (e) {
          console.warn('Firebase error fetching holidays:', e);
        }
      }
      this.memoryHolidays = cached;
      this.memoryHolidaysTime = Date.now();
      return cached;
    })();

    if (cached.length > 0 && !forceRefresh) {
      fetchPromise.catch(console.error);
      return cached;
    }

    return await fetchPromise;
  }

  public async saveHoliday(holiday: Holiday): Promise<void> {
    const cleanHoliday = cleanForFirestore(holiday);
    const holidays = [...this.getCachedHolidays()];
    const idx = holidays.findIndex(h => h.id === holiday.id);
    if (idx >= 0) {
      holidays[idx] = holiday;
    } else {
      holidays.push(holiday);
    }
    this.memoryHolidays = holidays;
    this.memoryHolidaysTime = Date.now();
    this.setLocal('holidays', holidays);
    this.notifyDataUpdated('holidays');

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'holidays', holiday.id), cleanHoliday);
      } catch (e) {
        console.error('Kunne ikke lagre ferie til Firestore:', e);
      }
    }
  }

  public async deleteHoliday(holidayId: string): Promise<void> {
    const holidays = this.getCachedHolidays().filter(h => h.id !== holidayId);
    this.memoryHolidays = holidays;
    this.memoryHolidaysTime = Date.now();
    this.setLocal('holidays', holidays);
    this.notifyDataUpdated('holidays');

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
