import twilio from 'twilio';
import { env } from '@/config/environment';
import { logger } from '@/utils/logger';

const client = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
  ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  : null;

export class SMSService {
  static async sendOTP(phone: string, code: string, method: 'sms' | 'whatsapp' = 'sms'): Promise<boolean> {
    if (!client) {
      logger.warn('Twilio not configured, OTP code (DEV ONLY):', code);
      // Em desenvolvimento, apenas log o código
      if (env.NODE_ENV === 'development') {
        console.log(`\n🔐 OTP Code for ${phone}: ${code}\n`);
        return true;
      }
      throw new Error('SMS service not configured');
    }

    try {
      const message = `Seu código de verificação CTC é: ${code}. Válido por 5 minutos.`;

      const from = method === 'whatsapp'
        ? env.TWILIO_WHATSAPP_NUMBER
        : env.TWILIO_PHONE_NUMBER;

      const to = method === 'whatsapp'
        ? `whatsapp:${phone}`
        : phone;

      await client.messages.create({
        body: message,
        from,
        to,
      });

      logger.info(`OTP sent via ${method} to ${phone}`);
      return true;
    } catch (error) {
      logger.error('Failed to send OTP', error);
      throw new Error('Failed to send verification code');
    }
  }
}
