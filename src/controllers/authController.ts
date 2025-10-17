import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/authService';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const loginSchema = z.object({
  cpf: z.string().min(11),
  password: z.string().min(6),
});

const verifyTwoFactorSchema = z.object({
  cpf: z.string().min(11),
  code: z.string().length(6),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

const resendOTPSchema = z.object({
  cpf: z.string().min(11),
  method: z.enum(['sms', 'whatsapp']),
});

const forgotPasswordSchema = z.object({
  cpf: z.string().min(11),
});

const resetPasswordSchema = z.object({
  cpf: z.string().min(11),
  code: z.string().length(6),
  newPassword: z.string().min(8),
});

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { cpf, password } = loginSchema.parse(req.body);

      const result = await AuthService.login(cpf, password);

      res.json(result);
    } catch (error: any) {
      logger.error('Login error', error);
      next(error);
    }
  }

  static async verifyTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const { cpf, code } = verifyTwoFactorSchema.parse(req.body);

      const result = await AuthService.verifyTwoFactor(cpf, code);

      res.json(result);
    } catch (error: any) {
      logger.error('2FA verification error', error);
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);

      const result = await AuthService.refreshToken(refreshToken);

      res.json(result);
    } catch (error: any) {
      logger.error('Token refresh error', error);
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }

      res.json({ message: 'Logout realizado com sucesso' });
    } catch (error: any) {
      logger.error('Logout error', error);
      next(error);
    }
  }

  static async resendOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { cpf, method } = resendOTPSchema.parse(req.body);

      await AuthService.resendOTP(cpf, method);

      res.json({ message: 'Código reenviado com sucesso' });
    } catch (error: any) {
      logger.error('Resend OTP error', error);
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { cpf } = forgotPasswordSchema.parse(req.body);

      await AuthService.forgotPassword(cpf);

      res.json({ message: 'Código de recuperação enviado' });
    } catch (error: any) {
      logger.error('Forgot password error', error);
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { cpf, code, newPassword } = resetPasswordSchema.parse(req.body);

      await AuthService.resetPassword(cpf, code, newPassword);

      res.json({ message: 'Senha alterada com sucesso' });
    } catch (error: any) {
      logger.error('Reset password error', error);
      next(error);
    }
  }
}
