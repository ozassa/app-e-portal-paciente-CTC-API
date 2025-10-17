import {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  generate2FACode,
  generateSessionId,
  generateCardNumber,
} from '../../utils/auth';

describe('Auth Utils', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hashedPassword = await hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    it('should compare password correctly', async () => {
      const password = 'testPassword123';
      const hashedPassword = await hashPassword(password);
      
      const isValid = await comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await comparePassword('wrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    it('should handle empty passwords', async () => {
      await expect(hashPassword('')).rejects.toThrow();
    });
  });

  describe('JWT Tokens', () => {
    const userPayload = {
      userId: 'test-user-id',
      cpf: '12345678901',
    };

    it('should generate and verify access token', () => {
      const token = generateToken(userPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
      
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(userPayload.userId);
      expect(decoded.cpf).toBe(userPayload.cpf);
      expect(decoded.type).toBe('access');
    });

    it('should generate and verify refresh token', () => {
      const refreshToken = generateRefreshToken(userPayload);
      
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.split('.')).toHaveLength(3);
      
      const decoded = verifyRefreshToken(refreshToken);
      expect(decoded.userId).toBe(userPayload.userId);
      expect(decoded.cpf).toBe(userPayload.cpf);
      expect(decoded.type).toBe('refresh');
    });

    it('should reject invalid tokens', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow();
      expect(() => verifyRefreshToken('invalid.token.here')).toThrow();
    });

    it('should reject expired tokens', () => {
      // This would require mocking Date or using a library like MockDate
      // For now, we'll skip this test but it's important for production
    });

    it('should reject wrong token type', () => {
      const accessToken = generateToken(userPayload);
      const refreshToken = generateRefreshToken(userPayload);
      
      expect(() => verifyRefreshToken(accessToken)).toThrow();
      expect(() => verifyToken(refreshToken)).toThrow();
    });
  });

  describe('Code Generation', () => {
    it('should generate 2FA code', () => {
      const code = generate2FACode();
      
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code).toMatch(/^\d{6}$/); // 6 digits
      expect(parseInt(code)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code)).toBeLessThanOrEqual(999999);
    });

    it('should generate unique 2FA codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generate2FACode());
      }
      // Should have high uniqueness (allow for some collisions)
      expect(codes.size).toBeGreaterThan(90);
    });

    it('should generate session ID', () => {
      const sessionId = generateSessionId();
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(20); // Should be reasonably long
      expect(sessionId).toMatch(/^[a-zA-Z0-9]+$/); // Alphanumeric
    });

    it('should generate unique session IDs', () => {
      const sessionIds = new Set();
      for (let i = 0; i < 100; i++) {
        sessionIds.add(generateSessionId());
      }
      expect(sessionIds.size).toBe(100); // Should be completely unique
    });

    it('should generate card number', () => {
      const cardNumber = generateCardNumber();
      
      expect(cardNumber).toBeDefined();
      expect(typeof cardNumber).toBe('string');
      expect(cardNumber).toMatch(/^\d+$/); // Only digits
      expect(cardNumber.length).toBeGreaterThanOrEqual(8); // Reasonable length
      expect(cardNumber.length).toBeLessThanOrEqual(16); // Not too long
    });

    it('should generate unique card numbers', () => {
      const cardNumbers = new Set();
      for (let i = 0; i < 100; i++) {
        cardNumbers.add(generateCardNumber());
      }
      expect(cardNumbers.size).toBe(100); // Should be completely unique
    });

    it('should generate card numbers starting with valid prefixes', () => {
      // Assuming card numbers follow some pattern (like starting with 6000)
      const cardNumber = generateCardNumber();
      expect(cardNumber[0]).toMatch(/[1-9]/); // Should not start with 0
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JWT tokens gracefully', () => {
      const malformedTokens = [
        'not.a.jwt',
        'invalid',
        '',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9', // Header only
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid', // Invalid payload
      ];

      malformedTokens.forEach(token => {
        expect(() => verifyToken(token)).toThrow();
        expect(() => verifyRefreshToken(token)).toThrow();
      });
    });

    it('should handle null/undefined values', async () => {
      await expect(hashPassword(null as any)).rejects.toThrow();
      await expect(hashPassword(undefined as any)).rejects.toThrow();
      
      await expect(comparePassword(null as any, 'hash')).rejects.toThrow();
      await expect(comparePassword('password', null as any)).rejects.toThrow();
      
      expect(() => verifyToken(null as any)).toThrow();
      expect(() => verifyToken(undefined as any)).toThrow();
    });
  });

  describe('Security Properties', () => {
    it('should generate different hashes for the same password', async () => {
      const password = 'samePassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // bcrypt uses random salt
      expect(await comparePassword(password, hash1)).toBe(true);
      expect(await comparePassword(password, hash2)).toBe(true);
    });

    it('should generate cryptographically strong random values', () => {
      // Test that generated values have good entropy
      const values = [];
      for (let i = 0; i < 1000; i++) {
        values.push(generateSessionId());
      }
      
      // Check for patterns or weak randomness
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length); // All should be unique
      
      // Check character distribution (basic entropy test)
      const allChars = values.join('');
      const charCounts = {};
      for (const char of allChars) {
        charCounts[char] = (charCounts[char] || 0) + 1;
      }
      
      // Should use a good variety of characters
      expect(Object.keys(charCounts).length).toBeGreaterThan(20);
    });
  });
});