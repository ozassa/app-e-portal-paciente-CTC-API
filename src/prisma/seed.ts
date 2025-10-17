import prisma from '@/lib/prisma';
import { hashPassword } from '@/utils/auth';
import { logger } from '@/utils/logger';

async function main() {
  logger.info('🌱 Starting database seed...');

  try {
    // Create specialties
    const specialties = await createSpecialties();
    logger.info(`✅ Created ${specialties.length} specialties`);

    // Create units
    const units = await createUnits();
    logger.info(`✅ Created ${units.length} units`);

    // Link specialties to units
    await linkSpecialtiesToUnits(units, specialties);
    logger.info('✅ Linked specialties to units');

    // Create working hours for units
    await createWorkingHours(units);
    logger.info('✅ Created working hours for units');

    // Create doctors
    const doctors = await createDoctors(units, specialties);
    logger.info(`✅ Created ${doctors.length} doctors`);

    // Create doctor availability
    await createDoctorAvailability(doctors);
    logger.info('✅ Created doctor availability slots');

    // Create sample users
    const users = await createSampleUsers();
    logger.info(`✅ Created ${users.length} sample users`);

    // Create sample dependents
    const dependents = await createSampleDependents(users);
    logger.info(`✅ Created ${dependents.length} sample dependents`);

    // Create sample appointments
    const appointments = await createSampleAppointments(users, dependents, units, doctors, specialties);
    logger.info(`✅ Created ${appointments.length} sample appointments`);

    // Create sample notifications
    const notifications = await createSampleNotifications(users);
    logger.info(`✅ Created ${notifications.length} sample notifications`);

    logger.info('🎉 Database seed completed successfully!');
  } catch (error) {
    logger.error('❌ Error seeding database:', error);
    throw error;
  }
}

async function createSpecialties() {
  const specialtyData = [
    { name: 'Cardiologia', description: 'Especialidade médica que cuida do coração e sistema cardiovascular', icon: 'heart' },
    { name: 'Dermatologia', description: 'Especialidade médica que trata da pele, cabelos e unhas', icon: 'user' },
    { name: 'Neurologia', description: 'Especialidade médica que trata do sistema nervoso', icon: 'brain' },
    { name: 'Pediatria', description: 'Especialidade médica dedicada ao cuidado de crianças e adolescentes', icon: 'baby' },
    { name: 'Ginecologia', description: 'Especialidade médica que cuida da saúde da mulher', icon: 'user-check' },
    { name: 'Ortopedia', description: 'Especialidade médica que trata de ossos, músculos e articulações', icon: 'activity' },
    { name: 'Oftalmologia', description: 'Especialidade médica que cuida dos olhos e visão', icon: 'eye' },
    { name: 'Otorrinolaringologia', description: 'Especialidade médica que trata de ouvido, nariz e garganta', icon: 'headphones' },
    { name: 'Psiquiatria', description: 'Especialidade médica que trata de transtornos mentais', icon: 'brain' },
    { name: 'Clínica Geral', description: 'Atendimento médico geral e preventivo', icon: 'stethoscope' },
    { name: 'Endocrinologia', description: 'Especialidade médica que trata de distúrbios hormonais', icon: 'zap' },
    { name: 'Gastroenterologia', description: 'Especialidade médica que trata do sistema digestivo', icon: 'zap' },
    { name: 'Pneumologia', description: 'Especialidade médica que trata de doenças pulmonares', icon: 'wind' },
    { name: 'Urologia', description: 'Especialidade médica que trata do sistema urinário', icon: 'droplet' },
    { name: 'Reumatologia', description: 'Especialidade médica que trata de doenças reumáticas', icon: 'bone' },
    { name: 'Oncologia', description: 'Especialidade médica que trata do câncer', icon: 'shield' },
    { name: 'Psicologia', description: 'Atendimento psicológico e terapêutico', icon: 'heart' },
    { name: 'Nutrição', description: 'Orientação nutricional e dietética', icon: 'apple' },
    { name: 'Fisioterapia', description: 'Reabilitação física e funcional', icon: 'activity' },
    { name: 'Fonoaudiologia', description: 'Tratamento de distúrbios da comunicação', icon: 'mic' },
  ];

  const specialties = [];
  for (const data of specialtyData) {
    const specialty = await prisma.specialty.upsert({
      where: { name: data.name },
      update: {},
      create: data,
    });
    specialties.push(specialty);
  }

  return specialties;
}

