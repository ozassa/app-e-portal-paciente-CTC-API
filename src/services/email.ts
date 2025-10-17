import nodemailer from 'nodemailer';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: string[];
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private templates: Map<string, EmailTemplate>;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    this.initializeTemplates();
  }

  private initializeTemplates() {
    this.templates = new Map([
      ['welcome', {
        id: 'welcome',
        name: 'Boas-vindas',
        subject: 'Bem-vindo(a) ao {appName}!',
        htmlTemplate: this.generateWelcomeEmailHTML('{name}'),
        textTemplate: this.generateWelcomeEmailText('{name}'),
        variables: ['name', 'appName', 'appUrl']
      }],
      ['password-reset', {
        id: 'password-reset',
        name: 'Redefinição de Senha',
        subject: 'Redefinição de senha - {appName}',
        htmlTemplate: this.generatePasswordResetEmailHTML('{resetUrl}'),
        textTemplate: this.generatePasswordResetEmailText('{resetUrl}'),
        variables: ['resetUrl', 'appName']
      }],
      ['appointment-confirmation', {
        id: 'appointment-confirmation',
        name: 'Confirmação de Consulta',
        subject: 'Consulta confirmada - {appName}',
        htmlTemplate: '',
        textTemplate: '',
        variables: ['name', 'doctorName', 'date', 'time', 'unitName', 'unitAddress', 'specialtyName', 'appName']
      }],
      ['appointment-reminder', {
        id: 'appointment-reminder',
        name: 'Lembrete de Consulta',
        subject: 'Lembrete de consulta - {appName}',
        htmlTemplate: '',
        textTemplate: '',
        variables: ['name', 'doctorName', 'date', 'time', 'unitName', 'unitAddress', 'specialtyName', 'appName']
      }],
    ]);
  }

  private processTemplate(template: string, variables: Record<string, string>): string {
    let processed = template;
    for (const [key, value] of Object.entries(variables)) {
      processed = processed.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return processed;
  }

  async sendTemplatedEmail(to: string, templateId: string, variables: Record<string, string>): Promise<EmailResult> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      const subject = this.processTemplate(template.subject, variables);
      const html = this.processTemplate(template.htmlTemplate, variables);
      const text = this.processTemplate(template.textTemplate, variables);

      const mailOptions = {
        from: `"${config.APP_NAME}" <${config.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Templated email sent successfully', {
        messageId: result.messageId,
        template: templateId,
        to: this.maskEmail(to),
        subject,
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error sending templated email:', {
        error: errorMessage,
        template: templateId,
        to: this.maskEmail(to),
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"${config.APP_NAME}" <${config.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: this.maskEmail(options.to),
        subject: options.subject,
      });

      return true;
    } catch (error) {
      logger.error('Error sending email:', {
        error: error instanceof Error ? error.message : error,
        to: this.maskEmail(options.to),
        subject: options.subject,
      });
      return false;
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const result = await this.sendTemplatedEmail(email, 'welcome', {
      name,
      appName: config.APP_NAME,
      appUrl: config.APP_URL,
    });
    return result.success;
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${config.APP_URL}/reset-password?token=${resetToken}`;
    const result = await this.sendTemplatedEmail(email, 'password-reset', {
      resetUrl,
      appName: config.APP_NAME,
    });
    return result.success;
  }

  async sendAppointmentConfirmationEmail(
    email: string,
    name: string,
    appointmentDetails: {
      doctorName: string;
      date: string;
      time: string;
      unitName: string;
      unitAddress: string;
      specialtyName: string;
    }
  ): Promise<boolean> {
    const subject = `Consulta confirmada - ${config.APP_NAME}`;
    const html = this.generateAppointmentConfirmationEmailHTML(name, appointmentDetails);
    const text = this.generateAppointmentConfirmationEmailText(name, appointmentDetails);

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendAppointmentReminderEmail(
    email: string,
    name: string,
    appointmentDetails: {
      doctorName: string;
      date: string;
      time: string;
      unitName: string;
      unitAddress: string;
      specialtyName: string;
    }
  ): Promise<boolean> {
    const subject = `Lembrete de consulta - ${config.APP_NAME}`;
    const html = this.generateAppointmentReminderEmailHTML(name, appointmentDetails);
    const text = this.generateAppointmentReminderEmailText(name, appointmentDetails);

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendAppointmentCancellationEmail(
    email: string,
    name: string,
    appointmentDetails: {
      doctorName: string;
      date: string;
      time: string;
      unitName: string;
      specialtyName: string;
    }
  ): Promise<boolean> {
    const subject = `Consulta cancelada - ${config.APP_NAME}`;
    const html = this.generateAppointmentCancellationEmailHTML(name, appointmentDetails);
    const text = this.generateAppointmentCancellationEmailText(name, appointmentDetails);

    return this.sendEmail({ to: email, subject, html, text });
  }

  private generateWelcomeEmailHTML(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao ${config.APP_NAME}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔮 ${config.APP_NAME}</h1>
            <p>Bem-vindo(a) à sua nova experiência em saúde!</p>
          </div>
          <div class="content">
            <h2>Olá, ${name}!</h2>
            <p>É com grande prazer que damos as boas-vindas ao <strong>${config.APP_NAME}</strong>!</p>
            <p>Sua conta foi criada com sucesso e você já pode começar a aproveitar todos os nossos recursos:</p>
            <ul>
              <li>📅 Agendamento de consultas online</li>
              <li>🏥 Localização de unidades próximas</li>
              <li>👨‍👩‍👧‍👦 Gerenciamento de dependentes</li>
              <li>📱 Carteirinha digital sempre à mão</li>
              <li>🔔 Notificações e lembretes</li>
            </ul>
            <p>Para começar, acesse o aplicativo em seu celular ou computador:</p>
            <a href="${config.APP_URL}" class="button">Acessar ${config.APP_NAME}</a>
            <p>Se você tiver alguma dúvida ou precisar de ajuda, nossa equipe de suporte está sempre disponível.</p>
          </div>
          <div class="footer">
            <p>Atenciosamente,<br><strong>Equipe ${config.APP_NAME}</strong></p>
            <p style="font-size: 12px; color: #6b7280;">
              Este é um e-mail automático, por favor não responda. Para suporte, entre em contato através do aplicativo.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateWelcomeEmailText(name: string): string {
    return `
      Bem-vindo ao ${config.APP_NAME}!

      Olá, ${name}!

      É com grande prazer que damos as boas-vindas ao ${config.APP_NAME}!

      Sua conta foi criada com sucesso e você já pode começar a aproveitar todos os nossos recursos:

      - Agendamento de consultas online
      - Localização de unidades próximas
      - Gerenciamento de dependentes
      - Carteirinha digital sempre à mão
      - Notificações e lembretes

      Para começar, acesse: ${config.APP_URL}

      Se você tiver alguma dúvida ou precisar de ajuda, nossa equipe de suporte está sempre disponível.

      Atenciosamente,
      Equipe ${config.APP_NAME}

      Este é um e-mail automático, por favor não responda.
    `;
  }

  private generatePasswordResetEmailHTML(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Redefinição de senha</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Redefinição de Senha</h1>
          </div>
          <div class="content">
            <h2>Solicitação de redefinição de senha</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no ${config.APP_NAME}.</p>
            <p>Para criar uma nova senha, clique no botão abaixo:</p>
            <a href="${resetUrl}" class="button">Redefinir Senha</a>
            <div class="warning">
              <strong>⚠️ Importante:</strong>
              <ul>
                <li>Este link é válido por apenas 1 hora</li>
                <li>Se você não solicitou esta redefinição, ignore este e-mail</li>
                <li>Nunca compartilhe este link com outras pessoas</li>
              </ul>
            </div>
            <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">${resetUrl}</p>
          </div>
          <div class="footer">
            <p>Atenciosamente,<br><strong>Equipe ${config.APP_NAME}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetEmailText(resetUrl: string): string {
    return `
      Redefinição de senha - ${config.APP_NAME}

      Recebemos uma solicitação para redefinir a senha da sua conta.

      Para criar uma nova senha, acesse: ${resetUrl}

      IMPORTANTE:
      - Este link é válido por apenas 1 hora
      - Se você não solicitou esta redefinição, ignore este e-mail
      - Nunca compartilhe este link com outras pessoas

      Atenciosamente,
      Equipe ${config.APP_NAME}
    `;
  }

  private generateAppointmentConfirmationEmailHTML(name: string, details: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Consulta confirmada</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
          .appointment-details { background: #f0fdf4; border: 1px solid #22c55e; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Consulta Confirmada</h1>
          </div>
          <div class="content">
            <h2>Olá, ${name}!</h2>
            <p>Sua consulta foi confirmada com sucesso!</p>
            <div class="appointment-details">
              <h3>📋 Detalhes da Consulta</h3>
              <p><strong>Médico:</strong> ${details.doctorName}</p>
              <p><strong>Especialidade:</strong> ${details.specialtyName}</p>
              <p><strong>Data:</strong> ${details.date}</p>
              <p><strong>Horário:</strong> ${details.time}</p>
              <p><strong>Local:</strong> ${details.unitName}</p>
              <p><strong>Endereço:</strong> ${details.unitAddress}</p>
            </div>
            <p><strong>⏰ Lembrete:</strong> Chegue com 15 minutos de antecedência e traga um documento com foto.</p>
            <p>Você receberá um lembrete por SMS e e-mail antes da consulta.</p>
          </div>
          <div class="footer">
            <p>Atenciosamente,<br><strong>Equipe ${config.APP_NAME}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateAppointmentConfirmationEmailText(name: string, details: any): string {
    return `
      Consulta confirmada - ${config.APP_NAME}

      Olá, ${name}!

      Sua consulta foi confirmada com sucesso!

      DETALHES DA CONSULTA:
      Médico: ${details.doctorName}
      Especialidade: ${details.specialtyName}
      Data: ${details.date}
      Horário: ${details.time}
      Local: ${details.unitName}
      Endereço: ${details.unitAddress}

      LEMBRETE: Chegue com 15 minutos de antecedência e traga um documento com foto.

      Você receberá um lembrete por SMS e e-mail antes da consulta.

      Atenciosamente,
      Equipe ${config.APP_NAME}
    `;
  }

  private generateAppointmentReminderEmailHTML(name: string, details: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Lembrete de consulta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
          .appointment-details { background: #fffbeb; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Lembrete de Consulta</h1>
          </div>
          <div class="content">
            <h2>Olá, ${name}!</h2>
            <p>Este é um lembrete sobre sua consulta marcada para amanhã:</p>
            <div class="appointment-details">
              <h3>📋 Detalhes da Consulta</h3>
              <p><strong>Médico:</strong> ${details.doctorName}</p>
              <p><strong>Especialidade:</strong> ${details.specialtyName}</p>
              <p><strong>Data:</strong> ${details.date}</p>
              <p><strong>Horário:</strong> ${details.time}</p>
              <p><strong>Local:</strong> ${details.unitName}</p>
              <p><strong>Endereço:</strong> ${details.unitAddress}</p>
            </div>
            <p><strong>📝 Não esqueça:</strong></p>
            <ul>
              <li>Chegue com 15 minutos de antecedência</li>
              <li>Traga um documento com foto</li>
              <li>Traga sua carteirinha (física ou digital)</li>
              <li>Se necessário, traga exames anteriores</li>
            </ul>
          </div>
          <div class="footer">
            <p>Atenciosamente,<br><strong>Equipe ${config.APP_NAME}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateAppointmentReminderEmailText(name: string, details: any): string {
    return `
      Lembrete de consulta - ${config.APP_NAME}

      Olá, ${name}!

      Este é um lembrete sobre sua consulta marcada para amanhã:

      DETALHES DA CONSULTA:
      Médico: ${details.doctorName}
      Especialidade: ${details.specialtyName}
      Data: ${details.date}
      Horário: ${details.time}
      Local: ${details.unitName}
      Endereço: ${details.unitAddress}

      NÃO ESQUEÇA:
      - Chegue com 15 minutos de antecedência
      - Traga um documento com foto
      - Traga sua carteirinha (física ou digital)
      - Se necessário, traga exames anteriores

      Atenciosamente,
      Equipe ${config.APP_NAME}
    `;
  }

  private generateAppointmentCancellationEmailHTML(name: string, details: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Consulta cancelada</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
          .appointment-details { background: #fef2f2; border: 1px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Consulta Cancelada</h1>
          </div>
          <div class="content">
            <h2>Olá, ${name}!</h2>
            <p>Informamos que sua consulta foi cancelada:</p>
            <div class="appointment-details">
              <h3>📋 Consulta Cancelada</h3>
              <p><strong>Médico:</strong> ${details.doctorName}</p>
              <p><strong>Especialidade:</strong> ${details.specialtyName}</p>
              <p><strong>Data:</strong> ${details.date}</p>
              <p><strong>Horário:</strong> ${details.time}</p>
              <p><strong>Local:</strong> ${details.unitName}</p>
            </div>
            <p>Se você precisar agendar uma nova consulta, acesse o aplicativo:</p>
            <a href="${config.APP_URL}" class="button">Agendar Nova Consulta</a>
            <p>Em caso de dúvidas, entre em contato com nossa equipe de suporte.</p>
          </div>
          <div class="footer">
            <p>Atenciosamente,<br><strong>Equipe ${config.APP_NAME}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateAppointmentCancellationEmailText(name: string, details: any): string {
    return `
      Consulta cancelada - ${config.APP_NAME}

      Olá, ${name}!

      Informamos que sua consulta foi cancelada:

      CONSULTA CANCELADA:
      Médico: ${details.doctorName}
      Especialidade: ${details.specialtyName}
      Data: ${details.date}
      Horário: ${details.time}
      Local: ${details.unitName}

      Se você precisar agendar uma nova consulta, acesse: ${config.APP_URL}

      Em caso de dúvidas, entre em contato com nossa equipe de suporte.

      Atenciosamente,
      Equipe ${config.APP_NAME}
    `;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    const maskedLocal = local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1);
    return `${maskedLocal}@${domain}`;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified successfully');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  getAvailableTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  async sendBulkEmail(recipients: string[], templateId: string, variables: Record<string, string>): Promise<{
    successful: number;
    failed: number;
    results: EmailResult[];
  }> {
    const results: EmailResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const email of recipients) {
      const result = await this.sendTemplatedEmail(email, templateId, variables);
      results.push(result);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    logger.info('Bulk email campaign completed', {
      total: recipients.length,
      successful,
      failed,
      template: templateId,
    });

    return { successful, failed, results };
  }

  async sendEmailWithAttachment(
    to: string,
    subject: string,
    html: string,
    attachments: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>
  ): Promise<boolean> {
    return this.sendEmail({
      to,
      subject,
      html,
      attachments,
    });
  }
}

export const emailService = new EmailService();