import { WorkingHoursConfig, Appointment, Holiday, SlotTypeOption, UserProfile } from '../types';

export interface GeneratedSlot {
  id: string;
  startTime: string; // "09:00"
  endTime: string;   // "09:45"
  date: string;      // "YYYY-MM-DD"
  isAvailable: boolean;
  appointment?: Appointment;
  isBreak?: boolean;
  breakTitle?: string;
}

export function isValidTimeString(timeStr?: string): boolean {
  if (!timeStr) return false;
  const trimmed = timeStr.trim();
  // Gyldig klokkeslett er HH:MM eller H:MM der timer er 00-23 og minutter er 00-59
  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return !!match;
}

export function normalizeTimeString(timeStr?: string): string {
  if (!timeStr || !isValidTimeString(timeStr)) return '';
  const [hh, mm] = timeStr.trim().split(':');
  return `${hh.padStart(2, '0')}:${mm}`;
}

export function parseMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return 0;
  return h * 60 + m;
}

export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Beregner varighet i minutter mellom to klokkeslett.
 * Hvis ett av klokkeslettene er ugyldig (f.eks. minutter > 59), returneres 0.
 */
export function calculateDurationMinutes(start: string, end: string): number {
  if (!isValidTimeString(start) || !isValidTimeString(end)) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return endMin > startMin ? endMin - startMin : 0;
}

/**
 * Regner ut ny sluttid basert på starttid og antall timer.
 */
export function calculateEndTime(start: string, hours: number): string {
  if (!isValidTimeString(start)) return '10:45';
  const [hStr, mStr] = start.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return '10:45';
  const totalMin = h * 60 + m + Math.round(hours * 60);
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Renser og sikrer inntasting av klokkeslett i sanntid.
 * Forhindrer umulige klokkeslett:
 * - Timer kan ikke overstige 23.
 * - Minutter kan aldri overstige 59 (første siffer i minutter kan aldri være 6, 7, 8 eller 9).
 * - Blokkerer feilaktige verdier som feks "76 minutter" eller "10:76".
 */
export function sanitizeTimeInput(nextVal: string, prevVal: string = ''): string {
  const cleaned = nextVal.replace(/[^0-9:]/g, '');

  // Dersom brukeren sletter tegn, tillat det direkte
  if (cleaned.length < prevVal.length) {
    return cleaned;
  }

  if (!cleaned) return '';

  // Håndter tilfelle der brukeren taster kolon eksplisitt
  if (cleaned.endsWith(':')) {
    const hPart = cleaned.replace(/\D/g, '');
    if (hPart.length > 0) {
      const h = parseInt(hPart, 10);
      if (h <= 23) {
        return `${String(h).padStart(2, '0')}:`;
      }
    }
    return prevVal;
  }

  const digits = cleaned.replace(/\D/g, '');

  // 1 siffer
  if (digits.length === 1) {
    const d = parseInt(digits, 10);
    // Klokketimer kan kun være 00-23. Siffer 3-9 som første tegn må derfor være enkelttime (03:-09:).
    if (d >= 3) {
      return `0${d}:`;
    }
    return digits;
  }

  // 2 siffer (HH)
  if (digits.length === 2) {
    const h = parseInt(digits, 10);
    // Timer kan ikke overstige 23
    if (h > 23) {
      return prevVal;
    }
    return `${digits}:`;
  }

  // 3 siffer (HH + første siffer i minutter)
  if (digits.length === 3) {
    const hh = digits.slice(0, 2);
    const h = parseInt(hh, 10);
    if (h > 23) return prevVal;

    const m1 = parseInt(digits[2], 10);
    // Minutter kan kun gå fra 00 til 59. Første minuttsiffer kan derfor aldri være 6, 7, 8 eller 9!
    // (Hindrer tastefeil som feks "10:76" eller "76 minutter")
    if (m1 > 5) {
      return prevVal || `${hh}:`;
    }
    return `${hh}:${digits[2]}`;
  }

  // 4 siffer (HH + MM)
  if (digits.length >= 4) {
    const hh = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);

    // Både time (0-23) og minutt (0-59) må være gyldige
    if (h > 23 || m > 59) {
      return prevVal;
    }
    return `${hh}:${mm}`;
  }

  return cleaned.slice(0, 5);
}

/**
 * Formaterer og ferdigstiller klokkeslett ved fokus-tap (onBlur).
 * Fyller automatisk ut ufullstendige inntastinger dersom mulig, eller faller tilbake til forrige gyldige verdi.
 */
