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

export function parseMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

