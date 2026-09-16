export type UserRole = 'hovedadmin' | 'admin' | 'client';

export interface AdminPermissions {
  canViewClientName: boolean;
  canViewClientPhone: boolean;
  canViewClientEmail: boolean;
  canEditJournals: boolean;
  canManageAppointments: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  customerNumber?: number; // Starter på 1000 for klienter
  notes?: string;
  permissions?: AdminPermissions; // Kun for 'admin'
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  isActive?: boolean; // false = inaktiv / permisjon, default true
  leaveStartDate?: string; // YYYY-MM-DD
  leaveEndDate?: string;   // YYYY-MM-DD
  createdAt: string;
  updatedAt?: string;
}

export interface SlotTypeOption {
  type: 'single' | 'double' | 'triple';
  title: string;
  durationMinutes: number; // 45, 90, 135
  price: number;
}

export interface DailySchedule {
  isOpen: boolean;       // Om dagen er aktiv arbeidsdag
  startTime: string;     // f.eks. "08:00"
  endTime: string;       // f.eks. "16:00"
}

export interface WorkingHoursConfig {
  id: string;
  therapistId?: string;
  workDays: number[]; // 1=Mandag, 2=Tirsdag, etc.
  startTime: string; // f.eks. "08:00"
  endTime: string;   // f.eks. "16:00"
  slotDurationMinutes: number; // Standard 45 min
  breakBetweenMinutes: number; // Standard 15 min
  breaks: {
    start: string; // f.eks. "11:30"
    end: string;   // f.eks. "12:00"
    title?: string;
  }[];
  prices: {
    single: number; // Enkelttime (45 min)
    double: number; // Dobbelttime (90 min)
    triple: number; // Trippaltime (135 min)
  };
  isScheduleApproved?: boolean; // True når kalenderen er godkjent og låst
  dailySchedules?: Record<string, DailySchedule>; // Nøkkel "YYYY-MM-DD"
}

export interface Holiday {
  id: string;
  therapistId?: string; // Hvis tom/udefinert, gjelder alle/klinikk
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  allDay: boolean;
}

export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  clientId: string;
  clientNumber: number;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  therapistId?: string;
  therapistName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  slotType: 'single' | 'double' | 'triple';
  price: number;
  isOnline: boolean;
  meetingLink?: string;
  status: AppointmentStatus;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface JournalRevision {
  id: string;
  timestamp: string;
  modifiedBy: string;
  modifiedById: string;
  previousContentPreview: string;
  changeNote?: string;
}

export interface JournalEntry {
  id: string;
  clientId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string; // Krypteres ved lagring
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string;
  lastModifiedById: string;
  revisionHistory: JournalRevision[];
  appointmentId?: string;
  sessionDate?: string; // YYYY-MM-DD
  sessionTime?: string; // HH:mm
}

export interface SmsTemplate {
  id: string;
  title: string;
  message: string;
  category?: 'delay' | 'reschedule' | 'info' | 'custom';
  isDefault?: boolean;
}

export interface SmsSettings {
  id: string;
  apiKey: string;
  sender: string;
  reminder1Enabled: boolean;
  reminder1Hours: number; // f.eks. 24
  reminder2Enabled: boolean;
  reminder2Hours: number; // f.eks. 1
  bookingTemplate: string;
  reminderTemplate: string;
}

export interface SmsLog {
  id: string;
  timestamp: string;
  recipientPhone: string;
  message: string;
  status: 'sent' | 'failed' | 'simulated';
  type: 'booking' | 'reminder1' | 'reminder2' | 'cancellation' | 'delay' | 'reschedule' | 'custom';
  appointmentId?: string;
  response?: string;
}

export type AuditAction = 
  | 'login'
  | 'logout'
  | '2fa_verified'
  | 'create_client'
  | 'update_client'
  | 'delete_client'
  | 'create_appointment'
  | 'update_appointment'
  | 'cancel_appointment'
  | 'create_journal'
  | 'update_journal'
  | 'delete_journal'
  | 'export_gdpr_data'
  | 'update_admin_permissions'
  | 'update_working_hours'
  | 'update_sms_settings';

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: AuditAction;
  details: string;
  ipAddress?: string;
}
