import { smsService } from './sms';
import { emailService } from './email';
import { whatsappService } from './whatsapp';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export interface NotificationChannel {
  sms?: boolean;
  email?: boolean;
  whatsapp?: boolean;
}

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'appointment_confirmation' | 'appointment_reminder' | 'two_factor_auth' | 'password_reset' | 'appointment_cancelled' | 'welcome_message' | 'general';
  channels: NotificationChannel;
  templateVariables?: Record<string, string>;
  data?: any;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  channels: {
    sms?: { success: boolean; error?: string };
    email?: { success: boolean; error?: string };
    whatsapp?: { success: boolean; error?: string };
  };
}

class NotificationService {
  /**
   * Send notification through multiple channels
   */
  async sendNotification(notificationData: NotificationData): Promise<NotificationResult> {
    const { userId, title, message, type, channels, templateVariables = {}, data } = notificationData;
    
    try {
      // Get user information
      const user = await prisma.user.findUnique({
        where: { id: userId, isActive: true },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          cpf: true
        }
      });

      if (!user) {
        throw new Error('User not found or inactive');
      }

      // Create notification record
      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          data: data || null,
        }
      });

      const channelResults: NotificationResult['channels'] = {};
      
      // Prepare template variables with user data
      const fullVariables = {
        patient_name: user.name,
        user_name: user.name,
        ...templateVariables
      };

      // Send SMS if requested and user has phone
      if (channels.sms && user.phone) {
        try {
          const smsResult = await smsService.sendTemplatedSMS(
            user.phone,
            type as any,
            fullVariables
          );
          channelResults.sms = { success: smsResult.success };
          if (!smsResult.success) {
            channelResults.sms.error = smsResult.error;
          }
        } catch (error: any) {
          channelResults.sms = { success: false, error: error.message };
        }
      }

      // Send Email if requested and user has email
      if (channels.email && user.email) {
        try {
          const emailResult = await emailService.sendTemplatedEmail(
            user.email,
            type as any,
            fullVariables
          );
          channelResults.email = { success: emailResult.success };
          if (!emailResult.success) {
            channelResults.email.error = emailResult.error;
          }
        } catch (error: any) {
          channelResults.email = { success: false, error: error.message };
        }
      }

      // Send WhatsApp if requested and user has phone
      if (channels.whatsapp && user.phone) {
        try {
          const whatsappResult = await whatsappService.sendTemplatedMessage(
            user.phone,
            type as any,
            fullVariables
          );
          channelResults.whatsapp = { success: whatsappResult.success };
          if (!whatsappResult.success) {
            channelResults.whatsapp.error = whatsappResult.error;
          }
        } catch (error: any) {
          channelResults.whatsapp = { success: false, error: error.message };
        }
      }

      // Update notification with channel results
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          data: {
            ...notification.data,
            channelResults
          }
        }
      });

      // Check if at least one channel succeeded
      const hasSuccess = Object.values(channelResults).some(result => result?.success);

      logger.info('Multi-channel notification sent', {
        userId,
        notificationId: notification.id,
        type,
        channels: channelResults,
        success: hasSuccess
      });

      return {
        success: hasSuccess,
        notificationId: notification.id,
        channels: channelResults
      };

    } catch (error: any) {
      logger.error('Failed to send multi-channel notification:', {
        userId,
        type,
        error: error.message
      });

      return {
        success: false,
        channels: {}
      };
    }
  }

  /**
   * Send appointment confirmation
   */
  async sendAppointmentConfirmation(
    userId: string,
    appointmentData: {
      appointmentDate: string;
      appointmentTime: string;
      doctorName: string;
      unitName: string;
      unitAddress?: string;
    },
    channels: NotificationChannel = { sms: true, email: true }
  ): Promise<NotificationResult> {
    return this.sendNotification({
      userId,
      title: 'Consulta Confirmada',
      message: `Sua consulta foi confirmada para ${appointmentData.appointmentDate} às ${appointmentData.appointmentTime} com ${appointmentData.doctorName}.`,
      type: 'appointment_confirmation',
      channels,
      templateVariables: appointmentData
    });
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    userId: string,
    appointmentData: {
      appointmentDate: string;
      appointmentTime: string;
      doctorName: string;
      hoursUntil?: string;
    },
    channels: NotificationChannel = { sms: true, whatsapp: true }
  ): Promise<NotificationResult> {
    return this.sendNotification({
      userId,
      title: 'Lembrete de Consulta',
      message: `Lembrete: Você tem uma consulta marcada para ${appointmentData.appointmentDate} às ${appointmentData.appointmentTime} com ${appointmentData.doctorName}.`,
      type: 'appointment_reminder',
      channels,
      templateVariables: appointmentData
    });
  }

  /**
   * Send 2FA code
   */
  async send2FACode(
    userId: string,
    code: string,
    expiresIn: string = '5',
    channels: NotificationChannel = { sms: true }
  ): Promise<NotificationResult> {
    return this.sendNotification({
      userId,
      title: 'Código de Verificação',
      message: `Seu código de verificação é: ${code}. Válido por ${expiresIn} minutos.`,
      type: 'two_factor_auth',
      channels,
      templateVariables: {
        verification_code: code,
        expires_in: `${expiresIn} minutos`
      }
    });
  }

  /**
   * Send password reset code
   */
  async sendPasswordReset(
    userId: string,
    code: string,
    expiresIn: string = '10',
    channels: NotificationChannel = { sms: true, email: true }
  ): Promise<NotificationResult> {
    return this.sendNotification({
      userId,
      title: 'Redefinição de Senha',
      message: `Seu código para redefinir a senha é: ${code}. Válido por ${expiresIn} minutos.`,
      type: 'password_reset',
      channels,
      templateVariables: {
        reset_code: code,
        expires_in: `${expiresIn} minutos`
      }
    });
  }

  /**
   * Send appointment cancellation
   */
  async sendAppointmentCancellation(
    userId: string,
    appointmentData: {
      appointmentDate: string;
      appointmentTime: string;
      doctorName: string;
      reason?: string;
    },
    channels: NotificationChannel = { sms: true, email: true, whatsapp: true }
  ): Promise<NotificationResult> {
    return this.sendNotification({
      userId,
      title: 'Consulta Cancelada',
      message: `Sua consulta de ${appointmentData.appointmentDate} às ${appointmentData.appointmentTime} com ${appointmentData.doctorName} foi cancelada.`,
      type: 'appointment_cancelled',
      channels,
      templateVariables: appointmentData
    });
  }

  /**
   * Send welcome message for new users
   */
  async sendWelcomeMessage(
    userId: string,
    cardNumber: string,
    channels: NotificationChannel = { sms: true, email: true, whatsapp: true }
  ): Promise<NotificationResult> {
    return this.sendNotification({
      userId,
      title: 'Bem-vindo ao App Telas Mágicas',
      message: `Bem-vindo! Seu cartão número ${cardNumber} está ativo e você já pode agendar consultas.`,
      type: 'welcome_message',
      channels,
      templateVariables: {
        card_number: cardNumber
      }
    });
  }

  /**
   * Send bulk notifications to multiple users
   */
  async sendBulkNotifications(
    notifications: NotificationData[]
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    
    for (const notification of notifications) {
      const result = await this.sendNotification(notification);
      results.push(result);
      
      // Add delay between notifications to respect rate limits
      await this.delay(500);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info(`Bulk notifications completed: ${successful} successful, ${failed} failed`);

    return results;
  }

  /**
   * Get notification service status
   */
  getServiceStatus() {
    return {
      sms: smsService.getServiceStatus(),
      email: emailService.getServiceStatus(),
      whatsapp: whatsappService.getServiceStatus(),
      availableChannels: ['sms', 'email', 'whatsapp'],
      supportedTypes: [
        'appointment_confirmation',
        'appointment_reminder',
        'two_factor_auth',
        'password_reset',
        'appointment_cancelled',
        'welcome_message',
        'general'
      ]
    };
  }

  /**
   * Add delay between requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const notificationService = new NotificationService();
export default notificationService;