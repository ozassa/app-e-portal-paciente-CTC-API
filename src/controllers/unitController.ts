import { Request, Response, NextFunction } from 'express';
import { UnitService } from '@/services/unitService';
import { logger } from '@/utils/logger';

export class UnitController {
  static async getUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const { tipo } = req.query;

      let units;
      if (tipo && typeof tipo === 'string') {
        units = await UnitService.getUnitsByType(tipo);
      } else {
        units = await UnitService.getAllUnits();
      }

      res.json(units);
    } catch (error: any) {
      logger.error('Get units error', error);
      next(error);
    }
  }

  static async getUnitById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const unit = await UnitService.getUnitById(id);

      if (!unit) {
        return res.status(404).json({ error: 'Unidade não encontrada' });
      }

      res.json(unit);
    } catch (error: any) {
      logger.error('Get unit error', error);
      next(error);
    }
  }
}
