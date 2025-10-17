import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import appointmentRoutes from './appointmentRoutes';
import unitRoutes from './unitRoutes';
import dashboardRoutes from './dashboardRoutes';

const router = Router();

// Montar rotas
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/units', unitRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
