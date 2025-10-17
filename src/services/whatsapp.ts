import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  phone: string;
}

export interface BulkWhatsAppResult {
  total: number;
  successful: number;
  failed: number;
  results: WhatsAppResult[];
}

// WhatsApp message templates
const WHATSAPP_TEMPLATES = {
  appointment_confirmation: {
    name: 'appointment_confirmation',
    language: { code: 'pt_BR' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{patient_name}}' },
          { type: 'text', text: '{{appointment_date}}' },
          { type: 'text', text: '{{appointment_time}}' },
          { type: 'text', text: '{{doctor_name}}' },
          { type: 'text', text: '{{unit_name}}' }
        ]
      }
    ]
  },
  appointment_reminder: {
    name: 'appointment_reminder',
    language: { code: 'pt_BR' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{patient_name}}' },
          { type: 'text', text: '{{appointment_date}}' },
          { type: 'text', text: '{{appointment_time}}' },
          { type: 'text', text: '{{doctor_name}}' }
        ]
      }
    ]
  },
  two_factor_auth: {
    name: 'two_factor_auth',
    language: { code: 'pt_BR' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{verification_code}}' },
          { type: 'text', text: '{{expires_in}}' }
        ]
      }
    ]
  },
  password_reset: {
    name: 'password_reset',
    language: { code: 'pt_BR' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{reset_code}}' },
          { type: 'text', text: '{{expires_in}}' }
        ]
      }
    ]
  },
  appointment_cancelled: {
    name: 'appointment_cancelled',
    language: { code: 'pt_BR' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{patient_name}}' },
          { type: 'text', text: '{{appointment_date}}' },
          { type: 'text', text: '{{appointment_time}}' },
          { type: 'text', text: '{{doctor_name}}' }
        ]
      }
    ]
  },
  welcome_message: {
    name: 'welcome_message',
    language: { code: 'pt_BR' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{patient_name}}' },
          { type: 'text', text: '{{card_number}}' }
        ]
      }
    ]
  }
} as const;

class WhatsAppService {
  private baseURL: string;
  private accessToken: string;
  private phoneNumberId: string;
  private isConfigured: boolean = false;

  constructor() {
    this.baseURL = 'https://graph.facebook.com/v18.0';
    this.accessToken = env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID || '';
    
    this.isConfigured = !!(this.accessToken && this.phoneNumberId);
    
    if (!this.isConfigured) {
      logger.warn('WhatsApp service not configured - missing access token or phone number ID');
    } else {
      logger.info('WhatsApp service initialized successfully');
    }
  }

  /**
   * Send a simple text message via WhatsApp
   */
  async sendTextMessage(phone: string, message: string): Promise<WhatsAppResult> {
    if (!this.isConfigured) {
      logger.warn('WhatsApp service not configured, skipping message');
      return {
        success: false,
        error: 'WhatsApp service not configured',
        phone
      };
    }

    const cleanPhone = this.formatPhoneNumber(phone);
    
    try {
      const payload: WhatsAppMessage = {
        to: cleanPhone,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`WhatsApp message sent successfully to ${cleanPhone}`);
      
      return {
        success: true,
        messageId: response.data.messages[0].id,
        phone: cleanPhone
      };

    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error.message || 'Unknown error';
      logger.error('WhatsApp message failed:', {
        phone: cleanPhone,
        error: errorMessage,
        status: error?.response?.status
      });

      return {
        success: false,
        error: errorMessage,
        phone: cleanPhone
      };
    }
  }

