import twilio from 'twilio';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';
import { formatPhone } from '@/utils/validation';

interface SMSTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class SMSService {
  private client: twilio.Twilio;
  private templates: Map<string, SMSTemplate>;

  constructor() {
    this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    this.initializeTemplates();
  }

  private initializeTemplates() {
    this.templates = new Map([
      ['2fa-code', {
        id: '2fa-code',
        name: 'Código 2FA',
        template: 'Seu código de verificação do {appName} é: {code}. Não compartilhe este código com ninguém. Válido por 5 minutos.',
        variables: ['appName', 'code']
      }],
      ['appointment-confirmation', {
        id: 'appointment-confirmation',
        name: 'Confirmação de Consulta',
        template: 'Consulta confirmada! {doctorName} - {date} às {time}. Local: {unitName}, {unitAddress}. {appName}',
        variables: ['doctorName', 'date', 'time', 'unitName', 'unitAddress', 'appName']
      }],
      ['appointment-reminder', {
        id: 'appointment-reminder',
        name: 'Lembrete de Consulta',
        template: 'Lembrete: Você tem consulta com {doctorName} em {date} às {time} na {unitName}. Chegue 15min antes. {appName}',
        variables: ['doctorName', 'date', 'time', 'unitName', 'appName']
      }],
      ['appointment-cancellation', {
        id: 'appointment-cancellation',
        name: 'Cancelamento de Consulta',
        template: 'Sua consulta com {doctorName} em {date} às {time} foi cancelada. Reagende através do app. {appName}',
        variables: ['doctorName', 'date', 'time', 'appName']
      }],
      ['welcome', {
        id: 'welcome',
        name: 'Boas-vindas',
        template: 'Olá {name}! Sua conta no {appName} foi criada com sucesso. Bem-vindo(a) à nossa rede de saúde!',
        variables: ['name', 'appName']
      }],
      ['password-reset', {
        id: 'password-reset',
        name: 'Redefinição de Senha',
        template: 'Seu código de redefinição de senha do {appName} é: {code}. Válido por 10 minutos. Se você não solicitou, ignore.',
        variables: ['appName', 'code']
      }],
    ]);
  }

  async sendTemplatedSMS(phone: string, templateId: string, variables: Record<string, string>): Promise<SMSResult> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      const formattedPhone = this.formatPhoneForTwilio(phone);
      const message = this.processTemplate(template.template, variables);

      const result = await this.client.messages.create({
        body: message,
        from: config.TWILIO_PHONE_NUMBER,
        to: formattedPhone,
      });

      logger.info('Templated SMS sent successfully', {
        messageId: result.sid,
        template: templateId,
        to: this.maskPhone(formattedPhone),
        status: result.status,
      });

