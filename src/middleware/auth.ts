import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, TokenPayload } from '@/utils/auth';
import { createError } from '@/middleware/errorHandler';
import prisma from '@/lib/prisma';
import { logger } from '@/utils/logger';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        cpf: string;
        name: string;
        phone: string;
        email?: string;
      };
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      throw createError.unauthorized('Token de acesso é obrigatório');
    }

    // Verify and decode token
    const decoded: TokenPayload = verifyToken(token);

    // Get user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { 
        id: decoded.userId,
        isActive: true 
      },
      select: {
        id: true,
        cpf: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
      }
    });

    if (!user) {
      throw createError.unauthorized('Usuário não encontrado ou inativo');
    }

    // Attach user info to request
    req.user = {
      userId: user.id,
      cpf: user.cpf,
      name: user.name,
      phone: user.phone,
      email: user.email,
    };

    logger.debug('User authenticated successfully', {
      userId: user.id,
      cpf: user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.$3-**'),
    });

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('expirado')) {
        return next(createError.unauthorized('Token expirado'));
      } else if (error.message.includes('inválido')) {
        return next(createError.unauthorized('Token inválido'));
      }
    }
    next(error);
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return next(); // Continue without authentication
    }

    // Try to authenticate, but don't fail if token is invalid
    try {
      const decoded: TokenPayload = verifyToken(token);
      
      const user = await prisma.user.findUnique({
        where: { 
          id: decoded.userId,
          isActive: true 
        },
        select: {
          id: true,
          cpf: true,
          name: true,
          phone: true,
          email: true,
        }
      });

      if (user) {
        req.user = {
          userId: user.id,
          cpf: user.cpf,
          name: user.name,
          phone: user.phone,
          email: user.email,
        };
      }
    } catch (authError) {
      // Log the error but continue
      logger.debug('Optional auth failed:', authError);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // For now, we'll implement basic user role checking
    // This can be extended when user roles are added to the schema
    if (!req.user) {
      return next(createError.unauthorized('Acesso negado'));
    }
    
    // TODO: Implement role checking when roles are added to User model
    // For now, all authenticated users have access
    next();
  };
};

export const rateLimitByUser = (maxRequests: number, windowMs: number) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    
    if (!userId) {
      return next();
    }

    const now = Date.now();
    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize user limit
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        error: {
          message: 'Muitas requisições. Tente novamente em alguns minutos.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
        }
      });
    }

    userLimit.count++;
    next();
  };
};