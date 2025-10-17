import { Request, Response } from 'express';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import prisma from '@/lib/prisma';
import { logger } from '@/utils/logger';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { unread } = req.query;

  const where: any = { userId };

  if (unread === 'true') {
    where.isRead = false;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50, // Limit to last 50 notifications
  });

  res.status(200).json(
    notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      data: notification.data,
      createdAt: notification.createdAt,
    }))
  );
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw createError.badRequest('Lista de IDs de notificações é obrigatória');
  }

  // Verify notifications belong to user and update them
  const result = await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    }
  });

  logger.info('Notifications marked as read', {
    userId,
    count: result.count,
    notificationIds,
  });

  res.status(200).json({
    message: 'Notificações marcadas como lidas',
    updatedCount: result.count,
  });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    }
  });

  logger.info('All notifications marked as read', {
    userId,
    count: result.count,
  });

  res.status(200).json({
    message: 'Todas as notificações foram marcadas como lidas',
    updatedCount: result.count,
  });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { notificationId } = req.params;

  // Verify notification belongs to user
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    }
  });

  if (!notification) {
    throw createError.notFound('Notificação não encontrada');
  }

  await prisma.notification.delete({
    where: { id: notificationId }
  });

  logger.info('Notification deleted', {
    userId,
    notificationId,
  });

  res.status(204).send();
});

export const deleteAllNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const result = await prisma.notification.deleteMany({
    where: { userId }
  });

  logger.info('All notifications deleted', {
    userId,
    count: result.count,
  });

  res.status(200).json({
    message: 'Todas as notificações foram excluídas',
    deletedCount: result.count,
  });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    }
  });

  res.status(200).json({ unreadCount: count });
});

export const createNotification = asyncHandler(async (req: Request, res: Response) => {
  // This endpoint is typically used by admin/system, not regular users
  // For demo purposes, we'll allow it but in production it should be restricted
  const { userId, title, message, type, data } = req.body;

  if (!userId || !title || !message || !type) {
    throw createError.badRequest('userId, title, message e type são obrigatórios');
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true }
  });

  if (!user) {
    throw createError.notFound('Usuário não encontrado');
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      data: data || null,
    }
  });

  logger.info('Notification created', {
    notificationId: notification.id,
    userId,
    type,
  });

  res.status(201).json({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    isRead: notification.isRead,
    data: notification.data,
    createdAt: notification.createdAt,
  });
});

export const getNotificationStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const [total, unread, byType] = await Promise.all([
    // Total notifications
    prisma.notification.count({
      where: { userId }
    }),

    // Unread notifications
    prisma.notification.count({
      where: {
        userId,
        isRead: false,
      }
    }),

    // Notifications by type
    prisma.notification.groupBy({
      by: ['type'],
      where: { userId },
      _count: {
        type: true,
      }
    })
  ]);

  const typeStats = byType.reduce((acc, item) => {
    acc[item.type] = item._count.type;
    return acc;
  }, {} as Record<string, number>);

  res.status(200).json({
    total,
    unread,
    read: total - unread,
    byType: typeStats,
  });
});