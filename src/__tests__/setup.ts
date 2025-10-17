import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/app_telas_magicas_test';
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

// Global test database instance
const prisma = new PrismaClient();

beforeAll(async () => {
  // Initialize test database
  
  try {
    // Reset database schema
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await prisma.$executeRawUnsafe('CREATE SCHEMA public');
    
    // Run migrations
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
    
    console.log('✅ Test database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    throw error;
  }
});

beforeEach(async () => {
  // Clean all tables before each test
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;
  
  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter(name => !name.startsWith('_prisma'));

  try {
    // Disable foreign key checks temporarily
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
    
    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
  } catch (error) {
    console.error('❌ Failed to clean test database:', error);
    throw error;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Make prisma available globally in tests
global.prisma = prisma;

// Extend Jest matchers
declare global {
  var prisma: PrismaClient;
  
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidCPF(): R;
      toBeValidPhone(): R;
      toBeValidEmail(): R;
    }
  }
}

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

// Silence console.log in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console.log = jest.fn();
  global.console.info = jest.fn();
  global.console.warn = jest.fn();
}