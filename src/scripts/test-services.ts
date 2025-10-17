#!/usr/bin/env tsx
import { smsService } from '../services/sms';
import { emailService } from '../services/email';
import { whatsappService } from '../services/whatsapp';
import { notificationService } from '../services/notification';
import { logger } from '../utils/logger';

interface ServiceTestResult {
  service: string;
  configured: boolean;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

const testServices = async (): Promise<void> => {
  const results: ServiceTestResult[] = [];
  
  console.log('🧪 Testando serviços externos...\n');

  // Test SMS Service
  console.log('📱 Testando serviço SMS (Twilio)...');
  try {
    const smsStatus = smsService.getServiceStatus();
    results.push({
      service: 'SMS (Twilio)',
      configured: smsStatus.configured,
      status: smsStatus.configured ? 'success' : 'warning',
      message: smsStatus.configured ? 'Configurado e pronto' : 'Não configurado - variáveis de ambiente ausentes',
      details: smsStatus
    });
  } catch (error: any) {
    results.push({
      service: 'SMS (Twilio)',
      configured: false,
      status: 'error',
      message: `Erro: ${error.message}`,
    });
  }

  // Test Email Service
  console.log('📧 Testando serviço Email (SMTP)...');
  try {
    const emailStatus = emailService.getServiceStatus();
    results.push({
      service: 'Email (SMTP)',
      configured: emailStatus.configured,
      status: emailStatus.configured ? 'success' : 'warning',
      message: emailStatus.configured ? 'Configurado e pronto' : 'Não configurado - variáveis de ambiente ausentes',
      details: emailStatus
    });
  } catch (error: any) {
    results.push({
      service: 'Email (SMTP)',
      configured: false,
      status: 'error',
      message: `Erro: ${error.message}`,
    });
  }

  // Test WhatsApp Service
  console.log('💬 Testando serviço WhatsApp Business API...');
  try {
    const whatsappStatus = whatsappService.getServiceStatus();
    results.push({
      service: 'WhatsApp Business API',
      configured: whatsappStatus.configured,
      status: whatsappStatus.configured ? 'success' : 'warning',
      message: whatsappStatus.configured ? 'Configurado e pronto' : 'Não configurado - variáveis de ambiente ausentes',
      details: whatsappStatus
    });
  } catch (error: any) {
    results.push({
      service: 'WhatsApp Business API',
      configured: false,
      status: 'error',
      message: `Erro: ${error.message}`,
    });
  }

  // Test Notification Service
  console.log('🔔 Testando serviço de Notificação Integrado...');
  try {
    const notificationStatus = notificationService.getServiceStatus();
    const availableChannels = [];
    
    if (notificationStatus.sms.configured) availableChannels.push('SMS');
    if (notificationStatus.email.configured) availableChannels.push('Email');
    if (notificationStatus.whatsapp.configured) availableChannels.push('WhatsApp');

    results.push({
      service: 'Notification Service',
      configured: availableChannels.length > 0,
      status: availableChannels.length > 0 ? 'success' : 'warning',
      message: availableChannels.length > 0 
        ? `Canais disponíveis: ${availableChannels.join(', ')}` 
        : 'Nenhum canal de notificação configurado',
      details: {
        availableChannels,
        supportedTypes: notificationStatus.supportedTypes
      }
    });
  } catch (error: any) {
    results.push({
      service: 'Notification Service',
      configured: false,
      status: 'error',
      message: `Erro: ${error.message}`,
    });
  }

  // Print results
  console.log('\n📊 Resultados dos testes:\n');
  
  results.forEach(result => {
    const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    const status = result.status.toUpperCase();
    
    console.log(`${icon} ${result.service} - ${status}`);
    console.log(`   ${result.message}`);
    
    if (result.details && result.status === 'success') {
      if (result.details.accountSid) {
        console.log(`   Account: ***${result.details.accountSid.slice(-4)}`);
      }
      if (result.details.phoneNumber) {
        console.log(`   Phone: ${result.details.phoneNumber}`);
      }
      if (result.details.host) {
        console.log(`   Host: ${result.details.host}:${result.details.port}`);
      }
      if (result.details.phoneNumberId) {
        console.log(`   Phone Number ID: ***${result.details.phoneNumberId.slice(-4)}`);
      }
      if (result.details.availableChannels) {
        console.log(`   Channels: ${result.details.availableChannels.join(', ')}`);
      }
    }
    console.log('');
  });

  // Summary
  const configured = results.filter(r => r.configured).length;
  const total = results.length;
  const hasErrors = results.some(r => r.status === 'error');

  console.log('📋 Resumo:');
  console.log(`   Serviços configurados: ${configured}/${total}`);
  console.log(`   Status geral: ${hasErrors ? '❌ Erros detectados' : configured === total ? '✅ Todos configurados' : '⚠️ Configuração parcial'}`);

  if (configured === 0) {
    console.log('\n⚠️  ATENÇÃO: Nenhum serviço está configurado!');
    console.log('   Configure pelo menos um serviço para envio de notificações.');
    console.log('   Consulte SERVICES_SETUP.md para instruções.');
  } else if (configured < total) {
    console.log('\n💡 DICA: Configure mais serviços para redundância e melhor experiência do usuário.');
  }

  console.log('\n🔧 Para configurar os serviços, edite o arquivo backend/.env');
  console.log('📖 Consulte SERVICES_SETUP.md para instruções detalhadas.');
};

// Run tests
testServices().catch(error => {
  logger.error('Service test failed:', error);
  process.exit(1);
});