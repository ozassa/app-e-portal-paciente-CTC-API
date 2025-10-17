import { Request, Response, NextFunction } from 'express';
import { UserService } from '@/services/userService';
import { logger } from '@/utils/logger';

export class UserController {
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;

      const user = await UserService.getUserById(userId);

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json(user);
    } catch (error: any) {
      logger.error('Get user error', error);
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const data = req.body;

      const user = await UserService.updateUser(userId, data);

      res.json(user);
    } catch (error: any) {
      logger.error('Update user error', error);
      next(error);
    }
  }

  static async getDependents(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;

      const dependents = await UserService.getDependents(userId);

      res.json(dependents);
    } catch (error: any) {
      logger.error('Get dependents error', error);
      next(error);
    }
  }
}
