import dotenv from 'dotenv';
import { logger } from '@/utils/logger';

// Load environment variables
dotenv.config();

interface Config {
  // Database
  DATABASE_URL: string;
  
  // JWT
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  
  // Server
  PORT: number;
  NODE_ENV: string;
  API_VERSION: string;
  
  // CORS
  CORS_ORIGIN: string;
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  
  // 2FA SMS (Twilio)
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  
  // Email
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  
  // File Upload
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  
  // Security
  BCRYPT_ROUNDS: number;
  SESSION_SECRET: string;
  
  // Application
  APP_NAME: string;
  APP_VERSION: string;
  APP_URL: string;
  
  // Logging
  LOG_LEVEL: string;
  LOG_FILE: string;
  
  // WhatsApp Business API
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: string;
  
  // Analytics & Monitoring
  SENTRY_DSN: string;
  GOOGLE_ANALYTICS_ID: string;
  
  // External APIs
  VIACEP_API_URL: string;
  GOOGLE_MAPS_API_KEY: string;
  
  // Redis
  REDIS_URL: string;
  
  // File Upload Limits
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_TYPES: string;
  
  // LGPD Compliance
  DATA_RETENTION_DAYS: number;
  GDPR_CONTACT_EMAIL: string;
  DPO_EMAIL: string;
}

const getEnvVar = (name: string, defaultValue?: string): string => {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
};

const getEnvNumber = (name: string, defaultValue?: number): number => {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is required`);
  }
  const parsed = parseInt(value || String(defaultValue), 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }
  return parsed;
};

export const config: Config = {
  // Database
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  
  // JWT
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '1h'),
  JWT_REFRESH_EXPIRES_IN: getEnvVar('JWT_REFRESH_EXPIRES_IN', '7d'),
  
  // Server
  PORT: getEnvNumber('PORT', 3000),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  API_VERSION: getEnvVar('API_VERSION', 'v1'),
  
  // CORS
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', 'http://localhost:5173'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  
  // 2FA SMS
  TWILIO_ACCOUNT_SID: getEnvVar('TWILIO_ACCOUNT_SID'),
  TWILIO_AUTH_TOKEN: getEnvVar('TWILIO_AUTH_TOKEN'),
  TWILIO_PHONE_NUMBER: getEnvVar('TWILIO_PHONE_NUMBER'),
  
  // Email
  SMTP_HOST: getEnvVar('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: getEnvNumber('SMTP_PORT', 587),
  SMTP_USER: getEnvVar('SMTP_USER'),
  SMTP_PASS: getEnvVar('SMTP_PASS'),
  
  // File Upload
  CLOUDINARY_CLOUD_NAME: getEnvVar('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: getEnvVar('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: getEnvVar('CLOUDINARY_API_SECRET'),
  
  // Security
  BCRYPT_ROUNDS: getEnvNumber('BCRYPT_ROUNDS', 12),
  SESSION_SECRET: getEnvVar('SESSION_SECRET'),
  
  // Application
  APP_NAME: getEnvVar('APP_NAME', 'App Telas Mágicas'),
  APP_VERSION: getEnvVar('APP_VERSION', '1.0.0'),
  APP_URL: getEnvVar('APP_URL', 'https://yourdomain.com'),
  
  // Logging
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info'),
  LOG_FILE: getEnvVar('LOG_FILE', 'logs/app.log'),
  
  // WhatsApp Business API
  WHATSAPP_ACCESS_TOKEN: getEnvVar('WHATSAPP_ACCESS_TOKEN', ''),
  WHATSAPP_PHONE_NUMBER_ID: getEnvVar('WHATSAPP_PHONE_NUMBER_ID', ''),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: getEnvVar('WHATSAPP_WEBHOOK_VERIFY_TOKEN', ''),
  
  // Analytics & Monitoring
  SENTRY_DSN: getEnvVar('SENTRY_DSN', ''),
  GOOGLE_ANALYTICS_ID: getEnvVar('GOOGLE_ANALYTICS_ID', ''),
  
  // External APIs
  VIACEP_API_URL: getEnvVar('VIACEP_API_URL', 'https://viacep.com.br/ws'),
  GOOGLE_MAPS_API_KEY: getEnvVar('GOOGLE_MAPS_API_KEY', ''),
  
  // Redis
  REDIS_URL: getEnvVar('REDIS_URL', 'redis://localhost:6379'),
  
  // File Upload Limits
  MAX_FILE_SIZE: getEnvNumber('MAX_FILE_SIZE', 5242880), // 5MB
  ALLOWED_FILE_TYPES: getEnvVar('ALLOWED_FILE_TYPES', 'image/jpeg,image/png,image/gif,application/pdf'),
  
  // LGPD Compliance
  DATA_RETENTION_DAYS: getEnvNumber('DATA_RETENTION_DAYS', 365),
  GDPR_CONTACT_EMAIL: getEnvVar('GDPR_CONTACT_EMAIL', 'privacy@yourdomain.com'),
  DPO_EMAIL: getEnvVar('DPO_EMAIL', 'dpo@yourdomain.com'),
};

// Validate required environment variables
const validateConfig = () => {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'SMTP_USER',
    'SMTP_PASS',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'SESSION_SECRET',
  ];
  
  const missingVars: string[] = [];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error('Please check your .env file and ensure all required variables are set');
    throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
  }
  
  logger.info('✅ Environment configuration validated successfully');
};

// Only validate in non-test environments
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}