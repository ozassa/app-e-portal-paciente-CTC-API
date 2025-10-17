import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  getDependents,
  addDependent,
  updateDependent,
  removeDependent,
  getDependent,
  uploadAvatar,
  deleteAccount,
} from '@/controllers/userController';
import { validate, validationSchemas } from '@/utils/validation';
import { authenticateToken, rateLimitByUser } from '@/middleware/auth';

const router = Router();

// Apply authentication to all user routes
router.use(authenticateToken);

/**
 * @swagger
 * /user/profile:
 *   get:
 *     tags: [User]
 *     summary: Get user profile
 *     description: Retrieve current user's profile information
 *     security:
 *       - bearerAuth: []
 */
router.get('/profile', getProfile);

/**
 * @swagger
 * /user/profile:
 *   put:
 *     tags: [User]
 *     summary: Update user profile
 *     description: Update user's profile information
 *     security:
 *       - bearerAuth: []
 */
router.put('/profile',
  validate(validationSchemas.updateProfile),
  rateLimitByUser(10, 60 * 60 * 1000), // 10 updates per hour
  updateProfile
);

/**
 * @swagger
 * /user/change-password:
 *   post:
 *     tags: [User]
 *     summary: Change password
 *     description: Change user's password
 *     security:
 *       - bearerAuth: []
 */
router.post('/change-password',
  rateLimitByUser(3, 60 * 60 * 1000), // 3 attempts per hour
  changePassword
);

/**
 * @swagger
 * /user/dependents:
 *   get:
 *     tags: [Dependents]
 *     summary: Get user's dependents
 *     description: Retrieve list of user's dependents
 *     security:
 *       - bearerAuth: []
 */
router.get('/dependents', getDependents);

/**
 * @swagger
 * /user/dependents:
 *   post:
 *     tags: [Dependents]
 *     summary: Add new dependent
 *     description: Add a new dependent to user's account
 *     security:
 *       - bearerAuth: []
 */
router.post('/dependents',
  validate(validationSchemas.addDependent),
  rateLimitByUser(5, 24 * 60 * 60 * 1000), // 5 dependents per day
  addDependent
);

/**
 * @swagger
 * /user/dependents/{dependentId}:
 *   get:
 *     tags: [Dependents]
 *     summary: Get specific dependent
 *     description: Retrieve information about a specific dependent
 *     security:
 *       - bearerAuth: []
 */
router.get('/dependents/:dependentId', getDependent);

/**
 * @swagger
 * /user/dependents/{dependentId}:
 *   put:
 *     tags: [Dependents]
 *     summary: Update dependent
 *     description: Update dependent's information
 *     security:
 *       - bearerAuth: []
 */
router.put('/dependents/:dependentId',
  rateLimitByUser(10, 60 * 60 * 1000), // 10 updates per hour
  updateDependent
);

/**
 * @swagger
 * /user/dependents/{dependentId}:
 *   delete:
 *     tags: [Dependents]
 *     summary: Remove dependent
 *     description: Remove dependent from user's account
 *     security:
 *       - bearerAuth: []
 */
router.delete('/dependents/:dependentId',
  rateLimitByUser(3, 24 * 60 * 60 * 1000), // 3 deletions per day
  removeDependent
);

/**
 * @swagger
 * /user/upload-avatar:
 *   post:
 *     tags: [User]
 *     summary: Upload avatar
 *     description: Upload user's profile avatar
 *     security:
 *       - bearerAuth: []
 */
router.post('/upload-avatar',
  rateLimitByUser(5, 60 * 60 * 1000), // 5 uploads per hour
  uploadAvatar
);

/**
 * @swagger
 * /user/delete-account:
 *   post:
 *     tags: [User]
 *     summary: Delete account
 *     description: Permanently delete user account
 *     security:
 *       - bearerAuth: []
 */
router.post('/delete-account',
  rateLimitByUser(1, 24 * 60 * 60 * 1000), // 1 attempt per day
  deleteAccount
);

export default router;