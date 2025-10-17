import { Router } from 'express';
import {
  getSpecialties,
  getSpecialty,
  getSpecialtyDoctors,
  getSpecialtyUnits,
  searchSpecialties,
} from '@/controllers/specialtyController';
import { optionalAuth } from '@/middleware/auth';

const router = Router();

/**
 * @swagger
 * /specialties:
 *   get:
 *     tags: [Specialties]
 *     summary: Get medical specialties
 *     description: Retrieve list of available medical specialties
 */
router.get('/',
  optionalAuth, // Authentication is optional for browsing specialties
  getSpecialties
);

/**
 * @swagger
 * /specialties/search:
 *   get:
 *     tags: [Specialties]
 *     summary: Search specialties
 *     description: Search specialties by name or description
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
  optionalAuth, // Authentication is optional for searching specialties
  searchSpecialties
);

/**
 * @swagger
 * /specialties/{specialtyId}:
 *   get:
 *     tags: [Specialties]
 *     summary: Get specific specialty
 *     description: Retrieve detailed information about a specific medical specialty
 *     parameters:
 *       - in: path
 *         name: specialtyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Specialty ID
 */
router.get('/:specialtyId',
  optionalAuth, // Authentication is optional for viewing specialty details
  getSpecialty
);

/**
 * @swagger
 * /specialties/{specialtyId}/doctors:
 *   get:
 *     tags: [Specialties]
 *     summary: Get specialty's doctors
 *     description: Retrieve list of doctors for a specific specialty
 *     parameters:
 *       - in: path
 *         name: specialtyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Specialty ID
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *         description: Filter by unit ID
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city name
 */
router.get('/:specialtyId/doctors',
  optionalAuth, // Authentication is optional for viewing doctors
  getSpecialtyDoctors
);

/**
 * @swagger
 * /specialties/{specialtyId}/units:
 *   get:
 *     tags: [Specialties]
 *     summary: Get specialty's units
 *     description: Retrieve list of units that offer a specific specialty
 *     parameters:
 *       - in: path
 *         name: specialtyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Specialty ID
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city name
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
router.get('/:specialtyId/units',
  optionalAuth, // Authentication is optional for viewing units
  getSpecialtyUnits
);

export default router;