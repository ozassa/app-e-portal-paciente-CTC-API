import { Router } from 'express';
import { AuthController } from '@/controllers/authController';

const router = Router();

// POST /api/auth/login
router.post('/login', AuthController.login);

// POST /api/auth/verify-2fa
router.post('/verify-2fa', AuthController.verifyTwoFactor);

// POST /api/auth/refresh
router.post('/refresh', AuthController.refreshToken);

// POST /api/auth/logout
router.post('/logout', AuthController.logout);

// POST /api/auth/resend-otp
router.post('/resend-otp', AuthController.resendOTP);

// POST /api/auth/forgot-password
router.post('/forgot-password', AuthController.forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', AuthController.resetPassword);

export default router;
