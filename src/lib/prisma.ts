import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

// Prevent multiple instances of Prisma Client in development
declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma = global.__prisma || new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Database Query:', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

// Log database errors
prisma.$on('error', (e) => {
  logger.error('Database Error:', {
    message: e.message,
    target: e.target,
  });
});

// Log database info and warnings
prisma.$on('info', (e) => {
  logger.info('Database Info:', {
    message: e.message,
    target: e.target,
  });
});

prisma.$on('warn', (e) => {
  logger.warn('Database Warning:', {
    message: e.message,
    target: e.target,
  });
});

// Graceful shutdown
process.on('beforeExit', async () => {
  logger.info('Closing database connection...');
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing database connection...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing database connection...');
  await prisma.$disconnect();
  process.exit(0);
});

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}

export default prisma;