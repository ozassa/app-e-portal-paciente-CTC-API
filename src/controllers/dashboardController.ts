import { Request, Response, NextFunction } from 'express';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { maskCPF } from '@/utils/cpfValidator';

export class DashboardController {
  static async getDashboardCard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;

      // Buscar ou criar dashboard card
      let card = await prisma.dashboardCard.findUnique({
        where: { userId },
      });

      if (!card) {
        // Buscar dados do usuário
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Criar card com dados padrão
        card = await prisma.dashboardCard.create({
          data: {
            userId,
            nomeCompleto: user.nome,
            cpfMasked: maskCPF(user.cpf),
            matricula: user.cpf.slice(-6), // Últimos 6 dígitos como matrícula
            plano: 'Plano Básico', // TODO: buscar plano real
            validade: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 ano
            qrCodeData: user.id, // QR code com ID do usuário
          },
        });
      }

      res.json(card);
    } catch (error: any) {
      logger.error('Get dashboard card error', error);
      next(error);
    }
  }
}
