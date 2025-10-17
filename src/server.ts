import app from './app';
import { env } from '@/config/environment';
import { logger } from '@/utils/logger';
import '@/config/database'; // Initialize database connection

const PORT = parseInt(env.PORT, 10);
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📝 Environment: ${env.NODE_ENV}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`📡 API base URL: http://localhost:${PORT}/api`);
});

// Graceful shutdown
const shutdown = () => {
  logger.info('👋 Shutting down gracefully...');

  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('❌ Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Unhandled rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  shutdown();
});

// Uncaught exception
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  shutdown();
});
