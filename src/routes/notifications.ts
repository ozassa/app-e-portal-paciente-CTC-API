import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadCount,
  createNotification,
  getNotificationStats,
} from '@/controllers/notificationController';
import { authenticateToken, rateLimitByUser } from '@/middleware/auth';

const router = Router();

// Apply authentication to all notification routes
router.use(authenticateToken);

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user's notifications
 *     description: Retrieve list of user's notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *         description: Filter to show only unread notifications
 */
router.get('/', getNotifications);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notifications count
 *     description: Get the count of unread notifications for the user
 *     security:
 *       - bearerAuth: []
 */
router.get('/unread-count', getUnreadCount);

/**
 * @swagger
 * /notifications/stats:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification statistics
 *     description: Get statistics about user's notifications
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', getNotificationStats);

/**
 * @swagger
 * /notifications/mark-read:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark notifications as read
 *     description: Mark specific notifications as read
 *     security:
 *       - bearerAuth: []
 */
router.post('/mark-read',
  rateLimitByUser(50, 60 * 60 * 1000), // 50 mark operations per hour
  markAsRead
);

/**
 * @swagger
 * /notifications/mark-all-read:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     description: Mark all user's notifications as read
 *     security:
 *       - bearerAuth: []
 */
router.post('/mark-all-read',
  rateLimitByUser(10, 60 * 60 * 1000), // 10 mark-all operations per hour
  markAllAsRead
);

/**
 * @swagger
 * /notifications/delete-all:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete all notifications
 *     description: Delete all user's notifications
 *     security:
 *       - bearerAuth: []
 */
router.delete('/delete-all',
  rateLimitByUser(3, 24 * 60 * 60 * 1000), // 3 delete-all operations per day
  deleteAllNotifications
);

/**
 * @swagger
 * /notifications/create:
 *   post:
 *     tags: [Notifications]
 *     summary: Create notification (Admin/System)
 *     description: Create a new notification (typically used by admin or system)
 *     security:
 *       - bearerAuth: []
 */
router.post('/create',
  rateLimitByUser(100, 60 * 60 * 1000), // 100 notifications per hour
  createNotification
);

/**
 * @swagger
 * /notifications/{notificationId}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete specific notification
 *     description: Delete a specific notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 */
router.delete('/:notificationId',
  rateLimitByUser(50, 60 * 60 * 1000), // 50 deletions per hour
  deleteNotification
);

export default router;