async function createUnits() {
  const unitData = [
    {
      name: 'Hospital CTC - Unidade Paulista',
      address: 'Av. Paulista, 1000 - Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310100',
      phone: '1133334444',
      email: 'paulista@hospitalctc.com.br',
      latitude: -23.5618,
      longitude: -46.6565,
    },
    {
      name: 'Clínica CTC Vila Madalena',
      address: 'Rua Harmonia, 500 - Vila Madalena',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '05435000',
      phone: '1133335555',
      email: 'vilamadalena@clinicactc.com.br',
      latitude: -23.5494,
      longitude: -46.6881,
    },
    {
      name: 'Centro Médico CTC Morumbi',
      address: 'Av. Roque Petroni Jr, 1089 - Morumbi',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04707000',
      phone: '1133339999',
      email: 'morumbi@centromedicoctc.com.br',
      latitude: -23.6204,
      longitude: -46.7010,
    },
    {
      name: 'Hospital CTC Ipanema',
      address: 'Rua Visconde de Pirajá, 200 - Ipanema',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22410000',
      phone: '2133336666',
      email: 'ipanema@hospitalctc.com.br',
      latitude: -22.9844,
      longitude: -43.2009,
    },
    {
      name: 'Clínica CTC Copacabana',
      address: 'Av. Nossa Senhora de Copacabana, 1200 - Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22070000',
      phone: '2133337788',
      email: 'copacabana@clinicactc.com.br',
      latitude: -22.9711,
      longitude: -43.1822,
    },
    {
      name: 'Centro Médico CTC Savassi',
      address: 'Av. do Contorno, 300 - Savassi',
      city: 'Belo Horizonte',
      state: 'MG',
      zipCode: '30110000',
      phone: '3133337777',
      email: 'savassi@centromedicoctc.com.br',
      latitude: -19.9407,
      longitude: -43.9353,
    },
    {
      name: 'Hospital CTC Pampulha',
      address: 'Av. Portugal, 1148 - Itapoã',
      city: 'Belo Horizonte',
      state: 'MG',
      zipCode: '31710000',
      phone: '3133338899',
      email: 'pampulha@hospitalctc.com.br',
      latitude: -19.8527,
      longitude: -43.9647,
    },
    {
      name: 'Clínica CTC Moinhos de Vento',
      address: 'Rua Ramiro Barcelos, 910 - Moinhos de Vento',
      city: 'Porto Alegre',
      state: 'RS',
      zipCode: '90035000',
      phone: '5133338888',
      email: 'moinhos@clinicactc.com.br',
      latitude: -30.0346,
      longitude: -51.2177,
    },
    {
      name: 'Centro Médico CTC Boa Vista',
      address: 'Av. Borges de Medeiros, 1501 - Centro Histórico',
      city: 'Porto Alegre',
      state: 'RS',
      zipCode: '90020000',
      phone: '5133339900',
      email: 'boavista@centromedicoctc.com.br',
      latitude: -30.0277,
      longitude: -51.2287,
    },
    {
      name: 'Hospital CTC Asa Sul',
      address: 'SHS Quadra 6 Conjunto A Bloco E - Asa Sul',
      city: 'Brasília',
      state: 'DF',
      zipCode: '70316000',
      phone: '6133331122',
      email: 'asasul@hospitalctc.com.br',
      latitude: -15.7942,
      longitude: -47.8822,
    },
  ];

  const units = [];
  for (const data of unitData) {
    const unit = await prisma.unit.upsert({
      where: { name: data.name },
      update: {},
      create: data,
    });
    units.push(unit);
  }

  return units;
}

