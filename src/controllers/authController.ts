import { Request, Response } from 'express';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { hashPassword, comparePassword, generateToken, generateRefreshToken, generate2FACode, generateSessionId, generateCardNumber, verifyRefreshToken } from '@/utils/auth';
import { validateCPF, formatCPF, formatPhone } from '@/utils/validation';
import { notificationService } from '@/services/notification';
import prisma from '@/lib/prisma';
import { logger } from '@/utils/logger';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { cpf, password } = req.body;

  // Validate CPF
  if (!validateCPF(cpf)) {
    throw createError.badRequest('CPF inválido');
  }

  // Find user by CPF
  const user = await prisma.user.findUnique({
    where: { cpf, isActive: true }
  });

  if (!user) {
    throw createError.unauthorized('CPF ou senha incorretos');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw createError.unauthorized('CPF ou senha incorretos');
  }

  // Generate 2FA code and session
  const twoFactorCode = generate2FACode();
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Save session in database
  await prisma.authSession.create({
    data: {
      userId: user.id,
      sessionId,
      twoFactorCode,
      phoneNumber: user.phone,
      expiresAt,
      isVerified: false,
    }
  });

  // Send 2FA code via notification service
  const notificationResult = await notificationService.send2FACode(
    user.id,
    twoFactorCode,
    '5',
    { sms: true, whatsapp: true }
  );
  
  if (!notificationResult.success) {
    logger.error('Failed to send 2FA notifications', { 
      userId: user.id, 
      phone: user.phone,
      channels: notificationResult.channels
    });
    // Don't fail the login, user can request a new code
  }

  logger.info('Login attempt - 2FA code sent', {
    userId: user.id,
    sessionId,
    notificationSent: notificationResult.success,
    channels: notificationResult.channels,
  });

  res.status(200).json({
    message: '2FA required',
    sessionId,
    expiresIn: 300, // 5 minutes in seconds
  });
});

export const verify2FA = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, code } = req.body;

  // Find session
  const session = await prisma.authSession.findUnique({
    where: { 
      sessionId,
      isVerified: false,
      expiresAt: { gte: new Date() }
    },
    include: { user: true }
  });

  if (!session) {
    throw createError.badRequest('Sessão inválida ou expirada');
  }

  // Verify 2FA code
  if (session.twoFactorCode !== code) {
    throw createError.badRequest('Código de verificação incorreto');
  }

  // Generate tokens
  const token = generateToken({
    userId: session.user.id,
    cpf: session.user.cpf,
  });

  const refreshToken = generateRefreshToken({
    userId: session.user.id,
    sessionId: session.sessionId,
  });

  // Update session with refresh token and mark as verified
  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      refreshToken,
      isVerified: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days for refresh token
    }
  });

  logger.info('2FA verification successful', {
    userId: session.user.id,
    sessionId,
  });

  res.status(200).json({
    token,
    refreshToken,
    expiresIn: 3600, // 1 hour in seconds
    user: {
      id: session.user.id,
      name: session.user.name,
      cpf: formatCPF(session.user.cpf),
      phone: formatPhone(session.user.phone),
      email: session.user.email,
      plan: session.user.plan,
      cardNumber: session.user.cardNumber,
    }
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw createError.badRequest('Refresh token é obrigatório');
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Find session
  const session = await prisma.authSession.findUnique({
    where: {
      refreshToken,
      isVerified: true,
      expiresAt: { gte: new Date() }
    },
    include: { user: true }
  });

  if (!session) {
    throw createError.unauthorized('Refresh token inválido ou expirado');
  }

  // Generate new access token
  const newToken = generateToken({
    userId: session.user.id,
    cpf: session.user.cpf,
  });

  logger.info('Token refreshed', {
    userId: session.user.id,
    sessionId: session.sessionId,
  });

  res.status(200).json({
    token: newToken,
    expiresIn: 3600, // 1 hour in seconds
  });
});

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { name, cpf, phone, email, password } = req.body;

  // Validate CPF
  if (!validateCPF(cpf)) {
    throw createError.badRequest('CPF inválido');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { cpf },
        { phone },
        ...(email ? [{ email }] : [])
      ]
    }
  });

  if (existingUser) {
    if (existingUser.cpf === cpf) {
      throw createError.conflict('CPF já cadastrado');
    }
    if (existingUser.phone === phone) {
      throw createError.conflict('Telefone já cadastrado');
    }
    if (email && existingUser.email === email) {
      throw createError.conflict('Email já cadastrado');
    }
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Generate card number
  const cardNumber = generateCardNumber();

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      cpf,
      phone,
      email,
      password: hashedPassword,
      cardNumber,
    }
  });

  // Send welcome messages
  const smsPromise = smsService.sendAccountCreated(phone, name);
  const emailPromise = email ? emailService.sendWelcomeEmail(email, name) : Promise.resolve(true);

  await Promise.allSettled([smsPromise, emailPromise]);

  logger.info('User account created', {
    userId: user.id,
    cpf: formatCPF(cpf),
    phone: formatPhone(phone),
  });

  res.status(201).json({
    message: 'Conta criada com sucesso',
    userId: user.id,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (userId) {
    // Invalidate all active sessions for the user
    await prisma.authSession.deleteMany({
      where: {
        userId,
        isVerified: true,
      }
    });

    logger.info('User logged out', { userId });
  }

  res.status(200).json({
    message: 'Logout realizado com sucesso',
  });
});

