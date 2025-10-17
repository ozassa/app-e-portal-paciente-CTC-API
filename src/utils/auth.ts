import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';

export interface TokenPayload {
  userId: string;
  cpf: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  try {
    const salt = await bcrypt.genSalt(config.BCRYPT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new Error('Erro ao processar senha');
  }
};

// Compare password
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    logger.error('Error comparing password:', error);
    return false;
  }
};

// Generate JWT token
export const generateToken = (payload: TokenPayload): string => {
  try {
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: config.APP_NAME,
      audience: config.APP_URL,
    });
  } catch (error) {
    logger.error('Error generating JWT token:', error);
    throw new Error('Erro ao gerar token');
  }
};

// Generate refresh token
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  try {
    return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN,
      issuer: config.APP_NAME,
      audience: config.APP_URL,
    });
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Erro ao gerar refresh token');
  }
};

// Verify JWT token
export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.JWT_SECRET, {
      issuer: config.APP_NAME,
      audience: config.APP_URL,
    }) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expirado');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token inválido');
    } else {
      logger.error('Error verifying token:', error);
      throw new Error('Erro ao verificar token');
    }
  }
};

// Verify refresh token
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, config.JWT_REFRESH_SECRET, {
      issuer: config.APP_NAME,
      audience: config.APP_URL,
    }) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expirado');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Refresh token inválido');
    } else {
      logger.error('Error verifying refresh token:', error);
      throw new Error('Erro ao verificar refresh token');
    }
  }
};

// Generate 2FA code
export const generate2FACode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate session ID
export const generateSessionId = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate card number
export const generateCardNumber = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${timestamp.slice(-8)}${random}`.replace(/(\d{4})(?=\d)/g, '$1 ');
};

// Extract token from Authorization header
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
};

// Generate secure random string
export const generateSecureRandom = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Hash data with salt
export const hashWithSalt = (data: string, salt?: string): { hash: string; salt: string } => {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(data, usedSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: usedSalt };
};

// Verify hashed data
export const verifyHash = (data: string, hash: string, salt: string): boolean => {
  const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};

// Get token expiration time
export const getTokenExpirationTime = (): Date => {
  const expiresIn = config.JWT_EXPIRES_IN;
  const duration = parseTokenDuration(expiresIn);
  return new Date(Date.now() + duration);
};

// Get refresh token expiration time
export const getRefreshTokenExpirationTime = (): Date => {
  const expiresIn = config.JWT_REFRESH_EXPIRES_IN;
  const duration = parseTokenDuration(expiresIn);
  return new Date(Date.now() + duration);
};

// Parse token duration string to milliseconds
const parseTokenDuration = (duration: string): number => {
  const regex = /^(\d+)([smhd])$/;
  const match = duration.match(regex);
  
  if (!match) {
    throw new Error('Invalid token duration format');
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new Error('Invalid token duration unit');
  }
};

// Generate API key (for future use)
export const generateApiKey = (): string => {
  const prefix = 'tm_'; // Telas Mágicas prefix
  const key = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${key}`;
};

// Mask sensitive data for logging
export const maskSensitiveData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sensitiveFields = ['password', 'token', 'refreshToken', 'code', 'cpf', 'phone'];
  const masked = { ...data };
  
  Object.keys(masked).forEach(key => {
    if (sensitiveFields.includes(key.toLowerCase())) {
      if (typeof masked[key] === 'string') {
        masked[key] = '*'.repeat(masked[key].length);
      }
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  });
  
  return masked;
};