import jwt from 'jsonwebtoken';
import { env } from '@/config/environment';
import { logger } from '@/utils/logger';

interface TokenPayload {
  userId: string;
  cpf: string;
}

export class JWTService {
  static generateAccessToken(userId: string, cpf: string): string {
    return jwt.sign(
      { userId, cpf } as TokenPayload,
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );
  }

  static generateRefreshToken(userId: string, cpf: string): string {
    return jwt.sign(
      { userId, cpf } as TokenPayload,
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    );
  }

  static verifyAccessToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    } catch (error) {
      logger.error('Access token verification failed', error);
      return null;
    }
  }

  static verifyRefreshToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
    } catch (error) {
      logger.error('Refresh token verification failed', error);
      return null;
    }
  }
}
