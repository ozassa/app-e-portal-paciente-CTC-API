# CTC Backend API

Backend API para o Portal do Paciente CTC (mobile e web).

## Stack

- Node.js 20+
- TypeScript
- Express
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Twilio (SMS/WhatsApp)

## Setup

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente:**
   ```bash
   cp .env.example .env
   # Editar .env com suas credenciais
   ```

3. **Configurar banco de dados:**
   ```bash
   # Gerar Prisma Client
   npm run prisma:generate

   # Executar migrations
   npm run prisma:migrate

   # (Opcional) Seed com dados de teste
   npm run prisma:seed
   ```

4. **Rodar servidor:**
   ```bash
   # Development (hot reload)
   npm run dev

   # Production
   npm run build
   npm start
   ```

## Endpoints

### Autenticação

- `POST /api/auth/login` - Login (CPF + senha)
- `POST /api/auth/verify-2fa` - Verificar 2FA (OTP)
- `POST /api/auth/refresh` - Renovar access token
- `POST /api/auth/logout` - Logout
- `POST /api/auth/resend-otp` - Reenviar código OTP
- `POST /api/auth/forgot-password` - Esqueci minha senha
- `POST /api/auth/reset-password` - Resetar senha

### Usuário (requer autenticação)

- `GET /api/users/me` - Dados do usuário logado
- `PUT /api/users/me` - Atualizar perfil
- `GET /api/users/dependents` - Listar dependentes

### Agendamentos (requer autenticação)

- `GET /api/appointments` - Listar consultas/exames
- `GET /api/appointments/:id` - Detalhes de agendamento

### Unidades (requer autenticação)

- `GET /api/units` - Listar unidades
- `GET /api/units/:id` - Detalhes de unidade

### Dashboard (requer autenticação)

- `GET /api/dashboard/card` - Dados da carteirinha

## Desenvolvimento

```bash
# Rodar em modo dev
npm run dev

# Prisma Studio (visualizar banco)
npm run prisma:studio

# Linting
npm run lint

# Format
npm run format
```

## Deploy

Ver `BACKEND_SETUP_GUIDE.md` para instruções completas.

## License

UNLICENSED
