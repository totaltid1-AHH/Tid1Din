import { Appointment, SmsSettings, SmsLog } from '../types';
import { dbService } from './db';

export class SmsService {
  /**
   * Formaterer en melding basert på mal og avtaledata
   */
  public formatMessage(
    template: string, 
    appointment: Appointment, 
    cancellationLink?: string,
    extra?: {
      newDate?: string;
      newTime?: string;
      delayMinutes?: number;
      therapistName?: string;
    }
  ): string {
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.port === '5173'
    );
    const baseUrl = isLocalhost ? 'https://tid1din.web.app' : (typeof window !== 'undefined' ? window.location.origin : 'https://tid1din.web.app');
    const cancelUrl = cancellationLink || `${baseUrl}/avbestill/${appointment.id}`;
    const meetUrl = appointment.isOnline && appointment.meetingLink 
      ? `Møtelenke: ${appointment.meetingLink}` 
      : '';

    // Beregn evt. nytt klokkeslett ved forsinkelse dersom ikke oppgitt direkte
    let calculatedNewTime = extra?.newTime;
    if (!calculatedNewTime && extra?.delayMinutes && appointment.startTime) {
      try {
        const [h, m] = appointment.startTime.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          const totalMin = h * 60 + m + extra.delayMinutes;
          const newH = Math.floor(totalMin / 60) % 24;
          const newM = totalMin % 60;
          calculatedNewTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        }
      } catch {
        calculatedNewTime = appointment.startTime;
      }
    }

    let formattedDate = appointment.date || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
      const [y, m, d] = formattedDate.split('-');
      formattedDate = `${d}.${m}.${y}`;
    }

    let formattedNewDate = extra?.newDate || appointment.date || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(formattedNewDate)) {
      const [y, m, d] = formattedNewDate.split('-');
      formattedNewDate = `${d}.${m}.${y}`;
    }

    const rawResult = template
      .replace(/{kunde}/g, appointment.clientName || 'klient')
      .replace(/{kundenummer}/g, String(appointment.clientNumber || ''))
      .replace(/{dato}/g, formattedDate)
      .replace(/{klokkeslett}/g, appointment.startTime || '')
      .replace(/{ny_dato}/g, formattedNewDate)
      .replace(/{nytt_klokkeslett}/g, calculatedNewTime || appointment.startTime || '')
      .replace(/{forsinkelse}/g, extra?.delayMinutes ? `${extra.delayMinutes} minutter` : '')
      .replace(/{behandler}/g, extra?.therapistName || appointment.therapistName || 'Terapeut')
      .replace(/{varighet}/g, String(appointment.durationMinutes || 45))
      .replace(/{pris}/g, String(appointment.price || ''))
      .replace(/{avbestillingslenke}/g, cancelUrl)
      .replace(/{motelenke}/g, meetUrl)
      .trim();

    // Erstatt typografiske spesialtegn (en-dash, em-dash, anførselstegn) med standard GSM-tegn
    return rawResult
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"');
  }

  /**
   * Genererer en sikker online møtelenke for videokonsultasjoner
   */
  public generateMeetingLink(appointmentId: string): string {
    const cleanId = appointmentId.replace(/[^a-zA-Z0-9]/g, '');
    return `https://meet.jit.si/Tid1Din-Klinikk-${cleanId}`;
  }

  /**
   * Sender SMS via Firebase Cloud Function (sendSms) til GatewayAPI.com REST API
   */
  public async sendSms(
    toPhone: string,
    message: string,
    type: SmsLog['type'],
    appointmentId?: string
  ): Promise<SmsLog> {
    const settings = await dbService.getSmsSettings();
    
    // Rens telefonnummer til kun siffer
    const rawDigits = toPhone.replace(/\D/g, '');
    const cleanDigits = rawDigits.startsWith('00') ? rawDigits.substring(2) : rawDigits;
    // Sørg for landskode hvis norsk mobilnummer uten prefiks (8 siffer)
    const formattedDigits = cleanDigits.length === 8 ? `47${cleanDigits}` : cleanDigits;
    const msisdnNumber = parseInt(formattedDigits, 10);

    const logEntry: SmsLog = {
      id: 'sms_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      recipientPhone: toPhone,
      message,
      type,
      appointmentId,
      status: 'simulated'
    };

    if (isNaN(msisdnNumber) || formattedDigits.length < 8) {
      logEntry.status = 'failed';
      logEntry.response = `Ugyldig telefonnummer: "${toPhone}". Vennligst oppgi et gyldig mobilnummer.`;
      await dbService.logSms(logEntry);
      return logEntry;
    }

    const apiKey = (settings.apiKey || '').trim();

    try {
      const cleanSender = (settings.sender || 'Tid1Din').trim().substring(0, 11) || 'Tid1Din';

      const isLocalHost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.port === '5173'
      );

      // Endepunkter:
      // 1. /api/send-sms (Firebase Hosting rewrite til Cloud Function sendSms)
      // 2. Direkte Cloud Function URL (i us-central1) som fallback
      // 3. /api/gatewayapi/rest/mtsms (kun aktiv lokalt med Vite dev-server proxy dersom apiKey finnes)
      const endpoints: string[] = [];
      if (isLocalHost && apiKey.length > 5) {
        endpoints.push('/api/gatewayapi/rest/mtsms');
      }
      endpoints.push('/api/send-sms');
      endpoints.push('https://us-central1-tid1din.cloudfunctions.net/sendSms');

      let response: Response | null = null;
      let lastError: any = null;

      for (const url of endpoints) {
        try {
          if (url.includes('/api/gatewayapi')) {
            // Direkte dev-proxy til GatewayAPI (lokalt)
            response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(`${apiKey}:`)
              },
              body: JSON.stringify({
                sender: cleanSender,
                message: message,
                recipients: [{ msisdn: msisdnNumber }]
              })
            });
          } else {
            // Firebase Cloud Function (produksjon / server)
            response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                toPhone: toPhone,
                phone: toPhone,
                to: toPhone,
                message: message,
                text: message,
                sender: cleanSender,
                ...(apiKey ? { apiKey } : {})
              })
            });
          }

          if (response && (response.ok || response.status === 400 || response.status === 401 || response.status === 402 || response.status === 422)) {
            break;
          }
        } catch (e) {
          lastError = e;
        }
      }

      if (!response) {
        throw lastError || new Error('Nettverksfeil mot SMS-tjenesten');
      }

      let responseData: any = {};
      const rawText = await response.text();
      try {
        responseData = JSON.parse(rawText);
      } catch {
        responseData = { message: rawText };
      }

      if (response.ok) {
        logEntry.status = 'sent';
        logEntry.response = JSON.stringify(responseData.data || responseData);
      } else {
        const status = response.status;
        logEntry.status = 'failed';

        let errorMsg = responseData.error || responseData.message || rawText;
        if (status === 401) {
          errorMsg = 'Feil 401: Ugyldig GatewayAPI-nøkkel. Vennligst sjekk at tokenet er kopiert riktig fra GatewayAPI-dashbordet.';
        } else if (status === 402) {
          errorMsg = 'Feil 402: Kontoen mangler SMS-kreditter. Fyll på saldo hos GatewayAPI.com.';
        } else if (status === 422) {
          errorMsg = `Feil 422 (Ugyldig data): ${errorMsg}`;
        }

        logEntry.response = errorMsg;
      }
    } catch (err: any) {
      logEntry.status = 'failed';
      logEntry.response = err.message || 'Ukjent nettverksfeil mot SMS-tjenesten';
    }

    await dbService.logSms(logEntry);
    return logEntry;
  }

  /**
   * Sender bookingbekreftelse ved nyopprettet time
   */
  public async sendBookingConfirmation(appointment: Appointment): Promise<SmsLog> {
    if (!appointment.clientPhone || !appointment.clientPhone.trim()) {
      const logEntry: SmsLog = {
        id: 'sms_err_' + Date.now(),
        timestamp: new Date().toISOString(),
        recipientPhone: '',
        message: 'Bekreftelse kunne ikke sendes: Klienten mangler mobilnummer.',
        type: 'booking',
        appointmentId: appointment.id,
        status: 'failed',
        response: 'Klienten mangler mobilnummer. Vennligst legg inn mobilnummer for å sende SMS.'
      };
      await dbService.logSms(logEntry);
      return logEntry;
    }
    const settings = await dbService.getSmsSettings();
    const message = this.formatMessage(settings.bookingTemplate, appointment);
    return await this.sendSms(appointment.clientPhone, message, 'booking', appointment.id);
  }

  /**
   * Sender påminnelse
   */
  public async sendReminder(appointment: Appointment, reminderType: 'reminder1' | 'reminder2'): Promise<SmsLog | null> {
    if (!appointment.clientPhone) return null;
    const settings = await dbService.getSmsSettings();
    if (reminderType === 'reminder1' && !settings.reminder1Enabled) return null;
    if (reminderType === 'reminder2' && !settings.reminder2Enabled) return null;

    const message = this.formatMessage(settings.reminderTemplate, appointment);
    return await this.sendSms(appointment.clientPhone, message, reminderType, appointment.id);
  }
}

export const smsService = new SmsService();
