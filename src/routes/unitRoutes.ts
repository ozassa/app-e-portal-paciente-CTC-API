import { Router } from 'express';
import { UnitController } from '@/controllers/unitController';
import { authMiddleware } from '@/middlewares/authMiddleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/units
router.get('/', UnitController.getUnits);

// GET /api/units/:id
router.get('/:id', UnitController.getUnitById);

export default router;
