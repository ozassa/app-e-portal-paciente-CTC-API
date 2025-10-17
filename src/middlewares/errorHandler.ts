import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { ZodError } from 'zod';

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Error handler', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Prisma errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Registro duplicado',
          field: error.meta?.target,
        });
      case 'P2025':
        return res.status(404).json({
          error: 'Registro não encontrado',
        });
    }
  }

  // Custom app errors
  if (error.message) {
    // Identificar erros de negócio conhecidos
    const businessErrors: Record<string, number> = {
      'CPF inválido': 400,
      'Usuário não encontrado': 404,
      'Usuário inativo': 403,
      'Credenciais inválidas': 401,
      'Código inválido ou expirado': 400,
      'Token inválido': 401,
      'Token expirado': 401,
    };

    const statusCode = businessErrors[error.message] || 500;

    return res.status(statusCode).json({
      error: error.message,
    });
  }

  // Default error
  res.status(500).json({
    error: 'Erro interno do servidor',
  });
}
