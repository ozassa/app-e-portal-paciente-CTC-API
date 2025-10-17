import prisma from '@/config/database';

export class UnitService {
  static async getAllUnits() {
    return await prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { nome: 'asc' },
    });
  }

  static async getUnitById(unitId: string) {
    return await prisma.unit.findUnique({
      where: { id: unitId },
    });
  }

  static async getUnitsByType(tipo: string) {
    return await prisma.unit.findMany({
      where: {
        tipo,
        isActive: true,
      },
      orderBy: { nome: 'asc' },
    });
  }
}
