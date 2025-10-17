import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { config } from '@/config/env';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class AppError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public details?: any;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isDevelopment = config.NODE_ENV === 'development';
  
  // Log error
  logger.error('API Error:', {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    code: error.code,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Default error values
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Erro interno do servidor';
  let code = error.code || 'INTERNAL_ERROR';
  let details = error.details;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Dados inválidos';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Token inválido';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expirado';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'ID inválido';
  } else if (error.name === 'MongoError' && (error as any).code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'Registro já existe';
  }

  // Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    switch (prismaError.code) {
      case 'P2002':
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        message = 'Registro já existe';
        break;
      case 'P2025':
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Registro não encontrado';
        break;
      case 'P2003':
        statusCode = 400;
        code = 'FOREIGN_KEY_CONSTRAINT';
        message = 'Referência inválida';
        break;
      default:
        statusCode = 500;
        code = 'DATABASE_ERROR';
        message = 'Erro no banco de dados';
    }
  }

  // Response payload
  const errorResponse: any = {
    error: {
      message,
      code,
      statusCode,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  // Add details in development or if explicitly provided
  if (details || isDevelopment) {
    errorResponse.error.details = details;
  }

  // Add stack trace in development
  if (isDevelopment) {
    errorResponse.error.stack = error.stack;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Common error creators
export const createError = {
  badRequest: (message: string, details?: any) => 
    new AppError(message, 400, 'BAD_REQUEST', details),
  
  unauthorized: (message: string = 'Não autorizado') => 
    new AppError(message, 401, 'UNAUTHORIZED'),
  
  forbidden: (message: string = 'Acesso negado') => 
    new AppError(message, 403, 'FORBIDDEN'),
  
  notFound: (message: string = 'Recurso não encontrado') => 
    new AppError(message, 404, 'NOT_FOUND'),
  
  conflict: (message: string, details?: any) => 
    new AppError(message, 409, 'CONFLICT', details),
  
  unprocessableEntity: (message: string, details?: any) => 
    new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details),
  
  tooManyRequests: (message: string = 'Muitas requisições') => 
    new AppError(message, 429, 'TOO_MANY_REQUESTS'),
  
  internal: (message: string = 'Erro interno do servidor', details?: any) => 
    new AppError(message, 500, 'INTERNAL_ERROR', details),
};