export function formatTimeOnBlur(input: string, fallback: string): string {
  if (!input || !input.trim()) return fallback;
  const trimmed = input.trim();

  if (isValidTimeString(trimmed)) {
    return normalizeTimeString(trimmed);
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 1) {
    const d = parseInt(digits, 10);
    if (d <= 23) return `0${d}:00`;
  } else if (digits.length === 2) {
    const h = parseInt(digits, 10);
    if (h <= 23) return `${digits.padStart(2, '0')}:00`;
  } else if (digits.length === 3) {
    const hh = digits.slice(0, 2);
    const m1 = digits[2];
    const h = parseInt(hh, 10);
    const m = parseInt(m1, 10);
    if (h <= 23 && m <= 5) {
      return `${hh}:${m1}0`;
    }
  }

  return fallback;
}

/**
 * Genererer liste over standard klokkeslett (hvert 15. minutt fra 06:00 til 22:00)
 * og inkluderer eventuelle gyldige egendefinerte klokkeslett så de aldri mangler i listen.
 * Ugyldige klokkeslett (som feks 76 minutter) filtreres automatisk bort.
 */
export function generateTimeOptions(customValues?: (string | undefined)[]): string[] {
  const options: string[] = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 22 && m > 0) break;
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  if (customValues) {
    for (const val of customValues) {
      if (val && isValidTimeString(val)) {
        const formatted = normalizeTimeString(val);
        if (!options.includes(formatted)) {
          options.push(formatted);
        }
      }
    }
  }
  return options.sort((a, b) => a.localeCompare(b));
}

/**
 * Renser bort eventuelle "Terapeut:" prefikser eller parenteser
 */
export function formatTherapistName(name?: string): string {
  if (!name) return '';
  let cleaned = name.replace(/^(terapeut|behandler|lege)\s*:\s*/i, '');
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();
  return cleaned;
}

/**
 * Sjekker om en dato faller inn under en registrert ferie eller fraværsperiode
 */
export function isDateInHoliday(dateStr: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find(h => {
    return dateStr >= h.startDate && dateStr <= h.endDate;
  });
}

/**
 * Sjekker om en terapeut er i permisjon på en gitt dato (eller i dag dersom dateStr ikke er oppgitt)
 */
export function isTherapistOnLeave(therapist?: UserProfile, dateStr?: string): boolean {
  if (!therapist) return false;
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);
  if (therapist.leaveStartDate && therapist.leaveEndDate) {
    return targetDate >= therapist.leaveStartDate && targetDate <= therapist.leaveEndDate;
  }
  if (therapist.leaveStartDate) {
    return targetDate >= therapist.leaveStartDate;
  }
  return therapist.isActive === false;
}

/**
 * Genererer alle tidsluker for en gitt dag basert på arbeidstid, pauser og eksisterende avtaler
 */
export function generateDaySlots(
  dateStr: string,
  config: WorkingHoursConfig,
  appointments: Appointment[],
  holidays: Holiday[] = []
): GeneratedSlot[] {
  if (!config) return [];
  const targetDate = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = targetDate.getDay(); // 0 = Søndag, 1 = Mandag, osv.

  // Sjekk ferie
  const holiday = isDateInHoliday(dateStr, holidays);
  if (holiday) {
    return [];
  }

  // Sjekk om arbeidsdagen er aktiv (enten via dagsspesifikk kalender eller ukentlig mal)
  const workDays = Array.isArray(config.workDays) && config.workDays.length > 0 ? config.workDays : [1, 2, 3, 4, 5];
  let isWorkDay = workDays.includes(dayOfWeek);
  let startTimeStr = config.startTime || '08:00';
  let endTimeStr = config.endTime || '16:00';

  if (config.dailySchedules && config.dailySchedules[dateStr]) {
    const daily = config.dailySchedules[dateStr];
    isWorkDay = daily.isOpen;
    if (daily.startTime) startTimeStr = daily.startTime;
    if (daily.endTime) endTimeStr = daily.endTime;
  }

  if (!isWorkDay) {
    return [];
  }

  const startMinutes = parseMinutes(startTimeStr);
  const endMinutes = parseMinutes(endTimeStr);
  const slotDuration = config.slotDurationMinutes || 45;
  const breakDuration = config.breakBetweenMinutes || 15;
  const step = slotDuration + breakDuration;

  // Filtrer aktive avtaler for denne datoen
  const dayAppointments = (appointments || []).filter(
    a => a.date === dateStr && a.status !== 'cancelled'
  );

  const breaks = Array.isArray(config.breaks) ? config.breaks : [];

  const slots: GeneratedSlot[] = [];
  let current = startMinutes;

  while (current + slotDuration <= endMinutes) {
    const slotStart = formatMinutes(current);
    const slotEnd = formatMinutes(current + slotDuration);

    // Sjekk om luken overlapper med en fast pause (f.eks. lunsj)
    const breakOverlap = breaks.find(b => {
      const bStart = parseMinutes(b.start);
      const bEnd = parseMinutes(b.end);
      return current < bEnd && current + slotDuration > bStart;
    });

    if (breakOverlap) {
      // Hopp forbi pausen
      current = parseMinutes(breakOverlap.end);
      continue;
    }

    // Sjekk om det allerede finnes en avtale i denne tidsluken
    const matchedAppointment = dayAppointments.find(a => {
      const aStart = parseMinutes(a.startTime);
      const aEnd = parseMinutes(a.endTime);
      return current < aEnd && current + slotDuration > aStart;
    });

    slots.push({
      id: `${dateStr}_${slotStart}`,
      startTime: slotStart,
      endTime: slotEnd,
      date: dateStr,
      isAvailable: !matchedAppointment,
      appointment: matchedAppointment
    });

    current += step;
  }

  return slots;
}

