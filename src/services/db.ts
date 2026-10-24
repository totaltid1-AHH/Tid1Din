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
  UserRole,
  Company 
} from '../types';
import { encryptData, decryptData, hashPassword } from '../utils/crypto';
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

// Standard bedrift (pre-seed)
export const DEFAULT_COMPANY: Company = {
  id: 'comp_hovden',
  name: 'Hovden Terapi',
  treatmentPlace: 'Hovden',
  contactPerson: 'Dr. Kari Nordmann',
  contactPhone: '90011000',
  contactEmail: 'post@hovdenterapi.no',
  address: 'Hovdenvegen 1, 4755 Hovden',
  phone: '90011000',
  email: 'post@hovdenterapi.no',
  hovedadminUid: 'u_hovedadmin',
  hovedadminName: 'Dr. Kari Nordmann',
  hovedadminEmail: 'hovedadmin@dintid.no',
  hovedadminUsername: 'hovedadmin',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z'
};

// Initial pre-seed data
const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  id: 'default',
  companyId: 'comp_hovden',
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
  id: 'comp_hovden',
  companyId: 'comp_hovden',
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
    companyId: 'comp_hovden',
    title: '15 min forsinket',
    category: 'delay',
    isDefault: true,
    message: 'Hei {kunde}! Din behandler er dessverre ca. 15 minutter forsinket i dag ({dato}). Ny oppstartstid er ca. kl. {nytt_klokkeslett}. Beklager ulempen!'
  },
  {
    id: 'tpl_delay_30',
    companyId: 'comp_hovden',
    title: '30 min forsinket',
    category: 'delay',
    isDefault: true,
    message: 'Hei {kunde}! Din behandler er dessverre ca. 30 minutter forsinket i dag ({dato}). Ny oppstartstid er ca. kl. {nytt_klokkeslett}. Beklager ulempen!'
  },
  {
    id: 'tpl_reschedule',
    companyId: 'comp_hovden',
    title: 'Flytting / Ombooking av time',
    category: 'reschedule',
    isDefault: true,
    message: 'Hei {kunde}! Din avtalte time hos {behandlingssted} er flyttet til ny dato: {ny_dato} kl. {nytt_klokkeslett}. Vennligst ta kontakt dersom tidspunktet ikke passer.'
  },
  {
    id: 'tpl_welcome',
    companyId: 'comp_hovden',
    title: 'Oppmøte / Velkommen',
    category: 'info',
    isDefault: true,
    message: 'Hei {kunde}! Vi minner om timen din i dag ({dato}) kl. {klokkeslett}. Vennligst benytt venterommet ved ankomst. Velkommen!'
  },
  {
    id: 'tpl_online',
    companyId: 'comp_hovden',
    title: 'Videomøte / Online time',
    category: 'info',
    isDefault: true,
    message: 'Hei {kunde}! Her er lenken til din online konsultasjon i dag kl. {klokkeslett}: {motelenke}. Velkommen!'
  }
];

