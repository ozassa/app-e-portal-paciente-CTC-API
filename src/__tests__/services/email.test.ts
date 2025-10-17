import { emailService } from '../../services/email';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    verify: jest.fn(),
    sendMail: jest.fn(),
  })),
}));

describe('Email Service', () => {
  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const nodemailer = require('nodemailer');
    mockTransporter = nodemailer.createTransport();
  });

  describe('Service Configuration', () => {
    it('should report service status correctly', () => {
      const status = emailService.getServiceStatus();
      
      expect(status).toBeDefined();
      expect(status.service).toBe('SMTP Email');
      expect(typeof status.configured).toBe('boolean');
      expect(Array.isArray(status.availableTemplates)).toBe(true);
    });

    it('should have all expected templates', () => {
      const status = emailService.getServiceStatus();
      const expectedTemplates = [
        'appointment_confirmation',
        'appointment_reminder',
        'two_factor_auth',
        'password_reset',
        'appointment_cancelled',
        'welcome_message',
      ];

      expectedTemplates.forEach(template => {
        expect(status.availableTemplates).toContain(template);
      });
    });

    it('should verify transporter connection', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const canConnect = await emailService.verifyConnection();
      expect(canConnect).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should handle connection verification failure', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      const canConnect = await emailService.verifyConnection();
      expect(canConnect).toBe(false);
    });
  });

  describe('Send Email', () => {
    it('should send email successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        response: '250 2.0.0 OK',
        accepted: ['recipient@example.com'],
        rejected: [],
      });

      const result = await emailService.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test message content'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<test@example.com>');
      expect(result.email).toBe('recipient@example.com');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message content',
        html: undefined,
      });
    });

    it('should send HTML email', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['recipient@example.com'],
      });

      const result = await emailService.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Plain text content',
        '<h1>HTML content</h1>'
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Plain text content',
          html: '<h1>HTML content</h1>',
        })
      );
    });

    it('should handle email sending failure', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await emailService.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test content'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP error');
      expect(result.email).toBe('recipient@example.com');
    });

    it('should handle rejected recipients', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: [],
        rejected: ['invalid@example.com'],
      });

      const result = await emailService.sendEmail(
        'invalid@example.com',
        'Test Subject',
        'Test content'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('rejected');
    });
  });

  describe('Templated Email', () => {
    it('should send templated email with variables', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['recipient@example.com'],
      });

      const result = await emailService.sendTemplatedEmail(
        'recipient@example.com',
        'appointment_confirmation',
        {
          patient_name: 'João Silva',
          appointment_date: '15/01/2024',
          appointment_time: '14:30',
          doctor_name: 'Dr. Maria',
          unit_name: 'Clínica Central',
          unit_address: 'Rua das Flores, 123',
        }
      );

      expect(result.success).toBe(true);
      
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.subject).toContain('Consulta Confirmada');
      expect(emailCall.text).toContain('João Silva');
      expect(emailCall.text).toContain('15/01/2024');
      expect(emailCall.text).toContain('14:30');
      expect(emailCall.text).toContain('Dr. Maria');
      expect(emailCall.html).toContain('João Silva');
    });

    it('should handle invalid template ID', async () => {
      const result = await emailService.sendTemplatedEmail(
        'recipient@example.com',
        'invalid_template' as any,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should replace all template variables in both text and HTML', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['recipient@example.com'],
      });

      await emailService.sendTemplatedEmail(
        'recipient@example.com',
        'two_factor_auth',
        {
          verification_code: '123456',
          expires_in: '5 minutos',
        }
      );

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      
      // Check text version
      expect(emailCall.text).toContain('123456');
      expect(emailCall.text).toContain('5 minutos');
      expect(emailCall.text).not.toContain('{{verification_code}}');
      expect(emailCall.text).not.toContain('{{expires_in}}');
      
      // Check HTML version
      expect(emailCall.html).toContain('123456');
      expect(emailCall.html).toContain('5 minutos');
      expect(emailCall.html).not.toContain('{{verification_code}}');
      expect(emailCall.html).not.toContain('{{expires_in}}');
    });
  });

  describe('Bulk Email', () => {
    it('should send multiple emails', async () => {
      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: '<msg1@example.com>', accepted: ['user1@example.com'] })
        .mockResolvedValueOnce({ messageId: '<msg2@example.com>', accepted: ['user2@example.com'] })
        .mockResolvedValueOnce({ messageId: '<msg3@example.com>', accepted: ['user3@example.com'] });

      const emails = [
        { email: 'user1@example.com', subject: 'Subject 1', message: 'Message 1' },
        { email: 'user2@example.com', subject: 'Subject 2', message: 'Message 2' },
        { email: 'user3@example.com', subject: 'Subject 3', message: 'Message 3' },
      ];

      const result = await emailService.sendBulkEmails(emails);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in bulk emails', async () => {
      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: '<msg1@example.com>', accepted: ['user1@example.com'] })
        .mockRejectedValueOnce(new Error('SMTP timeout'))
        .mockResolvedValueOnce({ messageId: '<msg3@example.com>', accepted: ['user3@example.com'] });

      const emails = [
        { email: 'user1@example.com', subject: 'Subject 1', message: 'Message 1' },
        { email: 'user2@example.com', subject: 'Subject 2', message: 'Message 2' },
        { email: 'user3@example.com', subject: 'Subject 3', message: 'Message 3' },
      ];

      const result = await emailService.sendBulkEmails(emails);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain('SMTP timeout');
    });

    it('should respect rate limiting in bulk operations', async () => {
      const emails = Array(5).fill(null).map((_, i) => ({
        email: `user${i}@example.com`,
        subject: `Subject ${i}`,
        message: `Message ${i}`,
      }));

      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['user@example.com'],
      });

      const startTime = Date.now();
      await emailService.sendBulkEmails(emails);
      const endTime = Date.now();

      // Should take some time due to rate limiting delays
      expect(endTime - startTime).toBeGreaterThan(500); // At least 500ms for 5 emails
    });
  });

  describe('Email with Attachments', () => {
    it('should send email with attachments', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['recipient@example.com'],
      });

      const attachments = [
        {
          filename: 'document.pdf',
          content: Buffer.from('PDF content'),
          contentType: 'application/pdf',
        },
        {
          filename: 'image.jpg',
          path: '/path/to/image.jpg',
        },
      ];

      const result = await emailService.sendEmailWithAttachments(
        'recipient@example.com',
        'Test Subject',
        'Test content',
        attachments
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: attachments,
        })
      );
    });

    it('should handle attachment size limits', async () => {
      const largeAttachment = {
        filename: 'large-file.pdf',
        content: Buffer.alloc(20 * 1024 * 1024), // 20MB file
        contentType: 'application/pdf',
      };

      const result = await emailService.sendEmailWithAttachments(
        'recipient@example.com',
        'Test Subject',
        'Test content',
        [largeAttachment]
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Attachment too large');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid email addresses', async () => {
      const result = await emailService.sendEmail(
        'invalid-email-address',
        'Test Subject',
        'Test content'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should handle empty subject and content', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['recipient@example.com'],
      });

      const result = await emailService.sendEmail(
        'recipient@example.com',
        '',
        ''
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '',
          text: '',
        })
      );
    });

    it('should handle very long subject lines', async () => {
      const longSubject = 'A'.repeat(1000);
      
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['recipient@example.com'],
      });

      const result = await emailService.sendEmail(
        'recipient@example.com',
        longSubject,
        'Test content'
      );

      expect(result.success).toBe(true);
      // Should truncate or handle long subjects appropriately
    });

    it('should handle network timeouts', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await emailService.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test content'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('ETIMEDOUT');
    });

    it('should handle authentication failures', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Authentication failed'));

      const result = await emailService.sendEmail(
        'recipient@example.com',
        'Test Subject',
        'Test content'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });
  });

  describe('HTML Template Processing', () => {
    it('should generate proper HTML structure', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['recipient@example.com'],
      });

      await emailService.sendTemplatedEmail(
        'recipient@example.com',
        'welcome_message',
        {
          patient_name: 'João Silva',
          card_number: '1234567890',
        }
      );

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      
      // Check HTML structure
      expect(emailCall.html).toContain('<!DOCTYPE html>');
      expect(emailCall.html).toContain('<html');
      expect(emailCall.html).toContain('<head>');
      expect(emailCall.html).toContain('<body>');
      expect(emailCall.html).toContain('João Silva');
      expect(emailCall.html).toContain('1234567890');
    });

    it('should include proper CSS styling', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['recipient@example.com'],
      });

      await emailService.sendTemplatedEmail(
        'recipient@example.com',
        'appointment_confirmation',
        {
          patient_name: 'João Silva',
          appointment_date: '15/01/2024',
          appointment_time: '14:30',
          doctor_name: 'Dr. Maria',
          unit_name: 'Clínica Central',
        }
      );

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.html).toContain('<style>');
      expect(emailCall.html).toContain('color:');
      expect(emailCall.html).toContain('font-family:');
    });
  });

  describe('Service Not Configured', () => {
    it('should handle service not configured gracefully', () => {
      const originalHost = process.env.SMTP_HOST;
      delete process.env.SMTP_HOST;

      const status = emailService.getServiceStatus();
      expect(status.configured).toBe(false);

      // Restore environment
      if (originalHost) {
        process.env.SMTP_HOST = originalHost;
      }
    });
  });
});