export interface DayAvailabilityInfo {
  total: number;
  available: number;
  booked: number;
  status: 'all_available' | 'partially_booked' | 'fully_booked' | 'closed';
}

/**
 * Beregner detaljert tilgjengelighet for en gitt dag (totalt antall timer og antall ledige)
 */
export function getDayAvailability(
  dateStr: string,
  config: WorkingHoursConfig,
  appointments: Appointment[],
  holidays: Holiday[] = []
): DayAvailabilityInfo {
  if (!config) {
    return { total: 0, available: 0, booked: 0, status: 'closed' };
  }
  const slots = generateDaySlots(dateStr, config, appointments, holidays);
  const total = slots.length;
  if (total === 0) {
    return { total: 0, available: 0, booked: 0, status: 'closed' };
  }
  const available = slots.filter(s => s.isAvailable).length;
  const booked = total - available;

  if (available === 0) {
    return { total, available, booked, status: 'fully_booked' };
  }
  if (booked === 0) {
    return { total, available, booked, status: 'all_available' };
  }
  return { total, available, booked, status: 'partially_booked' };
}

/**
 * Returnerer tilgjengelighetsstatus for en dag i månedskalenderen
 */
export function getDayStatus(
  dateStr: string,
  config: WorkingHoursConfig,
  appointments: Appointment[],
  holidays: Holiday[] = []
): 'available' | 'busy' | 'closed' {
  const info = getDayAvailability(dateStr, config, appointments, holidays);
  if (info.status === 'closed') return 'closed';
  return info.status === 'fully_booked' ? 'busy' : 'available';
}

export const DEFAULT_SLOT_TYPES: SlotTypeOption[] = [
  { type: 'single', title: 'Enkelttime', durationMinutes: 45, price: 950 },
  { type: 'double', title: 'Dobbelttime', durationMinutes: 90, price: 1800 },
  { type: 'triple', title: 'Trippeltime', durationMinutes: 135, price: 2600 }
];

export interface LunchCollisionInfo {
  collides: boolean;
  lunchBreak?: WorkingHoursConfig['breaks'][0];
  lunchDurationMinutes: number;
}

/**
 * Henter lunsjpausen fra arbeidstidsinnstillingene (eller første pause)
 */
export function getLunchBreak(config: WorkingHoursConfig): WorkingHoursConfig['breaks'][0] | null {
  if (!config.breaks || config.breaks.length === 0) return null;
  const found = config.breaks.find(b => b.title && b.title.toLowerCase().includes('lunsj'));
  return found || config.breaks[0];
}

/**
 * Sjekker om en valgt time kolliderer med lunsjpausen
 */
export function checkLunchCollision(
  startTime: string,
  durationMinutes: number,
  config: WorkingHoursConfig
): LunchCollisionInfo {
  const lunch = getLunchBreak(config);
  if (!lunch) {
    return { collides: false, lunchDurationMinutes: 0 };
  }

  const slotStart = parseMinutes(startTime);
  const slotEnd = slotStart + durationMinutes;
  const lunchStart = parseMinutes(lunch.start);
  const lunchEnd = parseMinutes(lunch.end);
  const lunchDuration = lunchEnd - lunchStart;

  // Kollisjon skjer når timen starter før lunsj og strekker seg inn i lunsjtiden
  const collides = slotStart < lunchStart && slotEnd > lunchStart;

  return {
    collides,
    lunchBreak: lunch,
    lunchDurationMinutes: lunchDuration > 0 ? lunchDuration : 30
  };
}

export interface ContinuousSuggestions {
  before?: GeneratedSlot | null;
  after?: GeneratedSlot | null;
}

/**
 * Finner forslag til sammenhengende ledige tider før eller etter lunsj
 */
