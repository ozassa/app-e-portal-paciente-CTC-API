import { Router } from 'express';
import { AppointmentController } from '@/controllers/appointmentController';
import { authMiddleware } from '@/middlewares/authMiddleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/appointments
router.get('/', AppointmentController.getAppointments);

// GET /api/appointments/:id
router.get('/:id', AppointmentController.getAppointmentById);

export default router;