export const resend2FA = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  // Find session
  const session = await prisma.authSession.findUnique({
    where: { 
      sessionId,
      isVerified: false,
    },
    include: { user: true }
  });

  if (!session) {
    throw createError.badRequest('Sessão não encontrada');
  }

  // Check if too many attempts
  const recentSessions = await prisma.authSession.count({
    where: {
      userId: session.userId,
      createdAt: {
        gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
      }
    }
  });

  if (recentSessions > 3) {
    throw createError.tooManyRequests('Muitas tentativas. Aguarde alguns minutos.');
  }

  // Generate new 2FA code
  const twoFactorCode = generate2FACode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Update session
  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      twoFactorCode,
      expiresAt,
    }
  });

  // Send new 2FA code
  const smsSent = await smsService.send2FACode(session.user.phone, twoFactorCode);

  if (!smsSent) {
    throw createError.internal('Erro ao enviar código SMS');
  }

  logger.info('2FA code resent', {
    userId: session.user.id,
    sessionId,
  });

  res.status(200).json({
    message: 'Código reenviado com sucesso',
    expiresIn: 300,
  });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { cpf } = req.body;

  if (!validateCPF(cpf)) {
    throw createError.badRequest('CPF inválido');
  }

  const user = await prisma.user.findUnique({
    where: { cpf, isActive: true }
  });

  // Always return success to prevent user enumeration
  if (!user) {
    return res.status(200).json({
      message: 'Se o CPF estiver cadastrado, você receberá um SMS com instruções',
    });
  }

  // Generate reset code
  const resetCode = generate2FACode();
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Save reset session
  await prisma.authSession.create({
    data: {
      userId: user.id,
      sessionId,
      twoFactorCode: resetCode,
      phoneNumber: user.phone,
      expiresAt,
      isVerified: false,
    }
  });

  // Send reset code via SMS
  const message = `Seu código de recuperação de senha do ${process.env.APP_NAME || 'App Telas Mágicas'} é: ${resetCode}. Válido por 15 minutos.`;
  await smsService.send2FACode(user.phone, resetCode);

  logger.info('Password reset requested', {
    userId: user.id,
    sessionId,
  });

  res.status(200).json({
    message: 'Se o CPF estiver cadastrado, você receberá um SMS com instruções',
    sessionId, // Only return this for valid CPFs
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, code, newPassword } = req.body;

  // Find reset session
  const session = await prisma.authSession.findUnique({
    where: {
      sessionId,
      isVerified: false,
      expiresAt: { gte: new Date() }
    },
    include: { user: true }
  });

  if (!session) {
    throw createError.badRequest('Sessão inválida ou expirada');
  }

  // Verify reset code
  if (session.twoFactorCode !== code) {
    throw createError.badRequest('Código de verificação incorreto');
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user password
  await prisma.user.update({
    where: { id: session.userId },
    data: { password: hashedPassword }
  });

  // Mark session as verified (used)
  await prisma.authSession.update({
    where: { id: session.id },
    data: { isVerified: true }
  });

  // Invalidate all other sessions for security
  await prisma.authSession.deleteMany({
    where: {
      userId: session.userId,
      id: { not: session.id }
    }
  });

  logger.info('Password reset successful', {
    userId: session.userId,
  });

  res.status(200).json({
    message: 'Senha redefinida com sucesso',
  });
});