export function findContinuousAlternativeSlots(
  daySlots: GeneratedSlot[],
  durationMinutes: number,
  config: WorkingHoursConfig,
  appointments: Appointment[],
  dateStr: string
): ContinuousSuggestions {
  const lunch = getLunchBreak(config);
  if (!lunch) return {};

  const lunchStart = parseMinutes(lunch.start);
  const lunchEnd = parseMinutes(lunch.end);
  const endMinutes = parseMinutes(config.endTime);

  const dayAppointments = appointments.filter(
    a => a.date === dateStr && a.status !== 'cancelled'
  );

  // Sjekker om en sammenhengende blokk er ledig (ingen overlapp med avtaler eller pauser)
  const isContinuousBlockAvailable = (startMin: number): boolean => {
    const endMin = startMin + durationMinutes;
    if (endMin > endMinutes) return false;

    // Må ikke overlappe med noen definerte pauser
    for (const b of config.breaks) {
      const bStart = parseMinutes(b.start);
      const bEnd = parseMinutes(b.end);
      if (startMin < bEnd && endMin > bStart) {
        return false;
      }
    }

    // Må ikke overlappe med noen eksisterende avtaler
    for (const a of dayAppointments) {
      const aStart = parseMinutes(a.startTime);
      const aEnd = parseMinutes(a.endTime);
      if (startMin < aEnd && endMin > aStart) {
        return false;
      }
    }

    return true;
  };

  // 1. Forslag før lunsj: finn den seneste ledige luken før lunsj som har plass til hele timen
  let bestBefore: GeneratedSlot | null = null;
  for (const slot of daySlots) {
    const sMin = parseMinutes(slot.startTime);
    if (sMin + durationMinutes <= lunchStart && slot.isAvailable) {
      if (isContinuousBlockAvailable(sMin)) {
        if (!bestBefore || sMin > parseMinutes(bestBefore.startTime)) {
          bestBefore = slot;
        }
      }
    }
  }

  // 2. Forslag etter lunsj: finn den tidligste ledige luken etter lunsj som har plass til hele timen
  let bestAfter: GeneratedSlot | null = null;
  for (const slot of daySlots) {
    const sMin = parseMinutes(slot.startTime);
    if (sMin >= lunchEnd && slot.isAvailable) {
      if (isContinuousBlockAvailable(sMin)) {
        if (!bestAfter || sMin < parseMinutes(bestAfter.startTime)) {
          bestAfter = slot;
        }
      }
    }
  }

  return {
    before: bestBefore,
    after: bestAfter
  };
}

/**
 * Finner første tilgjengelige åpne dato for en behandler/klinikk (fra og med startDato, opptil maxDays frem i tid)
 */
export function getFirstOpenDate(
  fromDate: Date = new Date(),
  config: WorkingHoursConfig,
  appointments: Appointment[] = [],
  holidays: Holiday[] = [],
  therapist?: UserProfile,
  maxDays = 30
): Date {
  if (!config) return fromDate;

  for (let i = 0; i <= maxDays; i++) {
    const candidate = new Date(fromDate);
    candidate.setDate(fromDate.getDate() + i);
    const dStr = candidate.toISOString().slice(0, 10);

    // Sjekk permisjon
    if (therapist && isTherapistOnLeave(therapist, dStr)) {
      continue;
    }

    const avail = getDayAvailability(dStr, config, appointments, holidays);
    if (avail.status !== 'closed') {
      return candidate;
    }
  }

  return fromDate;
}

/**
 * Returnerer en pen tekstlig oppsummering av behandlerens åpningsdager og tidspunkter på norsk
 */
export function getWorkDaysSummary(config?: WorkingHoursConfig | null): string {
  if (!config || !config.workDays || config.workDays.length === 0) {
    return 'Ikke spesifisert';
  }

  const dayNames: Record<number, string> = {
    1: 'Mandag',
    2: 'Tirsdag',
    3: 'Onsdag',
    4: 'Torsdag',
    5: 'Fredag',
    6: 'Lørdag',
    0: 'Søndag'
  };

  const sortedDays = [...config.workDays].sort((a, b) => {
    const normA = a === 0 ? 7 : a;
    const normB = b === 0 ? 7 : b;
    return normA - normB;
  });

  let daysText = '';
  if (sortedDays.length === 5 && sortedDays.every((d, idx) => d === idx + 1)) {
    daysText = 'Mandag – Fredag';
  } else if (sortedDays.length === 2 && sortedDays[0] === 2 && sortedDays[1] === 4) {
    daysText = 'Tirsdager og Torsdager';
  } else {
    daysText = sortedDays.map(d => dayNames[d] || String(d)).join(', ');
  }

  const timeText = config.startTime && config.endTime ? ` (kl. ${config.startTime} – ${config.endTime})` : '';
  return `${daysText}${timeText}`;
}

