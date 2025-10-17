import {
  validateCPF,
  formatCPF,
  formatPhone,
  validateEmail,
  validatePassword,
  sanitizeInput,
  isValidDate,
} from '../../utils/validation';

describe('Validation Utils', () => {
  describe('CPF Validation', () => {
    it('should validate correct CPF numbers', () => {
      const validCPFs = [
        '11144477735', // Valid CPF
        '12345678909', // Valid CPF
        '00000000191', // Valid CPF
      ];

      validCPFs.forEach(cpf => {
        expect(validateCPF(cpf)).toBe(true);
      });
    });

    it('should reject invalid CPF numbers', () => {
      const invalidCPFs = [
        '11111111111', // All same digits
        '00000000000', // All zeros
        '12345678901', // Invalid check digits
        '123.456.789-01', // With formatting
        '123456789', // Too short
        '123456789012', // Too long
        'abcdefghijk', // Non-numeric
        '', // Empty
        null,
        undefined,
      ];

      invalidCPFs.forEach(cpf => {
        expect(validateCPF(cpf)).toBe(false);
      });
    });

    it('should format CPF correctly', () => {
      expect(formatCPF('11144477735')).toBe('111.444.777-35');
      expect(formatCPF('12345678909')).toBe('123.456.789-09');
      expect(formatCPF('111.444.777-35')).toBe('111.444.777-35'); // Already formatted
    });

    it('should handle CPF formatting edge cases', () => {
      expect(formatCPF('')).toBe('');
      expect(formatCPF(null as any)).toBe('');
      expect(formatCPF(undefined as any)).toBe('');
      expect(formatCPF('123')).toBe('123'); // Too short to format
      expect(formatCPF('12345678901234')).toBe('12345678901234'); // Too long
    });
  });

  describe('Phone Validation and Formatting', () => {
    it('should format Brazilian phone numbers correctly', () => {
      expect(formatPhone('11999888777')).toBe('(11) 99988-8777');
      expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
      expect(formatPhone('5511999888777')).toBe('+55 (11) 99988-8777'); // With country code
    });

    it('should handle phone formatting edge cases', () => {
      expect(formatPhone('')).toBe('');
      expect(formatPhone(null as any)).toBe('');
      expect(formatPhone(undefined as any)).toBe('');
      expect(formatPhone('123')).toBe('123'); // Too short
      expect(formatPhone('abcdef')).toBe('abcdef'); // Non-numeric
    });

    it('should preserve international phone formats', () => {
      expect(formatPhone('+1234567890')).toBe('+1234567890');
      expect(formatPhone('+55 11 99988-7766')).toBe('+55 11 99988-7766'); // Already formatted
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.com.br',
        'user+tag@example.org',
        'user123@test-domain.com',
        'a@b.co',
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..double.dot@domain.com',
        'user@domain',
        'user@.com',
        '',
        null,
        undefined,
        'user name@domain.com', // Space in local part
        'user@domain..com', // Double dot in domain
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should handle edge cases in email validation', () => {
      expect(validateEmail('a'.repeat(320) + '@domain.com')).toBe(false); // Too long
      expect(validateEmail('user@' + 'a'.repeat(250) + '.com')).toBe(false); // Domain too long
    });
  });

  describe('Password Validation', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'StrongP@ss123',
        'MySecur3#Password',
        'ComplexP@ssw0rd!',
        'Abcd1234@',
      ];

      strongPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'weak', // Too short
        'password', // No uppercase, numbers, or symbols
        'PASSWORD', // No lowercase, numbers, or symbols
        '12345678', // No letters or symbols
        'Password', // No numbers or symbols
        'Password123', // No symbols
        '', // Empty
        null,
        undefined,
      ];

      weakPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });

    it('should enforce minimum length requirement', () => {
      expect(validatePassword('Aa1!')).toBe(false); // Too short (4 chars)
      expect(validatePassword('Aa1!@')).toBe(false); // Still too short (5 chars)
      expect(validatePassword('Aa1!@#')).toBe(true); // Minimum length (6 chars)
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML and script tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitizeInput('<img src="x" onerror="alert(1)">')).toBe('');
      expect(sanitizeInput('<div>Hello <b>World</b></div>')).toBe('Hello World');
    });

    it('should preserve safe content', () => {
      expect(sanitizeInput('Normal text content')).toBe('Normal text content');
      expect(sanitizeInput('Text with numbers 123')).toBe('Text with numbers 123');
      expect(sanitizeInput('Email: user@domain.com')).toBe('Email: user@domain.com');
    });

    it('should handle special characters safely', () => {
      expect(sanitizeInput('Price: $100 & taxes')).toBe('Price: $100 & taxes');
      expect(sanitizeInput('Math: 2 < 3 > 1')).toBe('Math: 2 < 3 > 1');
    });

    it('should handle edge cases', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });
  });

  describe('Date Validation', () => {
    it('should validate correct date formats', () => {
      expect(isValidDate('2024-01-15')).toBe(true);
      expect(isValidDate('2024-12-31')).toBe(true);
      expect(isValidDate(new Date().toISOString())).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidDate('invalid-date')).toBe(false);
      expect(isValidDate('2024-13-01')).toBe(false); // Invalid month
      expect(isValidDate('2024-02-30')).toBe(false); // Invalid day for February
      expect(isValidDate('2024/01/15')).toBe(false); // Wrong format
      expect(isValidDate('')).toBe(false);
      expect(isValidDate(null as any)).toBe(false);
      expect(isValidDate(undefined as any)).toBe(false);
    });

    it('should handle leap years correctly', () => {
      expect(isValidDate('2024-02-29')).toBe(true); // 2024 is a leap year
      expect(isValidDate('2023-02-29')).toBe(false); // 2023 is not a leap year
      expect(isValidDate('2000-02-29')).toBe(true); // 2000 is a leap year
      expect(isValidDate('1900-02-29')).toBe(false); // 1900 is not a leap year
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete user data validation', () => {
      const userData = {
        cpf: '11144477735',
        email: 'user@example.com',
        phone: '11999888777',
        password: 'StrongP@ss123',
      };

      expect(validateCPF(userData.cpf)).toBe(true);
      expect(validateEmail(userData.email)).toBe(true);
      expect(validatePassword(userData.password)).toBe(true);
      
      expect(formatCPF(userData.cpf)).toBe('111.444.777-35');
      expect(formatPhone(userData.phone)).toBe('(11) 99988-8777');
    });

    it('should handle batch validation', () => {
      const cpfs = ['11144477735', '12345678909', '00000000191'];
      const emails = ['test1@example.com', 'test2@example.com', 'test3@example.com'];
      
      expect(cpfs.every(validateCPF)).toBe(true);
      expect(emails.every(validateEmail)).toBe(true);
    });

    it('should handle mixed valid and invalid data', () => {
      const mixedCPFs = ['11144477735', '11111111111', '12345678909'];
      const validCPFs = mixedCPFs.filter(validateCPF);
      
      expect(validCPFs).toHaveLength(2);
      expect(validCPFs).toContain('11144477735');
      expect(validCPFs).toContain('12345678909');
    });
  });

  describe('Performance Tests', () => {
    it('should validate large numbers of CPFs efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        validateCPF('11144477735');
      }
      
      const end = Date.now();
      expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should format large numbers of phones efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        formatPhone('11999888777');
      }
      
      const end = Date.now();
      expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});