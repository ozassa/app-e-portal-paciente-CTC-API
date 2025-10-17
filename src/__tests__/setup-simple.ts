// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/app_telas_magicas_test';
process.env.JWT_SECRET = 'test-jwt-secret-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-characters';
process.env.SESSION_SECRET = 'test-session-secret-32-characters';

// Mock external services to avoid real API calls during tests
process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_PHONE_NUMBER = '+15551234567';

process.env.SMTP_HOST = 'test.smtp.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test_password';

process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
process.env.CLOUDINARY_API_KEY = 'test_api_key';
process.env.CLOUDINARY_API_SECRET = 'test_api_secret';

process.env.WHATSAPP_ACCESS_TOKEN = 'test_whatsapp_token';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test_phone_number_id';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test_webhook_token';

// Mock Prisma Client for tests that don't need real database
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  authSession: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  appointment: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $disconnect: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $queryRaw: jest.fn(),
};

// Make mock available globally
global.prisma = mockPrismaClient as any;

// Custom Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass,
    };
  },
  
  toBeValidCPF(received: string) {
    const cpfRegex = /^\d{11}$/;
    const pass = cpfRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid CPF`,
      pass,
    };
  },
  
  toBeValidPhone(received: string) {
    const phoneRegex = /^\+?[1-9]\d{10,14}$/;
    const pass = phoneRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid phone number`,
      pass,
    };
  },
  
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
      pass,
    };
  },
});

// Type declarations for global objects
declare global {
  var prisma: any;
  
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidCPF(): R;
      toBeValidPhone(): R;
      toBeValidEmail(): R;
    }
  }
}

// Silence console.log in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console.log = jest.fn();
  global.console.info = jest.fn();
  global.console.warn = jest.fn();
}