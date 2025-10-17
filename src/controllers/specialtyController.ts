import { Request, Response } from 'express';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import prisma from '@/lib/prisma';

export const getSpecialties = asyncHandler(async (req: Request, res: Response) => {
  const specialties = await prisma.specialty.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      _count: {
        select: {
          doctors: {
            where: { isActive: true }
          },
          unitSpecialties: true,
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  res.status(200).json(
    specialties.map(specialty => ({
      id: specialty.id,
      name: specialty.name,
      description: specialty.description,
      icon: specialty.icon,
      doctorCount: specialty._count.doctors,
      unitCount: specialty._count.unitSpecialties,
    }))
  );
});

export const getSpecialty = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId } = req.params;

  const specialty = await prisma.specialty.findUnique({
    where: { id: specialtyId },
    include: {
      doctors: {
        where: { isActive: true },
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
            }
          }
        },
        orderBy: { name: 'asc' }
      },
      unitSpecialties: {
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
              phone: true,
              coordinates: true,
            }
          }
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
    }
  });

  if (!specialty) {
    throw createError.notFound('Especialidade não encontrada');
  }

  res.status(200).json({
    id: specialty.id,
    name: specialty.name,
    description: specialty.description,
    icon: specialty.icon,
    doctors: specialty.doctors.map(doctor => ({
      id: doctor.id,
      name: doctor.name,
      crm: doctor.crm,
      photo: doctor.photo,
      bio: doctor.bio,
      unit: doctor.unit,
    })),
    units: specialty.unitSpecialties.map(us => us.unit),
    upcomingAppointments: specialty._count.appointments,
  });
});

export const getSpecialtyDoctors = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId } = req.params;
  const { unitId, city } = req.query;

  // Verify specialty exists
  const specialty = await prisma.specialty.findUnique({
    where: { id: specialtyId }
  });

  if (!specialty) {
    throw createError.notFound('Especialidade não encontrada');
  }

  const where: any = {
    specialtyId,
    isActive: true,
  };

  if (unitId) {
    where.unitId = unitId;
  }

  if (city) {
    where.unit = {
      city: {
        contains: city as string,
        mode: 'insensitive'
      }
    };
  }

  const doctors = await prisma.doctor.findMany({
    where,
    include: {
      unit: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          phone: true,
          coordinates: true,
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
      unit: doctor.unit,
      upcomingAppointments: doctor._count.appointments,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    }))
  );
});

export const getSpecialtyUnits = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId } = req.params;
  const { city, lat, lng, radius } = req.query;

  // Verify specialty exists
  const specialty = await prisma.specialty.findUnique({
    where: { id: specialtyId }
  });

  if (!specialty) {
    throw createError.notFound('Especialidade não encontrada');
  }

  const where: any = {
    specialtyId,
    unit: {
      isActive: true,
    }
  };

  if (city) {
    where.unit.city = {
      contains: city as string,
      mode: 'insensitive'
    };
  }

  const unitSpecialties = await prisma.unitSpecialty.findMany({
    where,
    include: {
      unit: {
        include: {
          workingHours: {
            orderBy: { dayOfWeek: 'asc' }
          },
          _count: {
            select: {
              doctors: {
                where: {
                  specialtyId,
                  isActive: true
                }
              }
            }
          }
        }
      }
    }
  });

  let units = unitSpecialties.map(us => ({
    id: us.unit.id,
    name: us.unit.name,
    address: us.unit.address,
    city: us.unit.city,
    state: us.unit.state,
    zipCode: us.unit.zipCode,
    phone: us.unit.phone,
    email: us.unit.email,
    coordinates: us.unit.latitude && us.unit.longitude ? {
      lat: us.unit.latitude,
      lng: us.unit.longitude
    } : null,
    workingHours: formatWorkingHours(us.unit.workingHours),
    specialtyDoctorCount: us.unit._count.doctors,
    createdAt: us.unit.createdAt,
    updatedAt: us.unit.updatedAt,
  }));

  // Apply distance filter if coordinates provided
  if (lat && lng && radius && typeof lat === 'number' && typeof lng === 'number') {
    units = units.filter(unit => {
      if (!unit.coordinates) return false;
      
      const distance = calculateDistance(
        Number(lat),
        Number(lng),
        unit.coordinates.lat,
        unit.coordinates.lng
      );
      
      return distance <= Number(radius);
    }).map(unit => ({
      ...unit,
      distance: unit.coordinates ? calculateDistance(
        Number(lat),
        Number(lng),
        unit.coordinates.lat,
        unit.coordinates.lng
      ) : null
    })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  res.status(200).json(units);
});

export const searchSpecialties = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    throw createError.badRequest('Termo de busca deve ter pelo menos 2 caracteres');
  }

  const searchTerm = q.trim();

  const specialties = await prisma.specialty.findMany({
    where: {
      OR: [
        {
          name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      ]
    },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      _count: {
        select: {
          doctors: {
            where: { isActive: true }
          },
          unitSpecialties: true,
        }
      }
    },
    take: 20, // Limit results
    orderBy: { name: 'asc' }
  });

  res.status(200).json(
    specialties.map(specialty => ({
      id: specialty.id,
      name: specialty.name,
      description: specialty.description,
      icon: specialty.icon,
      doctorCount: specialty._count.doctors,
      unitCount: specialty._count.unitSpecialties,
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