// Startverdier for brukere
const SEED_USERS: UserProfile[] = [
  {
    uid: 'u_superadmin_total',
    email: 'total.tid1@gmail.com',
    username: 'superadmin',
    password: 'demo1234',
    role: 'superadmin',
    displayName: 'Super Administrator',
    twoFactorEnabled: false,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    uid: 'u_hovedadmin',
    companyId: 'comp_hovden',
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
    companyId: 'comp_hovden',
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
    companyId: 'comp_hovden',
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
    companyId: 'comp_hovden',
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
    companyId: 'comp_hovden',
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
  private memoryCompanies: Company[] | null = null;
  private memoryCompaniesTime = 0;
  private activeCompanyId: string = 'comp_hovden';

  private memoryAppointments: Appointment[] | null = null;
  private memoryAppointmentsTime = 0;
  private memoryUsers: UserProfile[] | null = null;
  private memoryUsersTime = 0;
  private memoryWorkingHours: Map<string, { config: WorkingHoursConfig; timestamp: number }> = new Map();
  private memoryHolidays: Holiday[] | null = null;
  private memoryHolidaysTime = 0;

  private notifyDataUpdated(type: 'appointments' | 'users' | 'working_hours' | 'holidays' | 'companies') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dintid_data_updated', { detail: { type } }));
    }
  }

  // --- AKTIV BEDRIFT (MULTI-TENANT CONTEXT) ---
  public getActiveCompanyId(): string {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dintid_active_company_id');
        if (saved) return saved;
      } catch {}
    }
    return this.activeCompanyId || 'comp_hovden';
  }

  public setActiveCompanyId(companyId: string): void {
    this.activeCompanyId = companyId;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dintid_active_company_id', companyId);
      } catch {}
    }
    this.notifyDataUpdated('companies');
  }

  // --- BEDRIFTER (COMPANIES) ---
  public getCachedCompanies(): Company[] {
    if (this.memoryCompanies) {
      return this.memoryCompanies;
    }
    const local = this.getLocal<Company[]>('companies', [DEFAULT_COMPANY]);
    this.memoryCompanies = local;
    return local;
  }

  public async getCompanies(forceRefresh = false): Promise<Company[]> {
    const now = Date.now();
    if (!forceRefresh && this.memoryCompanies && (now - this.memoryCompaniesTime < 10000)) {
      return this.memoryCompanies;
    }

    const cached = this.getCachedCompanies();

    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'companies'));
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Company));
          this.memoryCompanies = list;
          this.memoryCompaniesTime = Date.now();
          this.setLocal('companies', list);
          return list;
        } else {
          await setDoc(doc(db, 'companies', DEFAULT_COMPANY.id), cleanForFirestore(DEFAULT_COMPANY));
          this.memoryCompanies = [DEFAULT_COMPANY];
          this.memoryCompaniesTime = Date.now();
          this.setLocal('companies', [DEFAULT_COMPANY]);
          return [DEFAULT_COMPANY];
        }
      } catch (e) {
        console.warn('Firebase feilet ved henting av bedrifter, bruker lokal cache:', e);
      }
    }

    this.memoryCompanies = cached;
    this.memoryCompaniesTime = Date.now();
    return cached;
  }

  public async getCompanyById(id: string): Promise<Company | null> {
    const companies = await this.getCompanies();
    return companies.find(c => c.id === id) || null;
  }

  public async saveCompany(company: Company): Promise<void> {
    const cleanCompany = cleanForFirestore(company);
    const companies = [...this.getCachedCompanies()];
    const index = companies.findIndex(c => c.id === company.id);
    if (index >= 0) {
      companies[index] = { ...company, updatedAt: new Date().toISOString() };
    } else {
      companies.push(company);
    }
    this.memoryCompanies = companies;
    this.memoryCompaniesTime = Date.now();
    this.setLocal('companies', companies);
    this.notifyDataUpdated('companies');

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'companies', company.id), cleanCompany);
      } catch (e) {
        console.error('Kunne ikke lagre bedrift til Firestore:', e);
      }
    }
  }

  public async deleteCompany(id: string): Promise<void> {
    const companies = this.getCachedCompanies().filter(c => c.id !== id);
    this.memoryCompanies = companies;
    this.memoryCompaniesTime = Date.now();
    this.setLocal('companies', companies);
    this.notifyDataUpdated('companies');

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'companies', id));
      } catch (e) {
        console.error('Kunne ikke slette bedrift fra Firestore:', e);
      }
    }
  }

  private sanitizeUsers(list: UserProfile[]): UserProfile[] {
    return list.map(u => {
      const base = {
        ...u,
        isActive: u.isActive !== false
      };
      if (u.role === 'admin' || u.role === 'hovedadmin' || u.role === 'superadmin') {
        return {
          ...base,
          displayName: u.displayName.replace(/\s*\([^)]*\)/g, '').trim()
        };
      }
      return base;
    });
  }

  public getCachedAllUsers(): UserProfile[] {
    if (this.memoryUsers) {
      return this.memoryUsers;
    }
    const local = this.getLocal<UserProfile[]>('users', SEED_USERS);
    // Sikre at superadmin total.tid1@gmail.com alltid er tilgjengelig
    if (!local.some(u => u.email.toLowerCase() === 'total.tid1@gmail.com')) {
      const superSeed = SEED_USERS.find(u => u.uid === 'u_superadmin_total');
      if (superSeed) {
        local.unshift(superSeed);
        this.setLocal('users', local);
      }
    }
    const cleaned = this.sanitizeUsers(local);
    this.memoryUsers = cleaned;
    return cleaned;
  }

  public getCachedUsers(filterCompanyId?: string): UserProfile[] {
    const all = this.getCachedAllUsers();
    if (filterCompanyId === 'all') {
      return all;
    }
    const target = filterCompanyId || this.getActiveCompanyId();
    return all.filter(u => u.companyId === target || (!u.companyId && target === 'comp_hovden'));
  }

  public getCachedAppointments(filterCompanyId?: string): Appointment[] {
    const local = this.getLocal<Appointment[]>('appointments', []);
    this.memoryAppointments = local;
    if (filterCompanyId === 'all') {
      return local;
    }
    const target = filterCompanyId || this.getActiveCompanyId();
    return local.filter(a => a.companyId === target || (!a.companyId && target === 'comp_hovden'));
  }

  public getCachedWorkingHours(therapistId?: string, companyId?: string): WorkingHoursConfig {
    const targetCompany = companyId || this.getActiveCompanyId();
    const docId = therapistId ? `wh_${therapistId}` : `wh_${targetCompany}`;
    const storageKey = therapistId ? `working_hours_${therapistId}` : `working_hours_${targetCompany}`;

    const mem = this.memoryWorkingHours.get(docId);
    if (mem) {
      return mem.config;
    }

    const local = this.getLocal<WorkingHoursConfig | null>(storageKey, null);
    if (local) {
      const merged: WorkingHoursConfig = {
        ...DEFAULT_WORKING_HOURS,
        ...local,
        companyId: targetCompany,
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
      companyId: targetCompany,
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

  public getCachedHolidays(filterCompanyId?: string): Holiday[] {
    const local = this.getLocal<Holiday[]>('holidays', []);
    this.memoryHolidays = local;
    if (filterCompanyId === 'all') {
      return local;
    }
    const target = filterCompanyId || this.getActiveCompanyId();
    return local.filter(h => h.companyId === target || (!h.companyId && target === 'comp_hovden'));
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
      this.setLocal('companies', [DEFAULT_COMPANY]);
      this.setLocal('users', SEED_USERS);
      this.setLocal('working_hours', DEFAULT_WORKING_HOURS);
      this.setLocal('sms_settings', DEFAULT_SMS_SETTINGS);
      this.setLocal('holidays', []);
      this.setLocal('sms_logs', []);
      this.setLocal('system_logs', [
        {
          id: 'log_' + Date.now(),
          companyId: 'comp_hovden',
          timestamp: new Date().toISOString(),
          userId: 'u_superadmin_total',
          userEmail: 'total.tid1@gmail.com',
          userRole: 'superadmin',
          action: 'login',
          details: 'Systemet initialisert med standard flerbedriftskonfigurasjon'
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
          companyId: 'comp_hovden',
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
          companyId: 'comp_hovden',
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

  // --- BRUKERE PÅ TVERS AV BEDRIFTER ---
  public async getAllUsers(forceRefresh = false): Promise<UserProfile[]> {
    const now = Date.now();
    if (!forceRefresh && this.memoryUsers && (now - this.memoryUsersTime < 10000)) {
      return this.memoryUsers;
    }

    const cached = this.getCachedAllUsers();

    const fetchPromise = (async () => {
      if (isFirebaseConfigured && db) {
        try {
          const snap = await getDocs(collection(db, 'users'));
          if (!snap.empty) {
            const users = snap.docs.map(d => d.data() as UserProfile);
            // Sørg for at superadmin total.tid1@gmail.com er lagret i Firestore
            if (!users.some(u => u.email.toLowerCase() === 'total.tid1@gmail.com')) {
              const superSeed = SEED_USERS.find(u => u.uid === 'u_superadmin_total');
              if (superSeed) {
                users.unshift(superSeed);
                await setDoc(doc(db, 'users', superSeed.uid), cleanForFirestore(superSeed)).catch(() => null);
              }
            }
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
              await setDoc(doc(db, 'users', u.uid), cleanForFirestore(u));
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

  // Hent brukere for en bestemt bedrift (eller aktiv bedrift som default, eller alle hvis 'all')
  public async getUsers(
    filterCompanyIdOrForceRefresh?: string | boolean, 
    forceRefresh = false
  ): Promise<UserProfile[]> {
    const isBool = typeof filterCompanyIdOrForceRefresh === 'boolean';
    const actualForceRefresh = isBool ? filterCompanyIdOrForceRefresh : forceRefresh;
    const filterCompanyId = isBool ? undefined : filterCompanyIdOrForceRefresh;

    const all = await this.getAllUsers(actualForceRefresh);
    if (filterCompanyId === 'all') {
      return all;
    }
    const target = filterCompanyId || this.getActiveCompanyId();
    return all.filter(u => u.companyId === target || (!u.companyId && target === 'comp_hovden'));
  }

  public async getUserById(uid: string): Promise<UserProfile | null> {
    const users = await this.getAllUsers();
    return users.find(u => u.uid === uid) || null;
  }

  public async saveUser(user: UserProfile): Promise<void> {
    // Sørg for at ikke-superadmin brukere alltid har en companyId
    if (!user.companyId && user.role !== 'superadmin') {
      user.companyId = this.getActiveCompanyId();
    }

    // Hash passord med PBKDF2 dersom det er oppgitt i klartekst
    if (user.password && !user.password.startsWith('PBKDF2:')) {
      try {
        user.password = await hashPassword(user.password);
      } catch (e) {
        console.warn('Kunne ikke hashe passord, beholder verdi:', e);
      }
    }

    const cleanUser = cleanForFirestore(user);
    const users = [...this.getCachedAllUsers()];
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
    const users = this.getCachedAllUsers().filter(u => u.uid !== uid);
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
  public async getNextCustomerNumber(companyId?: string): Promise<number> {
    const users = await this.getUsers(companyId);
    const clientNumbers = users
      .filter(u => u.role === 'client' && typeof u.customerNumber === 'number')
      .map(u => u.customerNumber as number);

    if (clientNumbers.length === 0) return 1000;
    const max = Math.max(...clientNumbers);
    return Math.max(1000, max + 1);
  }

  // --- ARBEIDSTID & INNSTILLINGER ---
  public async getWorkingHours(therapistId?: string, companyId?: string, forceRefresh = false): Promise<WorkingHoursConfig> {
    const targetCompany = companyId || this.getActiveCompanyId();
    const docId = therapistId ? `wh_${therapistId}` : `wh_${targetCompany}`;
    const storageKey = therapistId ? `working_hours_${therapistId}` : `working_hours_${targetCompany}`;
    const now = Date.now();

    const mem = this.memoryWorkingHours.get(docId);
    if (!forceRefresh && mem && (now - mem.timestamp < 10000)) {
      return mem.config;
    }

    const cached = this.getCachedWorkingHours(therapistId, targetCompany);

    const fetchPromise = (async () => {
      if (isFirebaseConfigured && db) {
        try {
          const snap = await getDoc(doc(db, 'workingHours', docId));

          if (snap.exists()) {
            const config = snap.data() as WorkingHoursConfig;
            const merged: WorkingHoursConfig = {
              ...DEFAULT_WORKING_HOURS,
              ...config,
              companyId: targetCompany,
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
            const localSaved = this.getLocal<WorkingHoursConfig | null>(storageKey, null);
            if (localSaved) {
              const cleanConfig = cleanForFirestore({
                ...localSaved,
                companyId: targetCompany,
                id: docId,
                therapistId: therapistId || localSaved.therapistId
              });
              await setDoc(doc(db, 'workingHours', docId), cleanConfig).catch(e =>
                console.warn(`Kunne ikke initiere ${docId} i Firestore:`, e)
              );
              this.memoryWorkingHours.set(docId, { config: cleanConfig, timestamp: Date.now() });
              return cleanConfig;
            }

            if (therapistId) {
              const defaultSnap = await getDoc(doc(db, 'workingHours', `wh_${targetCompany}`)).catch(() => null);
              if (defaultSnap && defaultSnap.exists()) {
                const defData = defaultSnap.data() as WorkingHoursConfig;
                const cloned: WorkingHoursConfig = {
                  ...DEFAULT_WORKING_HOURS,
                  ...defData,
                  companyId: targetCompany,
                  id: docId,
                  therapistId
                };
                this.memoryWorkingHours.set(docId, { config: cloned, timestamp: Date.now() });
                this.setLocal(storageKey, cloned);
                await setDoc(doc(db, 'workingHours', docId), cleanForFirestore(cloned)).catch(() => null);
                return cloned;
              }
            } else {
              await setDoc(doc(db, 'workingHours', docId), cleanForFirestore(cached)).catch(() => null);
              this.memoryWorkingHours.set(docId, { config: cached, timestamp: Date.now() });
              this.setLocal(storageKey, cached);
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

  public async saveWorkingHours(config: WorkingHoursConfig, therapistId?: string, companyId?: string): Promise<void> {
    const targetCompany = companyId || config.companyId || this.getActiveCompanyId();
    const targetTherapistId = therapistId || config.therapistId;
    const docId = targetTherapistId ? `wh_${targetTherapistId}` : `wh_${targetCompany}`;
    const storageKey = targetTherapistId ? `working_hours_${targetTherapistId}` : `working_hours_${targetCompany}`;

    const cleanConfig = cleanForFirestore({
      ...config,
      companyId: targetCompany,
      id: docId,
      therapistId: targetTherapistId || undefined
    });

    this.memoryWorkingHours.set(docId, { config: cleanConfig, timestamp: Date.now() });
    this.setLocal(storageKey, cleanConfig);
    this.notifyDataUpdated('working_hours');

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'workingHours', docId), cleanConfig);
      } catch (e) {
        console.error(`Kunne ikke lagre arbeidstid (${docId}) til Firestore:`, e);
      }
    }
  }

  // --- TIMEAVTALER (APPOINTMENTS) ---
  public async getAppointments(
    filterCompanyIdOrForceRefresh?: string | boolean, 
    forceRefresh = false
  ): Promise<Appointment[]> {
    const isBool = typeof filterCompanyIdOrForceRefresh === 'boolean';
    const actualForceRefresh = isBool ? filterCompanyIdOrForceRefresh : forceRefresh;
    const filterCompanyId = isBool ? undefined : filterCompanyIdOrForceRefresh;

    const target = filterCompanyId || this.getActiveCompanyId();
    const now = Date.now();
    if (!actualForceRefresh && this.memoryAppointments && (now - this.memoryAppointmentsTime < 10000)) {
      if (filterCompanyId === 'all') return this.memoryAppointments;
      return this.memoryAppointments.filter(a => a.companyId === target || (!a.companyId && target === 'comp_hovden'));
    }

    const cached = this.getCachedAppointments(filterCompanyId);

    const fetchPromise = (async () => {
      if (isFirebaseConfigured && db) {
        try {
          const appointmentsQuery = filterCompanyId === 'all'
            ? collection(db, 'appointments')
            : query(collection(db, 'appointments'), where('companyId', '==', target));

          const snap = await getDocs(appointmentsQuery);
          if (!snap.empty) {
            const apts = snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
            const existingAll = this.getLocal<Appointment[]>('appointments', []);
            let merged = [...existingAll];
            if (filterCompanyId === 'all') {
              merged = apts;
            } else {
              merged = merged.filter(a => a.companyId !== target).concat(apts);
            }
            const hasChanged = JSON.stringify(merged) !== JSON.stringify(this.memoryAppointments);
            this.memoryAppointments = merged;
            this.memoryAppointmentsTime = Date.now();
            this.setLocal('appointments', merged);
            if (hasChanged) {
              this.notifyDataUpdated('appointments');
            }
            if (filterCompanyId === 'all') return merged;
            return merged.filter(a => a.companyId === target || (!a.companyId && target === 'comp_hovden'));
          } else if (cached.length > 0) {
            for (const apt of cached) {
              await setDoc(doc(db, 'appointments', apt.id), cleanForFirestore(apt));
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

    if (cached.length > 0 && !actualForceRefresh) {
      fetchPromise.catch(console.error);
      return cached;
    }

    return await fetchPromise;
  }

  public async getAppointmentsByClient(clientId: string): Promise<Appointment[]> {
    if (isFirebaseConfigured && db) {
      try {
        const q = query(collection(db, 'appointments'), where('clientId', '==', clientId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const apts = snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
          const existing = this.getLocal<Appointment[]>('appointments', []);
          const merged = existing.filter(a => a.clientId !== clientId).concat(apts);
          this.setLocal('appointments', merged);
          return apts;
        }
      } catch (e) {
        console.warn('Firebase error fetching client appointments:', e);
      }
    }
    const all = this.getCachedAppointments('all');
    return all.filter(a => a.clientId === clientId);
  }

  public async saveAppointment(apt: Appointment): Promise<void> {
    if (!apt.companyId) {
      apt.companyId = this.getActiveCompanyId();
    }

    const cleanApt = cleanForFirestore(apt);
    const appointments = [...this.getCachedAppointments('all')];
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
    const appointments = [...this.getCachedAppointments('all')];
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
        const q = query(collection(db, 'journals'), where('clientId', '==', clientId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const clientJournals = snap.docs.map(d => ({ ...d.data(), id: d.id } as JournalEntry));
          const allCached = this.getLocal<JournalEntry[]>('journals', []);
          const others = allCached.filter(j => j.clientId !== clientId);
          this.setLocal('journals', [...others, ...clientJournals]);
          return clientJournals;
        } else {
          const localJournals = this.getLocal<JournalEntry[]>('journals', []);
          return localJournals.filter(j => j.clientId === clientId);
        }
      } catch (e) {
        console.warn('Firebase error fetching journals:', e);
      }
    }
    const all = this.getLocal<JournalEntry[]>('journals', []);
    return all.filter(j => j.clientId === clientId);
  }

  public async saveJournalEntry(entry: JournalEntry): Promise<void> {
    if (!entry.companyId) {
      entry.companyId = this.getActiveCompanyId();
    }

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
  public getGlobalSmsApiKey(): string {
    const fromStorage = this.getLocal<string>('global_gatewayapi_key', '');
    if (fromStorage) return fromStorage;
    const hovden = this.getLocal<SmsSettings>('sms_settings_comp_hovden', null as any);
    if (hovden?.apiKey) return hovden.apiKey;
    return import.meta.env.VITE_GATEWAY_API_KEY || '';
  }

  public async setGlobalSmsApiKey(apiKey: string): Promise<void> {
    const cleanKey = apiKey.trim();
    this.setLocal('global_gatewayapi_key', cleanKey);
    const hovden = await this.getSmsSettings('comp_hovden');
    hovden.apiKey = cleanKey;
    await this.saveSmsSettings(hovden, 'comp_hovden');

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'systemConfig', 'global_sms'), { apiKey: cleanKey, updatedAt: new Date().toISOString() });
      } catch (e) {
        console.warn('Kunne ikke lagre global API-nøkkel til Firestore:', e);
      }
    }
  }

  public getSmsSettingsSync(companyId?: string): SmsSettings {
    const target = companyId || this.getActiveCompanyId();
    const globalKey = this.getGlobalSmsApiKey();
    const res = this.getLocal<SmsSettings>(`sms_settings_${target}`, {
      ...DEFAULT_SMS_SETTINGS,
      id: target,
      companyId: target
    });
    if (!res.apiKey) res.apiKey = globalKey;
    return res;
  }

  public async getSmsSettings(companyId?: string): Promise<SmsSettings> {
    const target = companyId || this.getActiveCompanyId();
    const storageKey = `sms_settings_${target}`;
    const globalKey = this.getGlobalSmsApiKey();

    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDoc(doc(db, 'smsSettings', target));
        if (snap.exists()) {
          const settings = snap.data() as SmsSettings;
          let changed = false;

          if (!settings.treatmentPlace) {
            const comp = await this.getCompanyById(target);
            settings.treatmentPlace = comp?.treatmentPlace || settings.sender || 'Hovden';
            changed = true;
          }

          if (!settings.apiKey && globalKey) {
            settings.apiKey = globalKey;
          }

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

          if (changed) {
            await this.saveSmsSettings(settings, target);
          }
          this.setLocal(storageKey, settings);
          return settings;
        } else {
          // Generer default tilpasset bedriften
          const comp = await this.getCompanyById(target);
          const defaultSettings: SmsSettings = {
            ...DEFAULT_SMS_SETTINGS,
            id: target,
            companyId: target,
            apiKey: globalKey || DEFAULT_SMS_SETTINGS.apiKey,
            sender: comp?.treatmentPlace || DEFAULT_SMS_SETTINGS.sender,
            treatmentPlace: comp?.treatmentPlace || comp?.name || 'Hovden'
          };
          await setDoc(doc(db, 'smsSettings', target), cleanForFirestore(defaultSettings)).catch(() => null);
          this.setLocal(storageKey, defaultSettings);
          return defaultSettings;
        }
      } catch (e) {
        console.warn('Firebase error fetching SMS settings:', e);
      }
    }
    const local = this.getLocal<SmsSettings>(storageKey, DEFAULT_SMS_SETTINGS);
    if (!local.apiKey && globalKey) local.apiKey = globalKey;
    return local;
  }

  public async saveSmsSettings(settings: SmsSettings, companyId?: string): Promise<void> {
    const target = companyId || settings.companyId || this.getActiveCompanyId();
    const updated = { ...settings, id: target, companyId: target };
    this.setLocal(`sms_settings_${target}`, updated);
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'smsSettings', target), cleanForFirestore(updated));
      } catch (e) {
        console.error('Kunne ikke lagre SMS-innstillinger til Firestore:', e);
      }
    }
  }

  public async getSmsLogs(companyId?: string): Promise<SmsLog[]> {
    const target = companyId || this.getActiveCompanyId();
    const all = this.getLocal<SmsLog[]>('sms_logs', []);
    if (companyId === 'all') return all;
    return all.filter(l => l.companyId === target || (!l.companyId && target === 'comp_hovden'));
  }

  public async logSms(log: SmsLog): Promise<void> {
    if (!log.companyId) {
      log.companyId = this.getActiveCompanyId();
    }
    const logs = this.getLocal<SmsLog[]>('sms_logs', []);
    logs.unshift(log);
    this.setLocal('sms_logs', logs.slice(0, 200));
  }

  // --- SMS MALER / STANDARDTEKSTER ---
  public async getSmsTemplates(companyId?: string): Promise<SmsTemplate[]> {
    const target = companyId || this.getActiveCompanyId();
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'smsTemplates'));
        if (!snap.empty) {
          const list: SmsTemplate[] = [];
          snap.forEach(d => list.push(d.data() as SmsTemplate));
          this.setLocal('sms_templates', list);
          if (companyId === 'all') return list;
          return list.filter(t => t.companyId === target || (!t.companyId && target === 'comp_hovden'));
        }
      } catch (e) {
        console.warn('Firebase error fetching SMS templates:', e);
      }
    }
    const all = this.getLocal<SmsTemplate[]>('sms_templates', DEFAULT_SMS_TEMPLATES);
    if (companyId === 'all') return all;
    return all.filter(t => t.companyId === target || (!t.companyId && target === 'comp_hovden'));
  }

  public async saveSmsTemplate(template: SmsTemplate): Promise<void> {
    if (!template.companyId) {
      template.companyId = this.getActiveCompanyId();
    }
    const templates = this.getLocal<SmsTemplate[]>('sms_templates', DEFAULT_SMS_TEMPLATES);
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
    const templates = this.getLocal<SmsTemplate[]>('sms_templates', DEFAULT_SMS_TEMPLATES);
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
  public async getSystemLogs(companyId?: string): Promise<SystemAuditLog[]> {
    const target = companyId || this.getActiveCompanyId();
    const all = this.getLocal<SystemAuditLog[]>('system_logs', []);
    if (companyId === 'all') return all;
    return all.filter(l => l.companyId === target || (!l.companyId && target === 'comp_hovden'));
  }

  public async logAction(
    user: { uid: string; email: string; role: UserRole },
    action: SystemAuditLog['action'],
    details: string,
    companyId?: string
  ): Promise<void> {
    const target = companyId || this.getActiveCompanyId();
    const logEntry: SystemAuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      companyId: target,
      timestamp: new Date().toISOString(),
      userId: user.uid,
      userEmail: user.email,
      userRole: user.role,
      action,
      details
    };

    const logs = this.getLocal<SystemAuditLog[]>('system_logs', []);
    logs.unshift(logEntry);
    this.setLocal('system_logs', logs.slice(0, 300));

    if (isFirebaseConfigured && db) {
      try {
        await addDoc(collection(db, 'systemLogs'), cleanForFirestore(logEntry));
      } catch (e) {
        console.warn('Kunne ikke skrive systemlogg til Firestore:', e);
      }
    }
  }

  // --- FERIER & FRAVÆR ---
  public async getHolidays(
    filterCompanyIdOrForceRefresh?: string | boolean, 
    forceRefresh = false
  ): Promise<Holiday[]> {
    const isBool = typeof filterCompanyIdOrForceRefresh === 'boolean';
    const actualForceRefresh = isBool ? filterCompanyIdOrForceRefresh : forceRefresh;
    const filterCompanyId = isBool ? undefined : filterCompanyIdOrForceRefresh;

    const target = filterCompanyId || this.getActiveCompanyId();
    const now = Date.now();
    if (!actualForceRefresh && this.memoryHolidays && (now - this.memoryHolidaysTime < 10000)) {
      if (filterCompanyId === 'all') return this.memoryHolidays;
      return this.memoryHolidays.filter(h => h.companyId === target || (!h.companyId && target === 'comp_hovden'));
    }

    const cached = this.getCachedHolidays(filterCompanyId);

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
            if (filterCompanyId === 'all') return holidays;
            return holidays.filter(h => h.companyId === target || (!h.companyId && target === 'comp_hovden'));
          }
        } catch (e) {
          console.warn('Firebase error fetching holidays:', e);
        }
      }
      this.memoryHolidays = cached;
      this.memoryHolidaysTime = Date.now();
      return cached;
    })();

    if (cached.length > 0 && !actualForceRefresh) {
      fetchPromise.catch(console.error);
      return cached;
    }

    return await fetchPromise;
  }

  public async saveHoliday(holiday: Holiday): Promise<void> {
    if (!holiday.companyId) {
      holiday.companyId = this.getActiveCompanyId();
    }
    const cleanHoliday = cleanForFirestore(holiday);
    const holidays = [...this.getCachedHolidays('all')];
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
    const holidays = this.getCachedHolidays('all').filter(h => h.id !== holidayId);
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
