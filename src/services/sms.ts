import { Appointment, SmsSettings, SmsLog } from '../types';
import { dbService } from './db';

export class SmsService {
  /**
   * Formaterer en melding basert på mal og avtaledata
   */
  public formatMessage(template: string, appointment: Appointment, cancellationLink?: string): string {
    const cancelUrl = cancellationLink || `${window.location.origin}/avbestill/${appointment.id}`;
    const meetUrl = appointment.isOnline && appointment.meetingLink 
      ? `Møtelenke: ${appointment.meetingLink}` 
      : '';

    return template
      .replace(/{kunde}/g, appointment.clientName)
      .replace(/{kundenummer}/g, String(appointment.clientNumber))
      .replace(/{dato}/g, appointment.date)
      .replace(/{klokkeslett}/g, appointment.startTime)
      .replace(/{varighet}/g, String(appointment.durationMinutes))
      .replace(/{pris}/g, String(appointment.price))
      .replace(/{avbestillingslenke}/g, cancelUrl)
      .replace(/{motelenke}/g, meetUrl)
      .trim();
  }

  /**
   * Genererer en sikker online møtelenke for videokonsultasjoner
   */
  public generateMeetingLink(appointmentId: string): string {
    const cleanId = appointmentId.replace(/[^a-zA-Z0-9]/g, '');
    return `https://meet.jit.si/Tid1Din-Klinikk-${cleanId}`;
  }

  /**
   * Sender SMS via GatewayAPI.com REST API
   * Dokumentasjon: https://gatewayapi.com/docs/rest.html
   */
  public async sendSms(
    toPhone: string,
    message: string,
    type: SmsLog['type'],
    appointmentId?: string
  ): Promise<SmsLog> {
    const settings = await dbService.getSmsSettings();
    const cleanPhone = toPhone.replace(/\s+/g, '').replace('+', '');
    // Sørg for landskode hvis norsk nummer uten prefiks
    const formattedPhone = cleanPhone.length === 8 ? `47${cleanPhone}` : cleanPhone;

    const logEntry: SmsLog = {
      id: 'sms_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      recipientPhone: toPhone,
      message,
      type,
      appointmentId,
      status: 'simulated'
    };

    // Hvis ekte GatewayAPI-nøkkel er oppgitt, send ekte HTTP-forespørsel
    if (settings.apiKey && settings.apiKey.length > 5) {
      try {
        const payload = {
          sender: settings.sender || 'Tid1Din',
          message: message,
          recipients: [{ msisdn: formattedPhone }]
        };

        const response = await fetch('https://gatewayapi.com/rest/mtsms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(`${settings.apiKey}:`)
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          logEntry.status = 'sent';
          logEntry.response = JSON.stringify(data);
        } else {
          const errorText = await response.text();
          logEntry.status = 'failed';
          logEntry.response = errorText;
        }
      } catch (err: any) {
        logEntry.status = 'failed';
        logEntry.response = err.message || 'Nettverksfeil mot GatewayAPI';
      }
    } else {
      // Simuleringsmodus når API-nøkkel ikke er lagt inn
      logEntry.status = 'simulated';
      logEntry.response = 'Simulert SMS sendt vellykket (GatewayAPI-nøkkel ikke angitt i innstillinger)';
    }

    await dbService.logSms(logEntry);
    return logEntry;
  }

  /**
   * Sender bookingbekreftelse ved nyopprettet time
   */
  public async sendBookingConfirmation(appointment: Appointment): Promise<SmsLog | null> {
    if (!appointment.clientPhone) return null;
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
