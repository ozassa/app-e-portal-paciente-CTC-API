import { Router } from 'express';
import { UserController } from '@/controllers/userController';
import { authMiddleware } from '@/middlewares/authMiddleware';

const router = Router();

// Todas as rotas de usuário requerem autenticação
router.use(authMiddleware);

// GET /api/users/me
router.get('/me', UserController.getMe);

// PUT /api/users/me
router.put('/me', UserController.updateProfile);

// GET /api/users/dependents
router.get('/dependents', UserController.getDependents);

export default router;
