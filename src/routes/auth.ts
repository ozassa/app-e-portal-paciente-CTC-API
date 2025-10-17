import { Router } from 'express';
import { 
  login, 
  verify2FA, 
  refreshToken, 
  signup, 
  logout, 
  resend2FA, 
  forgotPassword, 
  resetPassword 
} from '@/controllers/authController';
import { validate, validationSchemas } from '@/utils/validation';
import { authenticateToken, rateLimitByUser } from '@/middleware/auth';

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user with CPF and password, returns session for 2FA
 */
router.post('/login', 
  validate(validationSchemas.login),
  rateLimitByUser(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  login
);

/**
 * @swagger
 * /auth/verify-2fa:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify 2FA code
 *     description: Complete authentication with 2FA code
 */
router.post('/verify-2fa',
  validate(validationSchemas.verify2FA),
  rateLimitByUser(3, 5 * 60 * 1000), // 3 attempts per 5 minutes
  verify2FA
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     description: Get new access token using refresh token
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     tags: [Authentication]
 *     summary: Create new account
 *     description: Register new user account
 */
router.post('/signup',
  validate(validationSchemas.signup),
  rateLimitByUser(3, 60 * 60 * 1000), // 3 attempts per hour
  signup
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout user
 *     description: Invalidate user session and tokens
 *     security:
 *       - bearerAuth: []
 */
router.post('/logout', authenticateToken, logout);

/**
 * @swagger
 * /auth/resend-2fa:
 *   post:
 *     tags: [Authentication]
 *     summary: Resend 2FA code
 *     description: Request new 2FA code for existing session
 */
router.post('/resend-2fa',
  rateLimitByUser(3, 10 * 60 * 1000), // 3 attempts per 10 minutes
  resend2FA
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset
 *     description: Send password reset code to user's phone
 */
router.post('/forgot-password',
  rateLimitByUser(3, 30 * 60 * 1000), // 3 attempts per 30 minutes
  forgotPassword
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password
 *     description: Reset password using verification code
 */
router.post('/reset-password',
  rateLimitByUser(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  resetPassword
);

export default router;