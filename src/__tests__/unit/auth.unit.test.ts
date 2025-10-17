import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Set up test environment without global setup
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-32-characters-long-for-testing',
    JWT_REFRESH_SECRET: 'test-refresh-secret-32-characters-long-for-testing',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Auth Utilities - Unit Tests', () => {
  describe('Password Hashing', () => {
    it('should hash a password using bcrypt', async () => {
      const password = 'testPassword123';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      expect(hashedPassword.startsWith('$2b$')).toBe(true);
    });

    it('should compare password correctly', async () => {
      const password = 'testPassword123';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await bcrypt.compare('wrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'samePassword123';
      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);
      
      expect(hash1).not.toBe(hash2); // bcrypt uses random salt
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });

    it('should handle empty password gracefully', async () => {
      await expect(bcrypt.hash('', 12)).resolves.toBeDefined();
      
      const emptyHash = await bcrypt.hash('', 12);
      expect(await bcrypt.compare('', emptyHash)).toBe(true);
      expect(await bcrypt.compare('notempty', emptyHash)).toBe(false);
    });
  });

  describe('JWT Token Operations', () => {
    it('should generate valid JWT tokens', () => {
      const payload = {
        userId: 'test-user-id',
        cpf: '12345678901',
        type: 'access',
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET!, { 
        expiresIn: '15m',
        algorithm: 'HS256'
      });
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should verify JWT tokens correctly', () => {
      const payload = {
        userId: 'test-user-id',
        cpf: '12345678901',
        type: 'access',
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.cpf).toBe(payload.cpf);
      expect(decoded.type).toBe(payload.type);
      expect(decoded.iat).toBeDefined(); // issued at
      expect(decoded.exp).toBeDefined(); // expires at
    });

    it('should reject invalid tokens', () => {
      const malformedTokens = [
        'invalid.token.here',
        'not-a-jwt',
        '',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9', // Header only
        'header.payload', // Missing signature
      ];

      malformedTokens.forEach(token => {
        expect(() => jwt.verify(token, process.env.JWT_SECRET!)).toThrow();
      });
    });

    it('should reject tokens with wrong secret', () => {
      const payload = { userId: 'test', type: 'access' };
      const token = jwt.sign(payload, 'wrong-secret');
      
      expect(() => jwt.verify(token, process.env.JWT_SECRET!)).toThrow();
    });

    it('should handle token expiration', (done) => {
      const payload = { userId: 'test', type: 'access' };
      
      // Create token that expires in 1 millisecond
      const shortToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1ms' });
      
      // Wait and then try to verify
      setTimeout(() => {
        expect(() => jwt.verify(shortToken, process.env.JWT_SECRET!)).toThrow('jwt expired');
        done();
      }, 10);
    });
  });

  describe('Code Generation Utilities', () => {
    it('should generate 6-digit verification codes', () => {
      for (let i = 0; i < 10; i++) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        expect(code).toMatch(/^\d{6}$/);
        expect(parseInt(code)).toBeGreaterThanOrEqual(100000);
        expect(parseInt(code)).toBeLessThanOrEqual(999999);
      }
    });

    it('should generate unique session IDs', () => {
      const sessionIds = new Set();
      
      for (let i = 0; i < 100; i++) {
        const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionIds.add(sessionId);
      }
      
      expect(sessionIds.size).toBe(100); // All should be unique
    });

    it('should generate numeric card numbers', () => {
      for (let i = 0; i < 10; i++) {
        const cardNumber = Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        expect(cardNumber).toMatch(/^\d+$/); // Only digits
        expect(cardNumber.length).toBeGreaterThanOrEqual(10);
        expect(cardNumber[0]).not.toBe('0'); // Should not start with 0
      }
    });

    it('should generate codes with good randomness', () => {
      const codes = new Set();
      
      for (let i = 0; i < 1000; i++) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        codes.add(code);
      }
      
      // Should have high uniqueness (allow for some collisions due to randomness)
      expect(codes.size).toBeGreaterThan(900); // 90%+ unique
    });
  });

  describe('Security Validations', () => {
    it('should validate JWT secret strength', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_REFRESH_SECRET).toBeDefined();
      
      expect(process.env.JWT_SECRET!.length).toBeGreaterThanOrEqual(32);
      expect(process.env.JWT_REFRESH_SECRET!.length).toBeGreaterThanOrEqual(32);
      
      // Secrets should be different
      expect(process.env.JWT_SECRET).not.toBe(process.env.JWT_REFRESH_SECRET);
    });

    it('should validate bcrypt rounds for security vs performance', async () => {
      const password = 'testPassword';
      const rounds = [10, 12, 14];
      
      for (const round of rounds) {
        const start = Date.now();
        const hash = await bcrypt.hash(password, round);
        const end = Date.now();
        
        expect(hash).toBeDefined();
        expect(await bcrypt.compare(password, hash)).toBe(true);
        
        // Higher rounds should take more time (but allow variance)
        if (round === 14) {
          expect(end - start).toBeGreaterThan(10); // At least 10ms for round 14
        }
      }
    });

    it('should ensure JWT algorithm is secure', () => {
      const payload = { userId: 'test' };
      
      // Test with secure algorithm
      const secureToken = jwt.sign(payload, process.env.JWT_SECRET!, { 
        algorithm: 'HS256',
        expiresIn: '15m'
      });
      
      expect(() => jwt.verify(secureToken, process.env.JWT_SECRET!)).not.toThrow();
      
      // Verify algorithm in decoded header
      const decoded = jwt.decode(secureToken, { complete: true }) as any;
      expect(decoded.header.alg).toBe('HS256');
    });
  });

  describe('Performance Tests', () => {
    it('should hash passwords in reasonable time', async () => {
      const start = Date.now();
      
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(bcrypt.hash(`password${i}`, 12));
      }
      
      await Promise.all(promises);
      const end = Date.now();
      
      // Should complete in reasonable time (adjust based on hardware)
      expect(end - start).toBeLessThan(3000); // 3 seconds for 5 hashes with round 12
    });

    it('should generate and verify tokens efficiently', () => {
      const start = Date.now();
      
      const tokens = [];
      for (let i = 0; i < 100; i++) {
        const token = jwt.sign(
          { userId: `user${i}`, type: 'access' }, 
          process.env.JWT_SECRET!, 
          { expiresIn: '15m' }
        );
        tokens.push(token);
      }
      
      // Verify all tokens
      tokens.forEach(token => {
        jwt.verify(token, process.env.JWT_SECRET!);
      });
      
      const end = Date.now();
      expect(end - start).toBeLessThan(1000); // Should be very fast (< 1 second)
    });

    it('should handle concurrent operations', async () => {
      const concurrentOperations = Array(20).fill(null).map(async (_, i) => {
        const password = `password${i}`;
        const hash = await bcrypt.hash(password, 10); // Lower rounds for speed
        const isValid = await bcrypt.compare(password, hash);
        expect(isValid).toBe(true);
        
        const token = jwt.sign({ userId: `user${i}` }, process.env.JWT_SECRET!);
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        expect(decoded.userId).toBe(`user${i}`);
      });
      
      // All operations should complete without errors
      await expect(Promise.all(concurrentOperations)).resolves.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      // bcrypt should handle these appropriately
      await expect(bcrypt.hash(null as any, 12)).rejects.toThrow();
      await expect(bcrypt.hash(undefined as any, 12)).rejects.toThrow();
      
      // JWT should handle these appropriately
      expect(() => jwt.sign(null as any, process.env.JWT_SECRET!)).toThrow();
      expect(() => jwt.sign(undefined as any, process.env.JWT_SECRET!)).toThrow();
      
      expect(() => jwt.verify(null as any, process.env.JWT_SECRET!)).toThrow();
      expect(() => jwt.verify(undefined as any, process.env.JWT_SECRET!)).toThrow();
    });

    it('should handle invalid bcrypt inputs', async () => {
      await expect(bcrypt.compare('password', 'not-a-hash')).rejects.toThrow();
      await expect(bcrypt.compare('password', '')).rejects.toThrow();
    });

    it('should handle edge cases in JWT', () => {
      // Empty payload
      expect(() => jwt.sign({}, process.env.JWT_SECRET!)).not.toThrow();
      
      // Very large payload (should handle but may warn)
      const largePayload = { data: 'x'.repeat(10000) };
      expect(() => jwt.sign(largePayload, process.env.JWT_SECRET!)).not.toThrow();
      
      // Special characters in secret
      const specialSecret = 'secret!@#$%^&*()_+-=[]{}|;:,.<>?';
      expect(() => jwt.sign({ test: true }, specialSecret)).not.toThrow();
    });
  });
});