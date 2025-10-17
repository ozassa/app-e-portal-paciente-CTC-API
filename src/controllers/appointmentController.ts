import { Request, Response, NextFunction } from 'express';
import { AppointmentService } from '@/services/appointmentService';
import { logger } from '@/utils/logger';

export class AppointmentController {
  static async getAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;

      const appointments = await AppointmentService.getUserAppointments(userId);

      res.json(appointments);
    } catch (error: any) {
      logger.error('Get appointments error', error);
      next(error);
    }
  }

  static async getAppointmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const appointment = await AppointmentService.getAppointmentById(id, userId);

      if (!appointment) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }

      res.json(appointment);
    } catch (error: any) {
      logger.error('Get appointment error', error);
      next(error);
    }
  }
}
