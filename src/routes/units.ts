import { Router } from 'express';
import {
  getUnits,
  getUnit,
  getUnitDoctors,
  getAvailableSlots,
  searchUnits,
} from '@/controllers/unitController';
import { validateQuery, validationSchemas } from '@/utils/validation';
import { authenticateToken, optionalAuth } from '@/middleware/auth';

const router = Router();

/**
 * @swagger
 * /units:
 *   get:
 *     tags: [Units]
 *     summary: Get health units
 *     description: Retrieve list of health units with optional filters
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city name
 *       - in: query
 *         name: specialty
 *         schema:
 *           type: string
 *         description: Filter by specialty name or ID
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude for proximity search
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitude for proximity search
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Search radius in kilometers
 */
router.get('/',
  optionalAuth, // Authentication is optional for browsing units
  validateQuery(validationSchemas.unitsQuery),
  getUnits
);

/**
 * @swagger
 * /units/search:
 *   get:
 *     tags: [Units]
 *     summary: Search health units
 *     description: Search units by name, address, city, or specialty
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query (minimum 2 characters)
 */
router.get('/search',
  optionalAuth, // Authentication is optional for searching units
  searchUnits
);

/**
 * @swagger
 * /units/{unitId}:
 *   get:
 *     tags: [Units]
 *     summary: Get specific unit
 *     description: Retrieve detailed information about a specific health unit
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit ID
 */
router.get('/:unitId',
  optionalAuth, // Authentication is optional for viewing unit details
  getUnit
);

/**
 * @swagger
 * /units/{unitId}/doctors:
 *   get:
 *     tags: [Units]
 *     summary: Get unit's doctors
 *     description: Retrieve list of doctors working at a specific unit
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit ID
 *       - in: query
 *         name: specialtyId
 *         schema:
 *           type: string
 *         description: Filter by specialty ID
 */
router.get('/:unitId/doctors',
  optionalAuth, // Authentication is optional for viewing doctors
  getUnitDoctors
);

/**
 * @swagger
 * /units/{unitId}/available-slots:
 *   get:
 *     tags: [Units]
 *     summary: Get available appointment slots
 *     description: Retrieve available time slots for booking appointments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit ID
 *       - in: query
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Doctor ID
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to check availability (YYYY-MM-DD)
 */
router.get('/:unitId/available-slots',
  authenticateToken, // Authentication required for checking availability
  getAvailableSlots
);

export default router;