  /**
   * Send a templated message via WhatsApp
   */
  async sendTemplatedMessage(
    phone: string, 
    templateId: keyof typeof WHATSAPP_TEMPLATES, 
    variables: Record<string, string>
  ): Promise<WhatsAppResult> {
    if (!this.isConfigured) {
      logger.warn('WhatsApp service not configured, skipping templated message');
      return {
        success: false,
        error: 'WhatsApp service not configured',
        phone
      };
    }

    const template = WHATSAPP_TEMPLATES[templateId];
    if (!template) {
      logger.error(`WhatsApp template not found: ${templateId}`);
      return {
        success: false,
        error: `Template not found: ${templateId}`,
        phone
      };
    }

    const cleanPhone = this.formatPhoneNumber(phone);

    try {
      // Replace variables in template parameters
      const processedTemplate = {
        ...template,
        components: template.components?.map(component => ({
          ...component,
          parameters: component.parameters.map(param => ({
            ...param,
            text: this.replaceVariables(param.text, variables)
          }))
        }))
      };

      const payload: WhatsAppMessage = {
        to: cleanPhone,
        type: 'template',
        template: processedTemplate
      };

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`WhatsApp template message sent successfully to ${cleanPhone}`, {
        template: templateId,
        variables
      });
      
      return {
        success: true,
        messageId: response.data.messages[0].id,
        phone: cleanPhone
      };

    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error.message || 'Unknown error';
      logger.error('WhatsApp template message failed:', {
        phone: cleanPhone,
        template: templateId,
        error: errorMessage,
        status: error?.response?.status
      });

      return {
        success: false,
        error: errorMessage,
        phone: cleanPhone
      };
    }
  }

  /**
   * Send bulk WhatsApp messages
   */
  async sendBulkMessages(messages: Array<{
    phone: string;
    message: string;
  }>): Promise<BulkWhatsAppResult> {
    const results: WhatsAppResult[] = [];
    
    for (const msg of messages) {
      const result = await this.sendTextMessage(msg.phone, msg.message);
      results.push(result);
      
      // Add delay between messages to respect rate limits
      await this.delay(1000);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info(`Bulk WhatsApp messages completed: ${successful} successful, ${failed} failed`);

    return {
      total: results.length,
      successful,
      failed,
      results
    };
  }

  /**
   * Send bulk templated messages
   */
  async sendBulkTemplatedMessages(messages: Array<{
    phone: string;
    templateId: keyof typeof WHATSAPP_TEMPLATES;
    variables: Record<string, string>;
  }>): Promise<BulkWhatsAppResult> {
    const results: WhatsAppResult[] = [];
    
    for (const msg of messages) {
      const result = await this.sendTemplatedMessage(msg.phone, msg.templateId, msg.variables);
      results.push(result);
      
      // Add delay between messages to respect rate limits
      await this.delay(1000);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info(`Bulk WhatsApp template messages completed: ${successful} successful, ${failed} failed`);

    return {
      total: results.length,
      successful,
      failed,
      results
    };
  }

  /**
   * Get service status and configuration
   */
  getServiceStatus() {
    return {
      configured: this.isConfigured,
      phoneNumberId: this.phoneNumberId ? `***${this.phoneNumberId.slice(-4)}` : null,
      hasAccessToken: !!this.accessToken,
      availableTemplates: Object.keys(WHATSAPP_TEMPLATES),
      service: 'WhatsApp Business API'
    };
  }

  /**
   * Verify webhook token (for webhook setup)
   */
  verifyWebhook(token: string, challenge: string): string | null {
    const verifyToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    
    if (token === verifyToken) {
      logger.info('WhatsApp webhook verification successful');
      return challenge;
    } else {
      logger.warn('WhatsApp webhook verification failed - invalid token');
      return null;
    }
  }

  /**
   * Process incoming webhook data
   */
  processWebhook(body: any): void {
    try {
      // Process delivery status updates, message receipts, etc.
      if (body.entry && body.entry[0] && body.entry[0].changes) {
        const changes = body.entry[0].changes;
        
        changes.forEach((change: any) => {
          if (change.field === 'messages') {
            const value = change.value;
            
            // Process message status updates
            if (value.statuses) {
              value.statuses.forEach((status: any) => {
                logger.info('WhatsApp message status update:', {
                  messageId: status.id,
                  status: status.status,
                  timestamp: status.timestamp,
                  recipient: status.recipient_id
                });
              });
            }
            
            // Process incoming messages (if needed)
            if (value.messages) {
              value.messages.forEach((message: any) => {
                logger.info('WhatsApp incoming message:', {
                  from: message.from,
                  messageId: message.id,
                  type: message.type,
                  timestamp: message.timestamp
                });
              });
            }
          }
        });
      }
    } catch (error) {
      logger.error('Error processing WhatsApp webhook:', error);
    }
  }

  /**
   * Format phone number for WhatsApp API
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming Brazil +55)
    if (cleanPhone.startsWith('55')) {
      return cleanPhone;
    } else if (cleanPhone.length === 11) {
      return `55${cleanPhone}`;
    } else if (cleanPhone.length === 10) {
      return `55${cleanPhone}`;
    }
    
    return cleanPhone;
  }

  /**
   * Replace template variables with actual values
   */
  private replaceVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Add delay between requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;