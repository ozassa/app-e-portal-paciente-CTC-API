import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import authRoutes from '../../routes/auth';
import { hashPassword } from '../../utils/auth';

// Mock notification service
jest.mock('../../services/notification', () => ({
  notificationService: {
    send2FACode: jest.fn().mockResolvedValue({ success: true, channels: { sms: { success: true } } }),
    sendPasswordReset: jest.fn().mockResolvedValue({ success: true, channels: { sms: { success: true } } }),
  },
}));

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Controller', () => {
  let testUser: any;
  let testSession: any;

  beforeEach(async () => {
    // Create test user
    const hashedPassword = await hashPassword('TestPass123!');
    testUser = await global.prisma.user.create({
      data: {
        name: 'Test User',
        cpf: '12345678901',
        phone: '11999888777',
        email: 'test@example.com',
        password: hashedPassword,
        plan: 'PREMIUM',
        cardNumber: '1234567890',
        isActive: true,
      },
    });
  });

  describe('POST /auth/login', () => {
    it('should initiate login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          cpf: '12345678901',
          password: 'TestPass123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '2FA required');
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('expiresIn', 300);
      expect(typeof response.body.sessionId).toBe('string');
    });

    it('should reject login with invalid CPF', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          cpf: '12345678902', // Wrong CPF
          password: 'TestPass123!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          cpf: '12345678901',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with malformed CPF', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          cpf: '123.456.789-01', // Formatted CPF
          password: 'TestPass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          cpf: '12345678901',
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject login for inactive user', async () => {
      // Deactivate user
      await global.prisma.user.update({
        where: { id: testUser.id },
        data: { isActive: false },
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          cpf: '12345678901',
          password: 'TestPass123!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/verify-2fa', () => {
    beforeEach(async () => {
      // Create test session
      testSession = await global.prisma.authSession.create({
        data: {
          userId: testUser.id,
          sessionId: 'test-session-id',
          twoFactorCode: '123456',
          phoneNumber: testUser.phone,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          isVerified: false,
        },
      });
    });

    it('should verify 2FA with correct code', async () => {
      const response = await request(app)
        .post('/auth/verify-2fa')
        .send({
          sessionId: 'test-session-id',
          code: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', testUser.id);
      expect(response.body.user).toHaveProperty('name', testUser.name);
      expect(response.body.user).not.toHaveProperty('password'); // Should not include password
    });

    it('should reject 2FA with incorrect code', async () => {
      const response = await request(app)
        .post('/auth/verify-2fa')
        .send({
          sessionId: 'test-session-id',
          code: '654321', // Wrong code
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject 2FA with invalid session ID', async () => {
      const response = await request(app)
        .post('/auth/verify-2fa')
        .send({
          sessionId: 'invalid-session-id',
          code: '123456',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject 2FA with expired session', async () => {
      // Update session to be expired
      await global.prisma.authSession.update({
        where: { id: testSession.id },
        data: { expiresAt: new Date(Date.now() - 1000) }, // Expired
      });

      const response = await request(app)
        .post('/auth/verify-2fa')
        .send({
          sessionId: 'test-session-id',
          code: '123456',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject already verified session', async () => {
      // Mark session as already verified
      await global.prisma.authSession.update({
        where: { id: testSession.id },
        data: { isVerified: true },
      });

      const response = await request(app)
        .post('/auth/verify-2fa')
        .send({
          sessionId: 'test-session-id',
          code: '123456',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/resend-2fa', () => {
    beforeEach(async () => {
      testSession = await global.prisma.authSession.create({
        data: {
          userId: testUser.id,
          sessionId: 'test-session-id',
          twoFactorCode: '123456',
          phoneNumber: testUser.phone,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          isVerified: false,
        },
      });
    });

    it('should resend 2FA code for valid session', async () => {
      const response = await request(app)
        .post('/auth/resend-2fa')
        .send({
          sessionId: 'test-session-id',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('expiresIn');
    });

    it('should reject resend for invalid session', async () => {
      const response = await request(app)
        .post('/auth/resend-2fa')
        .send({
          sessionId: 'invalid-session-id',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should update 2FA code when resending', async () => {
      const originalCode = testSession.twoFactorCode;

      await request(app)
        .post('/auth/resend-2fa')
        .send({
          sessionId: 'test-session-id',
        });

      // Check that code was updated
      const updatedSession = await global.prisma.authSession.findUnique({
        where: { sessionId: 'test-session-id' },
      });

      expect(updatedSession?.twoFactorCode).not.toBe(originalCode);
      expect(updatedSession?.twoFactorCode).toMatch(/^\d{6}$/);
    });
  });

  describe('POST /auth/signup', () => {
    it('should create new user with valid data', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'New User',
          cpf: '98765432100',
          phone: '11888777666',
          email: 'newuser@example.com',
          password: 'NewPass123!',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('userId');

      // Verify user was created in database
      const createdUser = await global.prisma.user.findUnique({
        where: { cpf: '98765432100' },
      });

      expect(createdUser).toBeTruthy();
      expect(createdUser?.name).toBe('New User');
      expect(createdUser?.email).toBe('newuser@example.com');
      expect(createdUser?.isActive).toBe(true);
    });

    it('should reject signup with existing CPF', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'Another User',
          cpf: '12345678901', // Same as existing user
          phone: '11777666555',
          email: 'another@example.com',
          password: 'AnotherPass123!',
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject signup with invalid CPF', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'New User',
          cpf: '11111111111', // Invalid CPF
          phone: '11888777666',
          email: 'newuser@example.com',
          password: 'NewPass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject signup with weak password', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'New User',
          cpf: '98765432100',
          phone: '11888777666',
          email: 'newuser@example.com',
          password: 'weak', // Weak password
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject signup with missing required fields', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'New User',
          // Missing CPF, phone, password
          email: 'newuser@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should generate unique card number for new user', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: 'New User',
          cpf: '98765432100',
          phone: '11888777666',
          email: 'newuser@example.com',
          password: 'NewPass123!',
        });

      expect(response.status).toBe(201);

      const createdUser = await global.prisma.user.findUnique({
        where: { cpf: '98765432100' },
      });

      expect(createdUser?.cardNumber).toBeTruthy();
      expect(createdUser?.cardNumber).not.toBe(testUser.cardNumber);
      expect(createdUser?.cardNumber).toMatch(/^\d+$/);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should initiate password reset for existing user', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          cpf: '12345678901',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('sessionId');
    });

    it('should not reveal if user exists (security)', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          cpf: '99999999999', // Non-existent user
        });

      // Should return same response to prevent user enumeration
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject invalid CPF format', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          cpf: 'invalid-cpf',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/reset-password', () => {
    beforeEach(async () => {
      // Create password reset session
      testSession = await global.prisma.authSession.create({
        data: {
          userId: testUser.id,
          sessionId: 'reset-session-id',
          twoFactorCode: '789012',
          phoneNumber: testUser.phone,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          isVerified: false,
        },
      });
    });

    it('should reset password with valid code', async () => {
      const newPassword = 'NewPassword123!';

      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          sessionId: 'reset-session-id',
          code: '789012',
          newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify password was changed
      const updatedUser = await global.prisma.user.findUnique({
        where: { id: testUser.id },
      });

      // Try logging in with new password
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          cpf: '12345678901',
          password: newPassword,
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should reject password reset with invalid code', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          sessionId: 'reset-session-id',
          code: '000000', // Wrong code
          newPassword: 'NewPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject weak new password', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          sessionId: 'reset-session-id',
          code: '789012',
          newPassword: 'weak', // Weak password
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      // Login and get token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          cpf: '12345678901',
          password: 'TestPass123!',
        });

      const sessionId = loginResponse.body.sessionId;

      const verifyResponse = await request(app)
        .post('/auth/verify-2fa')
        .send({
          sessionId,
          code: '123456',
        });

      authToken = verifyResponse.body.token;
    });

    it('should logout authenticated user', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject logout with invalid token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should handle multiple failed login attempts', async () => {
      // Attempt multiple failed logins
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/auth/login')
          .send({
            cpf: '12345678901',
            password: 'WrongPassword',
          })
      );

      const responses = await Promise.all(promises);

      // All should fail
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });

    it('should validate input lengths', async () => {
      const longInput = 'A'.repeat(10000);

      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: longInput,
          cpf: '98765432100',
          phone: '11888777666',
          email: 'test@example.com',
          password: 'ValidPass123!',
        });

      expect(response.status).toBe(400);
    });

    it('should sanitize input to prevent injection', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          name: '<script>alert("xss")</script>',
          cpf: '98765432100',
          phone: '11888777666',
          email: 'test@example.com',
          password: 'ValidPass123!',
        });

      if (response.status === 201) {
        const user = await global.prisma.user.findUnique({
          where: { cpf: '98765432100' },
        });
        expect(user?.name).not.toContain('<script>');
      }
    });
  });
});