async function linkSpecialtiesToUnits(units: any[], specialties: any[]) {
  for (const unit of units) {
    // Each unit will have 6-8 random specialties
    const shuffledSpecialties = specialties.sort(() => 0.5 - Math.random());
    const unitSpecialties = shuffledSpecialties.slice(0, Math.floor(Math.random() * 3) + 6);

    for (const specialty of unitSpecialties) {
      await prisma.unitSpecialty.upsert({
        where: {
          unitId_specialtyId: {
            unitId: unit.id,
            specialtyId: specialty.id,
          }
        },
        update: {},
        create: {
          unitId: unit.id,
          specialtyId: specialty.id,
        },
      });
    }
  }
}

async function createWorkingHours(units: any[]) {
  const standardHours = [
    { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' }, // Monday
    { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00' }, // Tuesday
    { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00' }, // Wednesday
    { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00' }, // Thursday
    { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00' }, // Friday
    { dayOfWeek: 6, openTime: '08:00', closeTime: '12:00' }, // Saturday
    { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isClosed: true }, // Sunday
  ];

  for (const unit of units) {
    for (const hours of standardHours) {
      await prisma.workingHours.upsert({
        where: {
          unitId_dayOfWeek: {
            unitId: unit.id,
            dayOfWeek: hours.dayOfWeek,
          }
        },
        update: {},
        create: {
          unitId: unit.id,
          ...hours,
        },
      });
    }
  }
}

async function createDoctors(units: any[], specialties: any[]) {
  const doctorData = [
    { name: 'Dr. João Carlos Silva', titles: 'MD, PhD em Cardiologia' },
    { name: 'Dra. Maria Fernanda Santos', titles: 'MD, MSc em Dermatologia' },
    { name: 'Dr. Pedro Henrique Oliveira', titles: 'MD, PhD em Neurologia' },
    { name: 'Dra. Ana Paula Costa', titles: 'MD, MSc em Pediatria' },
    { name: 'Dr. Carlos Eduardo Ferreira', titles: 'MD, PhD em Ortopedia' },
    { name: 'Dra. Lúcia Helena Almeida', titles: 'MD, MSc em Ginecologia' },
    { name: 'Dr. Rafael Augusto Pereira', titles: 'MD, PhD em Oftalmologia' },
    { name: 'Dra. Paula Cristina Lima', titles: 'MD, MSc em Otorrino' },
    { name: 'Dr. Gabriel Fernando Rocha', titles: 'MD, PhD em Psiquiatria' },
    { name: 'Dra. Fernanda Beatriz Dias', titles: 'MD, MSc em Clínica Geral' },
    { name: 'Dr. Bruno Alexandre Martins', titles: 'MD, PhD em Endocrinologia' },
    { name: 'Dra. Carla Patrícia Souza', titles: 'MD, MSc em Gastroenterologia' },
    { name: 'Dr. André Luís Torres', titles: 'MD, PhD em Pneumologia' },
    { name: 'Dra. Juliana Rodrigues Moura', titles: 'MD, MSc em Urologia' },
    { name: 'Dr. Ricardo José Gomes', titles: 'MD, PhD em Reumatologia' },
    { name: 'Dra. Beatriz Carolina Castro', titles: 'MD, MSc em Oncologia' },
    { name: 'Dr. Felipe Henrique Araújo', titles: 'Psicólogo Clínico, PhD' },
    { name: 'Dra. Camila Vitória Ribeiro', titles: 'Nutricionista, MSc' },
    { name: 'Dr. Thiago Augusto Barros', titles: 'Fisioterapeuta, PhD' },
    { name: 'Dra. Amanda Silva Freitas', titles: 'Fonoaudióloga, MSc' },
    { name: 'Dr. Rodrigo Mendes Cardoso', titles: 'MD, PhD em Cardiologia' },
    { name: 'Dra. Isabela Machado Reis', titles: 'MD, MSc em Dermatologia' },
    { name: 'Dr. Lucas Gabriel Santos', titles: 'MD, PhD em Neurologia' },
    { name: 'Dra. Letícia Aparecida Costa', titles: 'MD, MSc em Pediatria' },
    { name: 'Dr. Marcelo Silva Oliveira', titles: 'MD, PhD em Ortopedia' },
    { name: 'Dra. Renata Cristiane Lima', titles: 'MD, MSc em Ginecologia' },
    { name: 'Dr. Daniel Augusto Ferreira', titles: 'MD, PhD em Oftalmologia' },
    { name: 'Dra. Vanessa Rodrigues Alves', titles: 'MD, MSc em Otorrino' },
    { name: 'Dr. Gustavo Henrique Moura', titles: 'MD, PhD em Psiquiatria' },
    { name: 'Dra. Roberta Fernandes Silva', titles: 'MD, MSc em Clínica Geral' },
  ];

  const doctors = [];
  let crmCounter = 123456;

  for (const unit of units) {
    // Each unit will have 6-8 doctors
    const numDoctors = Math.floor(Math.random() * 3) + 6;
    const shuffledDoctors = doctorData.sort(() => 0.5 - Math.random());
    const unitDoctors = shuffledDoctors.slice(0, numDoctors);
    
    for (const doctorInfo of unitDoctors) {
      const randomSpecialty = specialties[Math.floor(Math.random() * specialties.length)];
      const crm = `${crmCounter}/${unit.state}`;
      crmCounter++;

      const yearsExperience = Math.floor(Math.random() * 20) + 5; // 5-25 anos
      const bio = `${doctorInfo.titles}. Especialista em ${randomSpecialty.name} com ${yearsExperience} anos de experiência. Formação médica sólida com foco em atendimento humanizado e tecnologias modernas. Membro de sociedades médicas especializadas.`;

      try {
        const doctor = await prisma.doctor.create({
          data: {
            unitId: unit.id,
            specialtyId: randomSpecialty.id,
            name: doctorInfo.name,
            crm,
            bio,
          },
        });
        doctors.push(doctor);
      } catch (error) {
        // Skip duplicates
        logger.warn(`Doctor ${doctorInfo.name} already exists, skipping...`);
      }
    }
  }

  return doctors;
}

async function createDoctorAvailability(doctors: any[]) {
  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  ];

  const today = new Date();
  
  for (const doctor of doctors) {
    // Create availability for next 30 days
    for (let day = 1; day <= 30; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() + day);
      
      // Skip Sundays
      if (date.getDay() === 0) continue;
      
      // Saturday has limited hours
      const availableSlots = date.getDay() === 6 
        ? timeSlots.filter(slot => slot < '12:00')
        : timeSlots;
      
      for (const timeSlot of availableSlots) {
        await prisma.doctorAvailability.create({
          data: {
            doctorId: doctor.id,
            date,
            timeSlot,
            isBooked: Math.random() < 0.3, // 30% chance of being booked
          },
        });
      }
    }
  }
}

async function createSampleUsers() {
  const userData = [
    {
      name: 'João Silva',
      cpf: '12345678901',
      phone: '11999999999',
      email: 'joao.silva@email.com',
      password: await hashPassword('123456'),
      cardNumber: '1234 5678 9012 3456',
    },
    {
      name: 'Maria Santos',
      cpf: '98765432100',
      phone: '11888888888',
      email: 'maria.santos@email.com',
      password: await hashPassword('123456'),
      cardNumber: '9876 5432 1098 7654',
    },
    {
      name: 'Carlos Oliveira',
      cpf: '11122233344',
      phone: '11777777777',
      email: 'carlos.oliveira@email.com',
      password: await hashPassword('123456'),
      cardNumber: '1111 2222 3333 4444',
    },
  ];

  const users = [];
  for (const data of userData) {
    const user = await prisma.user.upsert({
      where: { cpf: data.cpf },
      update: {},
      create: data,
    });
    users.push(user);
  }

  return users;
}

async function createSampleDependents(users: any[]) {
  const dependents = [];
  
  // User 1 dependents
  const dependent1 = await prisma.dependent.create({
    data: {
      userId: users[0].id,
      name: 'Ana Silva',
      cpf: '55566677788',
      relationship: 'spouse',
      birthDate: new Date('1985-06-15'),
      cardNumber: '5555 6666 7777 8888',
    },
  });
  dependents.push(dependent1);

  const dependent2 = await prisma.dependent.create({
    data: {
      userId: users[0].id,
      name: 'Pedro Silva',
      cpf: '99988877766',
      relationship: 'child',
      birthDate: new Date('2010-03-20'),
      cardNumber: '9999 8888 7777 6666',
    },
  });
  dependents.push(dependent2);

  // User 2 dependent
  const dependent3 = await prisma.dependent.create({
    data: {
      userId: users[1].id,
      name: 'José Santos',
      cpf: '44455566677',
      relationship: 'child',
      birthDate: new Date('2015-09-10'),
      cardNumber: '4444 5555 6666 7777',
    },
  });
  dependents.push(dependent3);

  return dependents;
}

async function createSampleAppointments(users: any[], dependents: any[], units: any[], doctors: any[], specialties: any[]) {
  const appointments = [];
  
  // Create some past appointments
  const pastDate1 = new Date();
  pastDate1.setDate(pastDate1.getDate() - 10);
  
  const appointment1 = await prisma.appointment.create({
    data: {
      userId: users[0].id,
      unitId: units[0].id,
      specialtyId: specialties[0].id,
      doctorId: doctors[0].id,
      date: pastDate1,
      time: '09:00',
      status: 'COMPLETED',
      notes: 'Consulta de rotina - tudo normal',
    },
  });
  appointments.push(appointment1);

  // Create future appointments
  const futureDate1 = new Date();
  futureDate1.setDate(futureDate1.getDate() + 7);
  
  const appointment2 = await prisma.appointment.create({
    data: {
      userId: users[0].id,
      dependentId: dependents[0].id,
      unitId: units[1].id,
      specialtyId: specialties[1].id,
      doctorId: doctors[1].id,
      date: futureDate1,
      time: '14:30',
      status: 'SCHEDULED',
      notes: 'Consulta para dependente',
    },
  });
  appointments.push(appointment2);

  const futureDate2 = new Date();
  futureDate2.setDate(futureDate2.getDate() + 14);
  
  const appointment3 = await prisma.appointment.create({
    data: {
      userId: users[1].id,
      unitId: units[0].id,
      specialtyId: specialties[2].id,
      doctorId: doctors[2].id,
      date: futureDate2,
      time: '10:00',
      status: 'SCHEDULED',
    },
  });
  appointments.push(appointment3);

  return appointments;
}

async function createSampleNotifications(users: any[]) {
  const notifications = [];
  
  for (const user of users) {
    // Welcome notification
    const notification1 = await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Bem-vindo ao App Telas Mágicas!',
        message: 'Sua conta foi criada com sucesso. Explore todas as funcionalidades do app.',
        type: 'SYSTEM',
        data: { type: 'welcome' },
      },
    });
    notifications.push(notification1);

    // Appointment reminder
    const notification2 = await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Lembrete de Consulta',
        message: 'Você tem uma consulta agendada para amanhã às 14:30.',
        type: 'REMINDER',
        data: { type: 'appointment_reminder' },
      },
    });
    notifications.push(notification2);
  }

  return notifications;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });