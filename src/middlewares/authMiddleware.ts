import { Request, Response, NextFunction } from 'express';
import { JWTService } from '@/services/jwtService';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Formato de token inválido' });
    }

    // Verificar token
    const payload = JWTService.verifyAccessToken(token);

    if (!payload) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // Verificar se usuário existe e está ativo
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Usuário não autorizado' });
    }

    // Adicionar userId ao request
    req.userId = payload.userId;
    req.user = user;

    next();
  } catch (error) {
    logger.error('Auth middleware error', error);
    return res.status(401).json({ error: 'Erro na autenticação' });
  }
}
