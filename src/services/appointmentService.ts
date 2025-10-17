import prisma from '@/config/database';

export class AppointmentService {
  static async getUserAppointments(userId: string) {
    return await prisma.appointment.findMany({
      where: { userId },
      orderBy: { dataHora: 'desc' },
    });
  }

  static async getAppointmentById(appointmentId: string, userId: string) {
    return await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        userId,
      },
    });
  }
}
