import { User } from '@prisma/client';
import prisma from '@/config/database';

export class UserService {
  static async getUserById(userId: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        cpf: true,
        nome: true,
        email: true,
        telefone: true,
        celular: true,
        dataNascimento: true,
        sexo: true,
        avatarUrl: true,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        // Não retornar password
        password: false,
      } as any,
    });
  }

  static async updateUser(userId: string, data: Partial<User>): Promise<User> {
    // Não permitir atualização de campos sensíveis via este método
    const { password, cpf, isActive, ...safeData } = data;

    return await prisma.user.update({
      where: { id: userId },
      data: safeData,
    });
  }

  static async getDependents(userId: string) {
    return await prisma.dependent.findMany({
      where: { userId, isActive: true },
      orderBy: { nome: 'asc' },
    });
  }
}