      return {
        success: result.status === 'queued' || result.status === 'sent',
        messageId: result.sid,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error sending templated SMS:', {
        error: errorMessage,
        template: templateId,
        phone: this.maskPhone(phone),
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async send2FACode(phone: string, code: string): Promise<boolean> {
    const result = await this.sendTemplatedSMS(phone, '2fa-code', {
      appName: config.APP_NAME,
      code,
    });
    return result.success;
  }

  private processTemplate(template: string, variables: Record<string, string>): string {
    let message = template;
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return message;
  }

  async sendAppointmentReminder(
    phone: string,
    appointmentDetails: {
      doctorName: string;
      date: string;
      time: string;
      unitName: string;
    }
  ): Promise<boolean> {
    const result = await this.sendTemplatedSMS(phone, 'appointment-reminder', {
      doctorName: appointmentDetails.doctorName,
      date: appointmentDetails.date,
      time: appointmentDetails.time,
      unitName: appointmentDetails.unitName,
      appName: config.APP_NAME,
    });
    return result.success;
  }

  async sendAppointmentConfirmation(
    phone: string,
    appointmentDetails: {
      doctorName: string;
      date: string;
      time: string;
      unitName: string;
      unitAddress: string;
    }
  ): Promise<boolean> {
    const result = await this.sendTemplatedSMS(phone, 'appointment-confirmation', {
      doctorName: appointmentDetails.doctorName,
      date: appointmentDetails.date,
      time: appointmentDetails.time,
      unitName: appointmentDetails.unitName,
      unitAddress: appointmentDetails.unitAddress,
      appName: config.APP_NAME,
    });
    return result.success;
  }

  async sendAppointmentCancellation(
    phone: string,
    appointmentDetails: {
      doctorName: string;
      date: string;
      time: string;
    }
  ): Promise<boolean> {
    const result = await this.sendTemplatedSMS(phone, 'appointment-cancellation', {
      doctorName: appointmentDetails.doctorName,
      date: appointmentDetails.date,
      time: appointmentDetails.time,
      appName: config.APP_NAME,
    });
    return result.success;
  }

  async sendAccountCreated(phone: string, name: string): Promise<boolean> {
    const result = await this.sendTemplatedSMS(phone, 'welcome', {
      name,
      appName: config.APP_NAME,
    });
    return result.success;
  }

  async sendPasswordReset(phone: string, code: string): Promise<boolean> {
    const result = await this.sendTemplatedSMS(phone, 'password-reset', {
      code,
      appName: config.APP_NAME,
    });
    return result.success;
  }

  private formatPhoneForTwilio(phone: string): string {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Add +55 country code for Brazil if not present
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      return `+55${cleanPhone}`;
    }
    
    // If already has country code
    if (cleanPhone.startsWith('55') && (cleanPhone.length === 12 || cleanPhone.length === 13)) {
      return `+${cleanPhone}`;
    }
    
    // Default fallback
    return `+55${cleanPhone}`;
  }

  private maskPhone(phone: string): string {
    if (phone.length < 4) return phone;
    const visible = phone.slice(0, 3) + phone.slice(-2);
    const masked = '*'.repeat(phone.length - 5);
    return visible.slice(0, 3) + masked + visible.slice(3);
  }

  async checkDeliveryStatus(messageId: string): Promise<{
    status: string;
    errorCode?: string;
    errorMessage?: string;
  }> {
    try {
      const message = await this.client.messages(messageId).fetch();
      
      return {
        status: message.status,
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined,
      };
    } catch (error) {
      logger.error('Error checking SMS delivery status:', {
        error: error instanceof Error ? error.message : error,
        messageId,
      });
      
      return {
        status: 'unknown',
        errorMessage: 'Failed to check delivery status',
      };
    }
  }

  async getAccountInfo(): Promise<{
    balance?: string;
    status: string;
  }> {
    try {
      const account = await this.client.api.accounts(config.TWILIO_ACCOUNT_SID).fetch();
      
      return {
        balance: account.balance,
        status: account.status,
      };
    } catch (error) {
      logger.error('Error getting Twilio account info:', {
        error: error instanceof Error ? error.message : error,
      });
      
      return {
        status: 'unknown',
      };
    }
  }

  async verifyService(): Promise<boolean> {
    try {
      const account = await this.client.api.accounts(config.TWILIO_ACCOUNT_SID).fetch();
      logger.info('Twilio service verified successfully', {
        accountSid: account.sid,
        status: account.status,
      });
      return account.status === 'active';
    } catch (error) {
      logger.error('Twilio service verification failed:', {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  getAvailableTemplates(): SMSTemplate[] {
    return Array.from(this.templates.values());
  }

  async sendBulkSMS(recipients: string[], templateId: string, variables: Record<string, string>): Promise<{
    successful: number;
    failed: number;
    results: SMSResult[];
  }> {
    const results: SMSResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const phone of recipients) {
      const result = await this.sendTemplatedSMS(phone, templateId, variables);
      results.push(result);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Bulk SMS campaign completed', {
      total: recipients.length,
      successful,
      failed,
      template: templateId,
    });

    return { successful, failed, results };
  }
}

export const smsService = new SMSService();