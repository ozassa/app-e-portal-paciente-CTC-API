import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { config } from '@/config/env';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Skip logging for health checks and static files
  if (req.path === '/health' || req.path.startsWith('/static/')) {
    return next();
  }

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    ...(config.NODE_ENV === 'development' && {
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
    }),
  });

  // Capture response
  const originalSend = res.send;
  
  res.send = function(body) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log response
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      ...(config.NODE_ENV === 'development' && {
        responseSize: Buffer.byteLength(body || ''),
      }),
    });
    
    return originalSend.call(this, body);
  };

  next();
};