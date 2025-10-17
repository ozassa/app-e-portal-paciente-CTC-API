# 🏥 App Telas Mágicas - Backend API

Backend API para o aplicativo móvel de gestão de saúde e bem-estar.

## 🚀 Funcionalidades

- **Autenticação Segura**: JWT + 2FA via SMS
- **Gerenciamento de Usuários**: Perfis e dependentes
- **Agendamento de Consultas**: Sistema completo com disponibilidade
- **Unidades de Saúde**: Localização e busca por proximidade
- **Notificações**: SMS e email automáticos
- **API RESTful**: Seguindo especificação OpenAPI 3.0

## 🛠️ Stack Tecnológica

- **Runtime**: Node.js 18+
- **Framework**: Express.js + TypeScript
- **Banco de Dados**: PostgreSQL com Prisma ORM
- **Autenticação**: JWT + 2FA (Twilio SMS)
- **Email**: Nodemailer com SMTP
- **Upload**: Cloudinary (configurado)
- **Logs**: Winston
- **Validação**: Joi
- **Segurança**: Helmet, CORS, Rate Limiting

## 📋 Pré-requisitos

- Node.js 18 ou superior
- PostgreSQL 12 ou superior
- Conta Twilio (para SMS)
- Conta de email SMTP
- Conta Cloudinary (opcional)

## ⚙️ Configuração

### 1. Instalação

```bash
# Clone o repositório
git clone https://github.com/arthurozassa/app-telas-magicas-ctc.git
cd app-telas-magicas-ctc/backend

# Instale as dependências
npm install
```

### 2. Variáveis de Ambiente

Copie o arquivo de exemplo e configure:

```bash
cp .env.example .env
```

Configure as seguintes variáveis em `.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/telasmágicas"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"

# Twilio (2FA SMS)
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token" 
TWILIO_PHONE_NUMBER="+1234567890"

# Email SMTP
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Cloudinary (Upload de arquivos)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Security
SESSION_SECRET="your-session-secret"
```

### 3. Banco de Dados

```bash
# Gerar cliente Prisma
npm run db:generate

# Aplicar migrações
npm run db:push

# Popular com dados iniciais (opcional)
npm run db:seed
```

## 🚀 Execução

### Desenvolvimento

```bash
# Servidor com hot reload
npm run dev

# Logs em tempo real
tail -f logs/combined.log
```

### Produção

```bash
# Build
npm run build

# Iniciar servidor
npm start
```

### Scripts Disponíveis

```bash
npm run dev           # Servidor desenvolvimento
npm run build         # Build TypeScript
npm start            # Servidor produção
npm run lint         # Linter ESLint
npm run test         # Testes Jest
npm run db:generate  # Gerar cliente Prisma
npm run db:push      # Aplicar schema ao banco
npm run db:migrate   # Criar migração
npm run db:seed      # Popular banco com dados
npm run db:studio    # Interface visual Prisma
```

## 📚 Documentação da API

### Swagger/OpenAPI

- **Desenvolvimento**: http://localhost:3000/docs
- **Arquivo YAML**: `../docs/api-swagger.yaml`
- **Interface HTML**: `../docs/api-docs.html`

### Endpoints Principais

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/v1/auth/login` | POST | Login com CPF/senha |
| `/api/v1/auth/verify-2fa` | POST | Verificação 2FA |
| `/api/v1/user/profile` | GET | Perfil do usuário |
| `/api/v1/appointments` | GET/POST | Consultas |
| `/api/v1/units` | GET | Unidades de saúde |
| `/api/v1/specialties` | GET | Especialidades médicas |
| `/api/v1/notifications` | GET | Notificações |

### Autenticação

```javascript
// Headers obrigatórios para endpoints protegidos
{
  "Authorization": "Bearer <jwt-token>",
  "Content-Type": "application/json"
}
```

## 🗄️ Estrutura do Banco

### Modelos Principais

- **User**: Usuários principais
- **Dependent**: Dependentes dos usuários
- **Unit**: Unidades de saúde
- **Doctor**: Médicos das unidades
- **Specialty**: Especialidades médicas
- **Appointment**: Consultas agendadas
- **Notification**: Notificações do sistema
- **AuthSession**: Sessões de autenticação

### Relacionamentos

```
User 1---* Dependent
User 1---* Appointment
User 1---* Notification

Unit 1---* Doctor
Unit *---* Specialty (UnitSpecialty)
Unit 1---* Appointment

Doctor 1---* Appointment
Doctor *---1 Specialty
Doctor 1---* DoctorAvailability
```

## 🔒 Segurança

### Autenticação

- **JWT**: Tokens com expiração de 1 hora
- **Refresh Token**: Válido por 7 dias
- **2FA**: Código de 6 dígitos via SMS
- **Rate Limiting**: Por IP e por usuário

### Validação

- **Joi**: Validação de entrada rigorosa
- **CPF**: Algoritmo de validação oficial
- **Sanitização**: Limpeza de inputs maliciosos

### Headers de Segurança

- **Helmet**: Headers de segurança automáticos
- **CORS**: Configuração restritiva
- **HTTPS**: Obrigatório em produção

## 📱 Integrações

### Twilio (SMS)

- **2FA**: Códigos de verificação
- **Confirmações**: Consultas agendadas
- **Lembretes**: Notificações importantes

### Email (SMTP)

- **Boas-vindas**: Novos usuários
- **Confirmações**: Consultas e alterações
- **Relatórios**: Resumos de atividade

### Cloudinary (Arquivos)

- **Avatars**: Fotos de perfil
- **Documentos**: Anexos médicos
- **Otimização**: Redimensionamento automático

## 📊 Monitoramento

### Logs

```bash
# Logs em tempo real
tail -f logs/combined.log

# Apenas erros
tail -f logs/error.log

# Logs estruturados com timestamp
```

### Health Check

```bash
# Verificar status da API
curl http://localhost:3000/health

# Resposta esperada
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "development"
}
```

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Testes com watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Dados de Teste

O script `db:seed` cria:

- **3 usuários** com senhas `123456`
- **5 unidades** em diferentes cidades
- **10 especialidades** médicas
- **20+ médicos** distribuídos
- **Consultas** passadas e futuras
- **Notificações** de exemplo

#### Usuários de Teste

| CPF | Senha | Email |
|-----|-------|--------|
| 12345678901 | 123456 | joao.silva@email.com |
| 98765432100 | 123456 | maria.santos@email.com |
| 11122233344 | 123456 | carlos.oliveira@email.com |

## 🚀 Deploy

### Railway

```bash
# Instalar CLI
npm install -g @railway/cli

# Login e deploy
railway login
railway link
railway up
```

### Render

```bash
# Build command
npm run build

# Start command  
npm start
```

### Variáveis de Produção

```env
NODE_ENV=production
DATABASE_URL=<postgresql-url-produção>
JWT_SECRET=<chave-forte-produção>
# ... outras variáveis
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Pull Request

## 📝 License

Este projeto está sob a licença MIT. Veja [LICENSE](../LICENSE) para detalhes.

## 📞 Suporte

- **Email**: suporte@ctctech.com
- **GitHub Issues**: [Reportar problema](https://github.com/arthurozassa/app-telas-magicas-ctc/issues)
- **Documentação**: [docs/API_README.md](../docs/API_README.md)

---

**Versão**: 1.0.0  
**Última Atualização**: Dezembro 2024  
**Desenvolvido por**: [CTC Tech](https://ctctech.com)