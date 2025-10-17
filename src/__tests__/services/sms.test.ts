import { smsService } from '../../services/sms';

// Mock Twilio
jest.mock('twilio', () => {
  const mockTwilio = {
    messages: {
      create: jest.fn(),
    },
    verify: {
      v2: {
        services: {
          create: jest.fn(),
          list: jest.fn(),
        },
      },
    },
  };
  return jest.fn(() => mockTwilio);
});

describe('SMS Service', () => {
  let mockTwilio: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Get mock Twilio instance
    const Twilio = require('twilio');
    mockTwilio = Twilio();
  });

  describe('Service Configuration', () => {
    it('should report service status correctly', () => {
      const status = smsService.getServiceStatus();
      
      expect(status).toBeDefined();
      expect(status.service).toBe('Twilio SMS');
      expect(typeof status.configured).toBe('boolean');
      expect(Array.isArray(status.availableTemplates)).toBe(true);
    });

    it('should have all expected templates', () => {
      const status = smsService.getServiceStatus();
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
  });

  describe('Send SMS', () => {
    it('should send SMS successfully', async () => {
      // Mock successful SMS sending
      mockTwilio.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
        status: 'sent',
        to: '+5511999888777',
      });

      const result = await smsService.sendSMS('+5511999888777', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM1234567890abcdef');
      expect(result.phone).toBe('+5511999888777');
      expect(mockTwilio.messages.create).toHaveBeenCalledWith({
        body: 'Test message',
        from: expect.any(String),
        to: '+5511999888777',
      });
    });

    it('should handle SMS sending failure', async () => {
      // Mock SMS sending failure
      mockTwilio.messages.create.mockRejectedValue(new Error('Network error'));

      const result = await smsService.sendSMS('+5511999888777', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(result.phone).toBe('+5511999888777');
    });

    it('should format phone numbers correctly', async () => {
      mockTwilio.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
        status: 'sent',
        to: '+5511999888777',
      });

      // Test various phone number formats
      await smsService.sendSMS('11999888777', 'Test'); // Without country code
      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+5511999888777',
        })
      );

      await smsService.sendSMS('5511999888777', 'Test'); // With country code
      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+5511999888777',
        })
      );

      await smsService.sendSMS('+5511999888777', 'Test'); // Already formatted
      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+5511999888777',
        })
      );
    });
  });

  describe('Templated SMS', () => {
    it('should send templated SMS with variables', async () => {
      mockTwilio.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
        status: 'sent',
        to: '+5511999888777',
      });

      const result = await smsService.sendTemplatedSMS(
        '+5511999888777',
        'appointment_confirmation',
        {
          patient_name: 'João Silva',
          appointment_date: '15/01/2024',
          appointment_time: '14:30',
          doctor_name: 'Dr. Maria',
          unit_name: 'Clínica Central',
        }
      );

      expect(result.success).toBe(true);
      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('João Silva'),
          to: '+5511999888777',
        })
      );
    });

    it('should handle invalid template ID', async () => {
      const result = await smsService.sendTemplatedSMS(
        '+5511999888777',
        'invalid_template' as any,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found');
      expect(mockTwilio.messages.create).not.toHaveBeenCalled();
    });

    it('should replace all template variables', async () => {
      mockTwilio.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
        status: 'sent',
      });

      await smsService.sendTemplatedSMS(
        '+5511999888777',
        'two_factor_auth',
        {
          verification_code: '123456',
          expires_in: '5 minutos',
        }
      );

      const calledWith = mockTwilio.messages.create.mock.calls[0][0];
      expect(calledWith.body).toContain('123456');
      expect(calledWith.body).toContain('5 minutos');
      expect(calledWith.body).not.toContain('{{verification_code}}');
      expect(calledWith.body).not.toContain('{{expires_in}}');
    });
  });

  describe('Bulk SMS', () => {
    it('should send multiple SMS messages', async () => {
      mockTwilio.messages.create
        .mockResolvedValueOnce({ sid: 'SM1', status: 'sent' })
        .mockResolvedValueOnce({ sid: 'SM2', status: 'sent' })
        .mockResolvedValueOnce({ sid: 'SM3', status: 'sent' });

      const messages = [
        { phone: '+5511999888777', message: 'Message 1' },
        { phone: '+5511999888778', message: 'Message 2' },
        { phone: '+5511999888779', message: 'Message 3' },
      ];

      const result = await smsService.sendBulkSMS(messages);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(mockTwilio.messages.create).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in bulk SMS', async () => {
      mockTwilio.messages.create
        .mockResolvedValueOnce({ sid: 'SM1', status: 'sent' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ sid: 'SM3', status: 'sent' });

      const messages = [
        { phone: '+5511999888777', message: 'Message 1' },
        { phone: '+5511999888778', message: 'Message 2' },
        { phone: '+5511999888779', message: 'Message 3' },
      ];

      const result = await smsService.sendBulkSMS(messages);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain('Failed');
    });
  });

  describe('2FA Specific Methods', () => {
    it('should send 2FA code', async () => {
      mockTwilio.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
        status: 'sent',
      });

      const result = await smsService.send2FACode('+5511999888777', '123456');

      expect(result).toBe(true);
      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('123456'),
          to: '+5511999888777',
        })
      );
    });

    it('should handle 2FA code sending failure', async () => {
      mockTwilio.messages.create.mockRejectedValue(new Error('Service unavailable'));

      const result = await smsService.send2FACode('+5511999888777', '123456');

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty phone numbers', async () => {
      const result = await smsService.sendSMS('', 'Test message');

      expect(result.success).toBe(false);
      expect(mockTwilio.messages.create).not.toHaveBeenCalled();
    });

    it('should handle empty messages', async () => {
      const result = await smsService.sendSMS('+5511999888777', '');

      expect(result.success).toBe(false);
      expect(mockTwilio.messages.create).not.toHaveBeenCalled();
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(2000); // Very long message
      
      mockTwilio.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
        status: 'sent',
      });

      const result = await smsService.sendSMS('+5511999888777', longMessage);

      expect(result.success).toBe(true);
      // Twilio automatically handles long messages by splitting them
    });

    it('should handle invalid phone number format', async () => {
      const result = await smsService.sendSMS('invalid-phone', 'Test message');

      // Service should still attempt to send (Twilio will handle validation)
      expect(mockTwilio.messages.create).toHaveBeenCalled();
    });

    it('should respect rate limiting in bulk operations', async () => {
      // Mock implementation should include delays
      const messages = Array(5).fill(null).map((_, i) => ({
        phone: `+551199988877${i}`,
        message: `Message ${i}`,
      }));

      mockTwilio.messages.create.mockResolvedValue({
        sid: 'SM1234567890abcdef',
        status: 'sent',
      });

      const startTime = Date.now();
      await smsService.sendBulkSMS(messages);
      const endTime = Date.now();

      // Should take some time due to rate limiting delays
      expect(endTime - startTime).toBeGreaterThan(1000); // At least 1 second for 5 messages
    });
  });

  describe('Service Not Configured', () => {
    it('should handle service not configured gracefully', () => {
      // Test behavior when Twilio credentials are not set
      const originalEnv = process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_ACCOUNT_SID;

      const status = smsService.getServiceStatus();
      expect(status.configured).toBe(false);

      // Restore environment
      if (originalEnv) {
        process.env.TWILIO_ACCOUNT_SID = originalEnv;
      }
    });
  });
});