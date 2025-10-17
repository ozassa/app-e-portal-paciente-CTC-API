import { Request, Response } from 'express';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { smsService } from '@/services/sms';
import { emailService } from '@/services/email';
import prisma from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { formatPhone } from '@/utils/validation';

export const getAppointments = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { status, startDate, endDate, dependentId } = req.query;

  const where: any = {
    userId,
  };

  if (status) {
    where.status = status;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.date.lte = new Date(endDate as string);
    }
  }

  if (dependentId) {
    where.dependentId = dependentId;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      unit: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          phone: true,
        }
      },
      specialty: {
        select: {
          id: true,
          name: true,
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          crm: true,
        }
      },
      dependent: {
        select: {
          id: true,
          name: true,
          relationship: true,
        }
      }
    },
    orderBy: [
      { date: 'desc' },
      { time: 'desc' }
    ]
  });

  const formattedAppointments = appointments.map(appointment => ({
    id: appointment.id,
    unitId: appointment.unitId,
    unitName: appointment.unit.name,
    unitAddress: appointment.unit.address,
    unitCity: appointment.unit.city,
    unitPhone: appointment.unit.phone,
    specialtyId: appointment.specialtyId,
    specialtyName: appointment.specialty.name,
    doctorId: appointment.doctorId,
    doctorName: appointment.doctor.name,
    doctorCrm: appointment.doctor.crm,
    date: appointment.date.toISOString().split('T')[0],
    time: appointment.time,
    status: appointment.status,
    notes: appointment.notes,
    dependentId: appointment.dependentId,
    dependentName: appointment.dependent?.name,
    dependentRelationship: appointment.dependent?.relationship,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  }));

  res.status(200).json(formattedAppointments);
});

export const createAppointment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { unitId, specialtyId, doctorId, date, time, dependentId, notes } = req.body;

  // Validate that the doctor works at the unit and has the specialty
  const doctor = await prisma.doctor.findFirst({
    where: {
      id: doctorId,
      unitId,
      specialtyId,
      isActive: true,
    },
    include: {
      unit: true,
      specialty: true,
    }
  });

  if (!doctor) {
    throw createError.badRequest('Médico não encontrado ou não disponível nesta unidade/especialidade');
  }

  // Validate dependent belongs to user if provided
  if (dependentId) {
    const dependent = await prisma.dependent.findFirst({
      where: {
        id: dependentId,
        userId,
        isActive: true,
      }
    });

    if (!dependent) {
      throw createError.badRequest('Dependente não encontrado');
    }
  }

  // Check if time slot is available
  const appointmentDate = new Date(date);
  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      doctorId,
      date: appointmentDate,
      time,
      status: { in: ['SCHEDULED'] }
    }
  });

  if (existingAppointment) {
    throw createError.conflict('Horário não disponível');
  }

  // Check doctor availability
  const availability = await prisma.doctorAvailability.findUnique({
    where: {
      doctorId_date_timeSlot: {
        doctorId,
        date: appointmentDate,
        timeSlot: time,
      }
    }
  });

  if (!availability || availability.isBooked) {
    throw createError.conflict('Horário não disponível na agenda do médico');
  }

  // Create appointment
  const appointment = await prisma.$transaction(async (tx) => {
    // Create the appointment
    const newAppointment = await tx.appointment.create({
      data: {
        userId,
        dependentId,
        unitId,
        specialtyId,
        doctorId,
        date: appointmentDate,
        time,
        notes,
        status: 'SCHEDULED',
      },
      include: {
        unit: true,
        specialty: true,
        doctor: true,
        dependent: true,
        user: true,
      }
    });

    // Mark time slot as booked
    await tx.doctorAvailability.update({
      where: {
        doctorId_date_timeSlot: {
          doctorId,
          date: appointmentDate,
          timeSlot: time,
        }
      },
      data: { isBooked: true }
    });

    return newAppointment;
  });

  // Send confirmation messages
  const user = appointment.user;
  const appointmentDetails = {
    doctorName: appointment.doctor.name,
    date: appointment.date.toLocaleDateString('pt-BR'),
    time: appointment.time,
    unitName: appointment.unit.name,
    unitAddress: appointment.unit.address,
    specialtyName: appointment.specialty.name,
  };

  // Send SMS confirmation
  const smsPromise = smsService.sendAppointmentConfirmation(
    user.phone,
    appointmentDetails
  );

  // Send email confirmation if user has email
  const emailPromise = user.email 
    ? emailService.sendAppointmentConfirmationEmail(
        user.email,
        user.name,
        appointmentDetails
      )
    : Promise.resolve(true);

  await Promise.allSettled([smsPromise, emailPromise]);

  // Create notification
  await prisma.notification.create({
    data: {
      userId,
      title: 'Consulta Agendada',
      message: `Sua consulta com ${appointment.doctor.name} foi agendada para ${appointmentDetails.date} às ${appointment.time}`,
      type: 'APPOINTMENT',
      data: {
        appointmentId: appointment.id,
        type: 'confirmation'
      }
    }
  });

  logger.info('Appointment created', {
    userId,
    appointmentId: appointment.id,
    doctorId,
    date: appointment.date,
    time: appointment.time,
  });

  res.status(201).json({
    id: appointment.id,
    unitId: appointment.unitId,
    unitName: appointment.unit.name,
    unitAddress: appointment.unit.address,
    specialtyId: appointment.specialtyId,
    specialtyName: appointment.specialty.name,
    doctorId: appointment.doctorId,
    doctorName: appointment.doctor.name,
    doctorCrm: appointment.doctor.crm,
    date: appointment.date.toISOString().split('T')[0],
    time: appointment.time,
    status: appointment.status,
    notes: appointment.notes,
    dependentId: appointment.dependentId,
    dependentName: appointment.dependent?.name,
    createdAt: appointment.createdAt,
  });
});

