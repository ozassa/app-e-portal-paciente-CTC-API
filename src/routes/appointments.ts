import { Router } from 'express';
import {
  getAppointments,
  createAppointment,
  getAppointment,
  updateAppointment,
  cancelAppointment,
} from '@/controllers/appointmentController';
import { validate, validateQuery, validationSchemas } from '@/utils/validation';
import { authenticateToken, rateLimitByUser } from '@/middleware/auth';

const router = Router();

// Apply authentication to all appointment routes
router.use(authenticateToken);

/**
 * @swagger
 * /appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: Get user's appointments
 *     description: Retrieve list of user's appointments with optional filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, COMPLETED, CANCELLED, NO_SHOW]
 *         description: Filter by appointment status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter appointments from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter appointments until this date
 *       - in: query
 *         name: dependentId
 *         schema:
 *           type: string
 *         description: Filter appointments for specific dependent
 */
router.get('/',
  validateQuery(validationSchemas.appointmentsQuery),
  getAppointments
);

/**
 * @swagger
 * /appointments:
 *   post:
 *     tags: [Appointments]
 *     summary: Create new appointment
 *     description: Schedule a new appointment
 *     security:
 *       - bearerAuth: []
 */
router.post('/',
  validate(validationSchemas.createAppointment),
  rateLimitByUser(10, 24 * 60 * 60 * 1000), // 10 appointments per day
  createAppointment
);

/**
 * @swagger
 * /appointments/{appointmentId}:
 *   get:
 *     tags: [Appointments]
 *     summary: Get specific appointment
 *     description: Retrieve detailed information about a specific appointment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Appointment ID
 */
router.get('/:appointmentId', getAppointment);

/**
 * @swagger
 * /appointments/{appointmentId}:
 *   put:
 *     tags: [Appointments]
 *     summary: Update appointment
 *     description: Update appointment details (reschedule or change notes)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Appointment ID
 */
router.put('/:appointmentId',
  rateLimitByUser(5, 60 * 60 * 1000), // 5 updates per hour
  updateAppointment
);

/**
 * @swagger
 * /appointments/{appointmentId}:
 *   delete:
 *     tags: [Appointments]
 *     summary: Cancel appointment
 *     description: Cancel a scheduled appointment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Appointment ID
 */
router.delete('/:appointmentId',
  rateLimitByUser(10, 24 * 60 * 60 * 1000), // 10 cancellations per day
  cancelAppointment
);

export default router;