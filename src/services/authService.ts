import bcrypt from 'bcryptjs';
import { User, OTPCode } from '@prisma/client';
import prisma from '@/config/database';
import { JWTService } from './jwtService';
import { SMSService } from './smsService';
import { validateCPF, cleanCPF } from '@/utils/cpfValidator';
import { logger } from '@/utils/logger';

export class AuthService {
  static async login(cpf: string, password: string): Promise<{ requiresTwoFactor: boolean; message: string }> {
    // Limpar e validar CPF
    const cleanedCPF = cleanCPF(cpf);
    if (!validateCPF(cleanedCPF)) {
      throw new Error('CPF inválido');
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { cpf: cleanedCPF },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    if (!user.isActive) {
      throw new Error('Usuário inativo');
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn(`Failed login attempt for CPF: ${cleanedCPF}`);
      throw new Error('Credenciais inválidas');
    }

    // Se 2FA está habilitado, gerar e enviar código
    if (user.twoFactorEnabled) {
      const code = this.generateOTPCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

      // Salvar código no banco
      await prisma.oTPCode.create({
        data: {
          cpf: cleanedCPF,
          code,
          type: 'login',
          method: user.twoFactorMethod || 'sms',
          expiresAt,
        },
      });

      // Enviar código via SMS/WhatsApp
      const phone = user.celular || user.telefone;
      if (phone) {
        await SMSService.sendOTP(phone, code, (user.twoFactorMethod as 'sms' | 'whatsapp') || 'sms');
      }

      return {
        requiresTwoFactor: true,
        message: 'Código de verificação enviado',
      };
    }

    // Se 2FA não está habilitado (não recomendado), retornar tokens diretamente
    return {
      requiresTwoFactor: false,
      message: 'Login bem-sucedido',
    };
  }

  static async verifyTwoFactor(cpf: string, code: string): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const cleanedCPF = cleanCPF(cpf);

    // Buscar código OTP válido
    const otpCode = await prisma.oTPCode.findFirst({
      where: {
        cpf: cleanedCPF,
        code,
        type: 'login',
        verified: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpCode) {
      throw new Error('Código inválido ou expirado');
    }

    // Marcar código como verificado
    await prisma.oTPCode.update({
      where: { id: otpCode.id },
      data: { verified: true },
    });

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { cpf: cleanedCPF },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Atualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Gerar tokens JWT
    const accessToken = JWTService.generateAccessToken(user.id, user.cpf);
    const refreshToken = JWTService.generateRefreshToken(user.id, user.cpf);

    // Salvar refresh token no banco
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    logger.info(`User logged in successfully: ${user.id}`);

    return { accessToken, refreshToken, user };
  }

  static async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verificar token
    const payload = JWTService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new Error('Token inválido');
    }

    // Buscar token no banco
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new Error('Token não encontrado');
    }

    if (storedToken.expiresAt < new Date()) {
      // Token expirado, remover do banco
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new Error('Token expirado');
    }

    // Gerar novos tokens
    const newAccessToken = JWTService.generateAccessToken(storedToken.user.id, storedToken.user.cpf);
    const newRefreshToken = JWTService.generateRefreshToken(storedToken.user.id, storedToken.user.cpf);

    // Remover token antigo e salvar novo
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.user.id,
        expiresAt,
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  static async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  static async resendOTP(cpf: string, method: 'sms' | 'whatsapp'): Promise<void> {
    const cleanedCPF = cleanCPF(cpf);

    const user = await prisma.user.findUnique({
      where: { cpf: cleanedCPF },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const code = this.generateOTPCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.oTPCode.create({
      data: {
        cpf: cleanedCPF,
        code,
        type: 'login',
        method,
        expiresAt,
      },
    });

    const phone = user.celular || user.telefone;
    if (phone) {
      await SMSService.sendOTP(phone, code, method);
    }
  }

  static async forgotPassword(cpf: string): Promise<void> {
    const cleanedCPF = cleanCPF(cpf);

    const user = await prisma.user.findUnique({
      where: { cpf: cleanedCPF },
    });

    if (!user) {
      // Não revelar se usuário existe ou não
      logger.warn(`Password reset attempt for non-existent CPF: ${cleanedCPF}`);
      return;
    }

    const code = this.generateOTPCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.oTPCode.create({
      data: {
        cpf: cleanedCPF,
        code,
        type: 'password_reset',
        method: user.twoFactorMethod || 'sms',
        expiresAt,
      },
    });

    const phone = user.celular || user.telefone;
    if (phone) {
      await SMSService.sendOTP(phone, code, (user.twoFactorMethod as 'sms' | 'whatsapp') || 'sms');
    }
  }

  static async resetPassword(cpf: string, code: string, newPassword: string): Promise<void> {
    const cleanedCPF = cleanCPF(cpf);

    // Verificar código
    const otpCode = await prisma.oTPCode.findFirst({
      where: {
        cpf: cleanedCPF,
        code,
        type: 'password_reset',
        verified: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpCode) {
      throw new Error('Código inválido ou expirado');
    }

    // Marcar como verificado
    await prisma.oTPCode.update({
      where: { id: otpCode.id },
      data: { verified: true },
    });

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await prisma.user.update({
      where: { cpf: cleanedCPF },
      data: { password: hashedPassword },
    });

    logger.info(`Password reset successfully for CPF: ${cleanedCPF}`);
  }

  private static generateOTPCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
