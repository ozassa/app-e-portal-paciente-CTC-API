import { Request, Response } from 'express';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import prisma from '@/lib/prisma';
import { logger } from '@/utils/logger';

interface LocationQuery {
  lat?: number;
  lng?: number;
  radius?: number;
}

export const getUnits = asyncHandler(async (req: Request, res: Response) => {
  const { city, specialty, lat, lng, radius } = req.query as any;

  let where: any = {
    isActive: true,
  };

  // Filter by city
  if (city) {
    where.city = {
      contains: city,
      mode: 'insensitive'
    };
  }

  // Filter by specialty
  if (specialty) {
    where.specialties = {
      some: {
        specialty: {
          OR: [
            {
              name: {
                contains: specialty,
                mode: 'insensitive'
              }
            },
            {
              id: specialty
            }
          ]
        }
      }
    };
  }

  const units = await prisma.unit.findMany({
    where,
    include: {
      specialties: {
        include: {
          specialty: {
            select: {
              id: true,
              name: true,
              description: true,
              icon: true,
            }
          }
        }
      },
      workingHours: {
        orderBy: { dayOfWeek: 'asc' }
      },
      _count: {
        select: {
          doctors: {
            where: { isActive: true }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  let results = units.map(unit => ({
    id: unit.id,
    name: unit.name,
    address: unit.address,
    city: unit.city,
    state: unit.state,
    zipCode: unit.zipCode,
    phone: unit.phone,
    email: unit.email,
    coordinates: unit.latitude && unit.longitude ? {
      lat: unit.latitude,
      lng: unit.longitude
    } : null,
    specialties: unit.specialties.map(us => us.specialty),
    workingHours: formatWorkingHours(unit.workingHours),
    doctorCount: unit._count.doctors,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  }));

  // Apply distance filter if coordinates provided
  if (lat && lng && radius && typeof lat === 'number' && typeof lng === 'number') {
    results = results.filter(unit => {
      if (!unit.coordinates) return false;
      
      const distance = calculateDistance(
        lat,
        lng,
        unit.coordinates.lat,
        unit.coordinates.lng
      );
      
      return distance <= radius;
    }).map(unit => ({
      ...unit,
      distance: unit.coordinates ? calculateDistance(
        lat,
        lng,
        unit.coordinates.lat,
        unit.coordinates.lng
      ) : null
    })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  res.status(200).json(results);
});

export const getUnit = asyncHandler(async (req: Request, res: Response) => {
  const { unitId } = req.params;

  const unit = await prisma.unit.findUnique({
    where: { 
      id: unitId,
      isActive: true 
    },
    include: {
      specialties: {
        include: {
          specialty: {
            select: {
              id: true,
              name: true,
              description: true,
              icon: true,
            }
          }
        }
      },
      workingHours: {
        orderBy: { dayOfWeek: 'asc' }
      },
      doctors: {
        where: { isActive: true },
        include: {
          specialty: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { name: 'asc' }
      }
    }
  });

  if (!unit) {
    throw createError.notFound('Unidade não encontrada');
  }

  res.status(200).json({
    id: unit.id,
    name: unit.name,
    address: unit.address,
    city: unit.city,
    state: unit.state,
    zipCode: unit.zipCode,
    phone: unit.phone,
    email: unit.email,
    coordinates: unit.latitude && unit.longitude ? {
      lat: unit.latitude,
      lng: unit.longitude
    } : null,
    specialties: unit.specialties.map(us => us.specialty),
    workingHours: formatWorkingHours(unit.workingHours),
    doctors: unit.doctors.map(doctor => ({
      id: doctor.id,
      name: doctor.name,
      crm: doctor.crm,
      photo: doctor.photo,
      bio: doctor.bio,
      specialty: doctor.specialty,
    })),
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  });
});

export const getUnitDoctors = asyncHandler(async (req: Request, res: Response) => {
  const { unitId } = req.params;
  const { specialtyId } = req.query;

  // Verify unit exists
  const unit = await prisma.unit.findUnique({
    where: { 
      id: unitId,
      isActive: true 
    }
  });

  if (!unit) {
    throw createError.notFound('Unidade não encontrada');
  }

  const where: any = {
    unitId,
    isActive: true,
  };

  if (specialtyId) {
    where.specialtyId = specialtyId;
  }

  const doctors = await prisma.doctor.findMany({
    where,
    include: {
      specialty: {
        select: {
          id: true,
          name: true,
          description: true,
        }
      },
      _count: {
        select: {
          appointments: {
            where: {
              status: 'SCHEDULED',
              date: { gte: new Date() }
            }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  res.status(200).json(
    doctors.map(doctor => ({
      id: doctor.id,
      name: doctor.name,
      crm: doctor.crm,
      photo: doctor.photo,
      bio: doctor.bio,
      specialty: doctor.specialty,
      upcomingAppointments: doctor._count.appointments,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    }))
  );
});

export const getAvailableSlots = asyncHandler(async (req: Request, res: Response) => {
  const { unitId } = req.params;
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    throw createError.badRequest('ID do médico e data são obrigatórios');
  }

  // Verify doctor exists and works at the unit
  const doctor = await prisma.doctor.findFirst({
    where: {
      id: doctorId as string,
      unitId,
      isActive: true,
    }
  });

  if (!doctor) {
    throw createError.notFound('Médico não encontrado nesta unidade');
  }

  const requestedDate = new Date(date as string);
  
  // Check if date is in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (requestedDate < today) {
    throw createError.badRequest('Não é possível agendar para datas passadas');
  }

  // Get available slots for the doctor on the requested date
  const availableSlots = await prisma.doctorAvailability.findMany({
    where: {
      doctorId: doctorId as string,
      date: requestedDate,
      isBooked: false,
    },
    orderBy: { timeSlot: 'asc' }
  });

  // Get unit working hours for the day of week
  const dayOfWeek = requestedDate.getDay();
  const workingHours = await prisma.workingHours.findUnique({
    where: {
      unitId_dayOfWeek: {
        unitId,
        dayOfWeek,
      }
    }
  });

  let response: any = {
    date: requestedDate.toISOString().split('T')[0],
    doctorId,
    availableSlots: availableSlots.map(slot => slot.timeSlot),
  };

  if (workingHours) {
    response.unitWorkingHours = workingHours.isClosed ? null : {
      openTime: workingHours.openTime,
      closeTime: workingHours.closeTime,
    };
  }

  res.status(200).json(response);
});

export const searchUnits = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    throw createError.badRequest('Termo de busca deve ter pelo menos 2 caracteres');
  }

  const searchTerm = q.trim();

  const units = await prisma.unit.findMany({
    where: {
      isActive: true,
      OR: [
        {
          name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          address: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          city: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          specialties: {
            some: {
              specialty: {
                name: {
                  contains: searchTerm,
                  mode: 'insensitive'
                }
              }
            }
          }
        }
      ]
    },
    include: {
      specialties: {
        include: {
          specialty: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      },
      _count: {
        select: {
          doctors: {
            where: { isActive: true }
          }
        }
      }
    },
    take: 20, // Limit results
    orderBy: { name: 'asc' }
  });

  res.status(200).json(
    units.map(unit => ({
      id: unit.id,
      name: unit.name,
      address: unit.address,
      city: unit.city,
      state: unit.state,
      phone: unit.phone,
      coordinates: unit.latitude && unit.longitude ? {
        lat: unit.latitude,
        lng: unit.longitude
      } : null,
      specialties: unit.specialties.map(us => us.specialty),
      doctorCount: unit._count.doctors,
    }))
  );
});

// Helper functions
function formatWorkingHours(workingHours: any[]) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const formatted: any = {};

  workingHours.forEach(wh => {
    const dayName = days[wh.dayOfWeek];
    formatted[dayName] = wh.isClosed ? 'Fechado' : `${wh.openTime}-${wh.closeTime}`;
  });

  // Fill missing days with "Fechado"
  days.forEach(day => {
    if (!(day in formatted)) {
      formatted[day] = 'Fechado';
    }
  });

  return formatted;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}