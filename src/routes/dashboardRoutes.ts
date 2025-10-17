import { Router } from 'express';
import { DashboardController } from '@/controllers/dashboardController';
import { authMiddleware } from '@/middlewares/authMiddleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/dashboard/card
router.get('/card', DashboardController.getDashboardCard);

export default router;