export const getAppointment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { appointmentId } = req.params;

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      userId,
    },
    include: {
      unit: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          phone: true,
          latitude: true,
          longitude: true,
        }
      },
      specialty: {
        select: {
          id: true,
          name: true,
          description: true,
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          crm: true,
          bio: true,
          photo: true,
        }
      },
      dependent: {
        select: {
          id: true,
          name: true,
          relationship: true,
        }
      }
    }
  });

  if (!appointment) {
    throw createError.notFound('Consulta não encontrada');
  }

  res.status(200).json({
    id: appointment.id,
    unit: appointment.unit,
    specialty: appointment.specialty,
    doctor: appointment.doctor,
    date: appointment.date.toISOString().split('T')[0],
    time: appointment.time,
    status: appointment.status,
    notes: appointment.notes,
    dependent: appointment.dependent,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  });
});

export const updateAppointment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { appointmentId } = req.params;
  const { date, time, notes } = req.body;

  // Find appointment
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      userId,
      status: 'SCHEDULED',
    },
    include: {
      doctor: true,
      unit: true,
      specialty: true,
      user: true,
    }
  });

  if (!appointment) {
    throw createError.notFound('Consulta não encontrada ou não pode ser alterada');
  }

  // Check if trying to reschedule
  if (date || time) {
    const newDate = date ? new Date(date) : appointment.date;
    const newTime = time || appointment.time;

    // Check if new time slot is available
    if (date !== appointment.date.toISOString().split('T')[0] || time !== appointment.time) {
      const existingAppointment = await prisma.appointment.findFirst({
        where: {
          doctorId: appointment.doctorId,
          date: newDate,
          time: newTime,
          status: 'SCHEDULED',
          id: { not: appointmentId }
        }
      });

      if (existingAppointment) {
        throw createError.conflict('Novo horário não disponível');
      }

      // Check doctor availability for new slot
      const availability = await prisma.doctorAvailability.findUnique({
        where: {
          doctorId_date_timeSlot: {
            doctorId: appointment.doctorId,
            date: newDate,
            timeSlot: newTime,
          }
        }
      });

      if (!availability || availability.isBooked) {
        throw createError.conflict('Novo horário não disponível na agenda do médico');
      }
    }
  }

  // Update appointment
  const updatedAppointment = await prisma.$transaction(async (tx) => {
    // If rescheduling, update availability slots
    if (date || time) {
      const newDate = date ? new Date(date) : appointment.date;
      const newTime = time || appointment.time;

      // Free old slot
      await tx.doctorAvailability.updateMany({
        where: {
          doctorId: appointment.doctorId,
          date: appointment.date,
          timeSlot: appointment.time,
        },
        data: { isBooked: false }
      });

      // Book new slot
      await tx.doctorAvailability.updateMany({
        where: {
          doctorId: appointment.doctorId,
          date: newDate,
          timeSlot: newTime,
        },
        data: { isBooked: true }
      });
    }

    // Update appointment
    return await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(date && { date: new Date(date) }),
        ...(time && { time }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        unit: true,
        specialty: true,
        doctor: true,
        dependent: true,
      }
    });
  });

  // Send update notification if rescheduled
  if (date || time) {
    const appointmentDetails = {
      doctorName: updatedAppointment.doctor.name,
      date: updatedAppointment.date.toLocaleDateString('pt-BR'),
      time: updatedAppointment.time,
      unitName: updatedAppointment.unit.name,
      unitAddress: updatedAppointment.unit.address,
      specialtyName: updatedAppointment.specialty.name,
    };

    // Send SMS update
    const smsPromise = smsService.sendAppointmentConfirmation(
      appointment.user.phone,
      appointmentDetails
    );

    // Send email update
    const emailPromise = appointment.user.email
      ? emailService.sendAppointmentConfirmationEmail(
          appointment.user.email,
          appointment.user.name,
          appointmentDetails
        )
      : Promise.resolve(true);

    await Promise.allSettled([smsPromise, emailPromise]);

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: 'Consulta Reagendada',
        message: `Sua consulta foi reagendada para ${appointmentDetails.date} às ${updatedAppointment.time}`,
        type: 'UPDATE',
        data: {
          appointmentId: updatedAppointment.id,
          type: 'reschedule'
        }
      }
    });
  }

  logger.info('Appointment updated', {
    userId,
    appointmentId,
    updatedFields: Object.keys(req.body),
  });

  res.status(200).json({
    id: updatedAppointment.id,
    unitId: updatedAppointment.unitId,
    unitName: updatedAppointment.unit.name,
    specialtyId: updatedAppointment.specialtyId,
    specialtyName: updatedAppointment.specialty.name,
    doctorId: updatedAppointment.doctorId,
    doctorName: updatedAppointment.doctor.name,
    date: updatedAppointment.date.toISOString().split('T')[0],
    time: updatedAppointment.time,
    status: updatedAppointment.status,
    notes: updatedAppointment.notes,
    dependentId: updatedAppointment.dependentId,
    dependentName: updatedAppointment.dependent?.name,
    updatedAt: updatedAppointment.updatedAt,
  });
});

