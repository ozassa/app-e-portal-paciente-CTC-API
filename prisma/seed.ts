import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Criar usuário de teste
  const hashedPassword = await bcrypt.hash('Senha@123', 10);

  const user = await prisma.user.upsert({
    where: { cpf: '12345678900' },
    update: {},
    create: {
      cpf: '12345678900',
      nome: 'João da Silva',
      email: 'joao.silva@example.com',
      telefone: '11987654321',
      celular: '11987654321',
      password: hashedPassword,
      dataNascimento: new Date('1990-01-15'),
      sexo: 'M',
      twoFactorEnabled: true,
      twoFactorMethod: 'sms',
    },
  });

  console.log('✅ User created:', user.nome);

  // Criar unidades de exemplo
  const units = [
    {
      nome: 'CTC Clínica Central',
      tipo: 'clinica',
      endereco: 'Av. Paulista, 1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01310-100',
      telefone: '1133334444',
      latitude: -23.5617,
      longitude: -46.6563,
      servicos: ['Consultas', 'Exames'],
    },
    {
      nome: 'CTC Laboratório Norte',
      tipo: 'laboratorio',
      endereco: 'Rua Augusta, 500',
      bairro: 'Consolação',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01305-000',
      telefone: '1133335555',
      latitude: -23.5522,
      longitude: -46.6598,
      servicos: ['Exames Laboratoriais', 'Raio-X'],
    },
  ];

  for (const unitData of units) {
    await prisma.unit.upsert({
      where: { id: unitData.nome }, // Hack: usar nome como ID temporário
      update: {},
      create: unitData as any,
    });
  }

  console.log('✅ Units created');

  // Criar agendamento de exemplo
  await prisma.appointment.create({
    data: {
      userId: user.id,
      tipo: 'consulta',
      especialidade: 'Cardiologia',
      profissional: 'Dr. Pedro Santos',
      unidade: 'CTC Clínica Central',
      dataHora: new Date('2025-02-15T10:00:00'),
      status: 'agendado',
    },
  });

  console.log('✅ Appointment created');

  // Criar dashboard card
  await prisma.dashboardCard.create({
    data: {
      userId: user.id,
      nomeCompleto: user.nome,
      cpfMasked: '***.***.***-00',
      matricula: '678900',
      plano: 'Plano Básico',
      validade: new Date('2026-12-31'),
      qrCodeData: user.id,
    },
  });

  console.log('✅ Dashboard card created');

  console.log('\n🎉 Seeding completed!');
  console.log('\n📝 Test credentials:');
  console.log('   CPF: 12345678900');
  console.log('   Password: Senha@123');
  console.log('   OTP: Check console during login (development mode)\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
