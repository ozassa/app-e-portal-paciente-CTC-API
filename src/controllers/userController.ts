import { Request, Response } from 'express';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { formatCPF, formatPhone, validateCPF } from '@/utils/validation';
import { hashPassword, comparePassword } from '@/utils/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/utils/logger';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      cpf: true,
      phone: true,
      email: true,
      avatar: true,
      plan: true,
      cardNumber: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  if (!user) {
    throw createError.notFound('Usuário não encontrado');
  }

  res.status(200).json({
    id: user.id,
    name: user.name,
    cpf: formatCPF(user.cpf),
    phone: formatPhone(user.phone),
    email: user.email,
    avatar: user.avatar,
    plan: user.plan,
    cardNumber: user.cardNumber,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { name, phone, email } = req.body;

  // Check if phone is already used by another user
  if (phone) {
    const existingUser = await prisma.user.findFirst({
      where: {
        phone,
        id: { not: userId }
      }
    });

    if (existingUser) {
      throw createError.conflict('Telefone já está sendo usado por outro usuário');
    }
  }

  // Check if email is already used by another user
  if (email) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: userId }
      }
    });

    if (existingUser) {
      throw createError.conflict('Email já está sendo usado por outro usuário');
    }
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(email && { email }),
    },
    select: {
      id: true,
      name: true,
      cpf: true,
      phone: true,
      email: true,
      avatar: true,
      plan: true,
      cardNumber: true,
      updatedAt: true,
    }
  });

  logger.info('User profile updated', {
    userId,
    updatedFields: Object.keys(req.body),
  });

  res.status(200).json({
    id: updatedUser.id,
    name: updatedUser.name,
    cpf: formatCPF(updatedUser.cpf),
    phone: formatPhone(updatedUser.phone),
    email: updatedUser.email,
    avatar: updatedUser.avatar,
    plan: updatedUser.plan,
    cardNumber: updatedUser.cardNumber,
    updatedAt: updatedUser.updatedAt,
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true }
  });

  if (!user) {
    throw createError.notFound('Usuário não encontrado');
  }

  // Verify current password
  const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw createError.badRequest('Senha atual incorreta');
  }

  // Hash new password
  const hashedNewPassword = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword }
  });

  // Invalidate all sessions for security
  await prisma.authSession.deleteMany({
    where: { userId }
  });

  logger.info('User password changed', { userId });

  res.status(200).json({
    message: 'Senha alterada com sucesso. Faça login novamente.',
  });
});

export const getDependents = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const dependents = await prisma.dependent.findMany({
    where: { 
      userId,
      isActive: true 
    },
    select: {
      id: true,
      name: true,
      cpf: true,
      relationship: true,
      birthDate: true,
      cardNumber: true,
      plan: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' }
  });

  const formattedDependents = dependents.map(dependent => ({
    ...dependent,
    cpf: formatCPF(dependent.cpf),
  }));

  res.status(200).json(formattedDependents);
});

export const addDependent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { name, cpf, relationship, birthDate } = req.body;

  // Validate CPF
  if (!validateCPF(cpf)) {
    throw createError.badRequest('CPF inválido');
  }

  // Check if CPF is already used
  const existingUser = await prisma.user.findUnique({
    where: { cpf }
  });

  if (existingUser) {
    throw createError.conflict('CPF já está cadastrado como usuário principal');
  }

  const existingDependent = await prisma.dependent.findUnique({
    where: { cpf }
  });

  if (existingDependent) {
    throw createError.conflict('CPF já está cadastrado como dependente');
  }

  // Generate card number for dependent
  const cardNumber = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`.replace(/(\d{4})(?=\d)/g, '$1 ');

  // Create dependent
  const dependent = await prisma.dependent.create({
    data: {
      userId,
      name,
      cpf,
      relationship,
      birthDate: birthDate ? new Date(birthDate) : null,
      cardNumber,
    },
    select: {
      id: true,
      name: true,
      cpf: true,
      relationship: true,
      birthDate: true,
      cardNumber: true,
      plan: true,
      createdAt: true,
    }
  });

  logger.info('Dependent added', {
    userId,
    dependentId: dependent.id,
    relationship,
  });

  res.status(201).json({
    ...dependent,
    cpf: formatCPF(dependent.cpf),
  });
});

export const updateDependent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { dependentId } = req.params;
  const { name, relationship } = req.body;

  // Check if dependent belongs to user
  const dependent = await prisma.dependent.findFirst({
    where: {
      id: dependentId,
      userId,
      isActive: true,
    }
  });

  if (!dependent) {
    throw createError.notFound('Dependente não encontrado');
  }

  // Update dependent
  const updatedDependent = await prisma.dependent.update({
    where: { id: dependentId },
    data: {
      ...(name && { name }),
      ...(relationship && { relationship }),
    },
    select: {
      id: true,
      name: true,
      cpf: true,
      relationship: true,
      birthDate: true,
      cardNumber: true,
      plan: true,
      updatedAt: true,
    }
  });

  logger.info('Dependent updated', {
    userId,
    dependentId,
    updatedFields: Object.keys(req.body),
  });

  res.status(200).json({
    ...updatedDependent,
    cpf: formatCPF(updatedDependent.cpf),
  });
});

export const removeDependent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { dependentId } = req.params;

  // Check if dependent belongs to user
  const dependent = await prisma.dependent.findFirst({
    where: {
      id: dependentId,
      userId,
      isActive: true,
    }
  });

  if (!dependent) {
    throw createError.notFound('Dependente não encontrado');
  }

  // Check if dependent has upcoming appointments
  const upcomingAppointments = await prisma.appointment.count({
    where: {
      dependentId,
      status: 'SCHEDULED',
      date: { gte: new Date() }
    }
  });

  if (upcomingAppointments > 0) {
    throw createError.badRequest('Não é possível remover dependente com consultas agendadas');
  }

  // Soft delete (mark as inactive)
  await prisma.dependent.update({
    where: { id: dependentId },
    data: { isActive: false }
  });

  logger.info('Dependent removed', {
    userId,
    dependentId,
  });

  res.status(204).send();
});

export const getDependent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { dependentId } = req.params;

  const dependent = await prisma.dependent.findFirst({
    where: {
      id: dependentId,
      userId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      cpf: true,
      relationship: true,
      birthDate: true,
      cardNumber: true,
      plan: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  if (!dependent) {
    throw createError.notFound('Dependente não encontrado');
  }

  res.status(200).json({
    ...dependent,
    cpf: formatCPF(dependent.cpf),
  });
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  
  // TODO: Implement file upload with Cloudinary
  // This would typically involve:
  // 1. Validate file type and size
  // 2. Upload to Cloudinary
  // 3. Update user avatar URL in database
  // 4. Return new avatar URL

  res.status(501).json({
    message: 'Upload de avatar será implementado em breve',
  });
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { password } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true }
  });

  if (!user) {
    throw createError.notFound('Usuário não encontrado');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw createError.badRequest('Senha incorreta');
  }

  // Check for upcoming appointments
  const upcomingAppointments = await prisma.appointment.count({
    where: {
      userId,
      status: 'SCHEDULED',
      date: { gte: new Date() }
    }
  });

  if (upcomingAppointments > 0) {
    throw createError.badRequest('Não é possível excluir conta com consultas agendadas');
  }

  // Soft delete user and dependents
  await prisma.$transaction([
    prisma.dependent.updateMany({
      where: { userId },
      data: { isActive: false }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    }),
    prisma.authSession.deleteMany({
      where: { userId }
    })
  ]);

  logger.info('User account deleted', { userId });

  res.status(200).json({
    message: 'Conta excluída com sucesso',
  });
});