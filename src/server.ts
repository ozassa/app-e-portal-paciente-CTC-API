import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';

import { config } from '@/config/env';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';

// Import routes
import authRoutes from '@/routes/auth';
import userRoutes from '@/routes/user';
import appointmentRoutes from '@/routes/appointments';
import unitRoutes from '@/routes/units';
import specialtyRoutes from '@/routes/specialties';
import notificationRoutes from '@/routes/notifications';
import whatsappRoutes from '@/routes/whatsapp';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Muitas requisições deste IP, tente novamente em alguns minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: config.APP_VERSION,
    environment: config.NODE_ENV,
  });
});

// API routes
const apiPrefix = `/api/${config.API_VERSION}`;
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/user`, userRoutes);
app.use(`${apiPrefix}/appointments`, appointmentRoutes);
app.use(`${apiPrefix}/units`, unitRoutes);
app.use(`${apiPrefix}/specialties`, specialtyRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);
app.use(`${apiPrefix}/whatsapp`, whatsappRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    const port = config.PORT;
    
    app.listen(port, () => {
      logger.info(`🚀 Servidor iniciado na porta ${port}`);
      logger.info(`📍 Environment: ${config.NODE_ENV}`);
      logger.info(`🌐 API URL: http://localhost:${port}${apiPrefix}`);
      logger.info(`🏥 App: ${config.APP_NAME} v${config.APP_VERSION}`);
    });
  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();

export default app;