export const cancelAppointment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { appointmentId } = req.params;

  // Find appointment
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      userId,
      status: 'SCHEDULED',
    },
    include: {
      doctor: true,
      unit: true,
      specialty: true,
      user: true,
      dependent: true,
    }
  });

  if (!appointment) {
    throw createError.notFound('Consulta não encontrada ou não pode ser cancelada');
  }

  // Check if appointment is too close (e.g., less than 24 hours)
  const appointmentDateTime = new Date(`${appointment.date.toISOString().split('T')[0]}T${appointment.time}`);
  const now = new Date();
  const hoursUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilAppointment < 24) {
    throw createError.badRequest('Consultas só podem ser canceladas com pelo menos 24 horas de antecedência');
  }

  // Cancel appointment and free time slot
  await prisma.$transaction(async (tx) => {
    // Update appointment status
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' }
    });

    // Free time slot
    await tx.doctorAvailability.updateMany({
      where: {
        doctorId: appointment.doctorId,
        date: appointment.date,
        timeSlot: appointment.time,
      },
      data: { isBooked: false }
    });
  });

  // Send cancellation messages
  const appointmentDetails = {
    doctorName: appointment.doctor.name,
    date: appointment.date.toLocaleDateString('pt-BR'),
    time: appointment.time,
    unitName: appointment.unit.name,
    specialtyName: appointment.specialty.name,
  };

  // Send SMS cancellation
  const message = `Sua consulta com ${appointmentDetails.doctorName} em ${appointmentDetails.date} às ${appointmentDetails.time} foi cancelada. ${process.env.APP_NAME || 'App Telas Mágicas'}`;
  const smsPromise = smsService.send2FACode(appointment.user.phone, message.slice(0, 160));

  // Send email cancellation
  const emailPromise = appointment.user.email
    ? emailService.sendAppointmentCancellationEmail(
        appointment.user.email,
        appointment.user.name,
        appointmentDetails
      )
    : Promise.resolve(true);

  await Promise.allSettled([smsPromise, emailPromise]);

  // Create notification
  await prisma.notification.create({
    data: {
      userId,
      title: 'Consulta Cancelada',
      message: `Sua consulta de ${appointmentDetails.date} às ${appointment.time} foi cancelada`,
      type: 'UPDATE',
      data: {
        appointmentId: appointment.id,
        type: 'cancellation'
      }
    }
  });

  logger.info('Appointment cancelled', {
    userId,
    appointmentId,
  });

  res.status(204).send();
});