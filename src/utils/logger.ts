import winston from 'winston';
import path from 'path';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  const formattedMessage = stack || message;
  return `${timestamp} [${level}]: ${formattedMessage}`;
});

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: {
    service: 'app-telas-magicas-api',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      consoleFormat
    )
  }));
}

// Create logs directory if it doesn't exist (for production)
import fs from 'fs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger;