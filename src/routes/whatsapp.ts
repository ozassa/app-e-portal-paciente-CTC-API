import { Router, Request, Response } from 'express';
import { whatsappService } from '../services/whatsapp';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const sendMessageSchema = Joi.object({
  phone: Joi.string().required().min(10).max(15),
  message: Joi.string().required().min(1).max(1000)
});

const sendTemplateSchema = Joi.object({
  phone: Joi.string().required().min(10).max(15),
  templateId: Joi.string().required().valid(
    'appointment_confirmation',
    'appointment_reminder', 
    'two_factor_auth',
    'password_reset',
    'appointment_cancelled',
    'welcome_message'
  ),
  variables: Joi.object().required()
});

const bulkMessageSchema = Joi.object({
  messages: Joi.array().items(
    Joi.object({
      phone: Joi.string().required().min(10).max(15),
      message: Joi.string().required().min(1).max(1000)
    })
  ).min(1).max(100).required()
});

const bulkTemplateSchema = Joi.object({
  messages: Joi.array().items(
    Joi.object({
      phone: Joi.string().required().min(10).max(15),
      templateId: Joi.string().required().valid(
        'appointment_confirmation',
        'appointment_reminder', 
        'two_factor_auth',
        'password_reset',
        'appointment_cancelled',
        'welcome_message'
      ),
      variables: Joi.object().required()
    })
  ).min(1).max(100).required()
});

/**
 * @route POST /api/v1/whatsapp/send
 * @desc Send a text message via WhatsApp
 * @access Private
 */
router.post('/send', authenticate, validateRequest(sendMessageSchema), async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;

    const result = await whatsappService.sendTextMessage(phone, message);

    if (result.success) {
      logger.info('WhatsApp message sent via API', {
        userId: req.user?.id,
        phone: result.phone,
        messageId: result.messageId
      });

      res.json({
        success: true,
        message: 'WhatsApp message sent successfully',
        data: {
          messageId: result.messageId,
          phone: result.phone
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send WhatsApp message',
        error: result.error
      });
    }
  } catch (error: any) {
    logger.error('WhatsApp send message API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/whatsapp/send-template
 * @desc Send a templated message via WhatsApp
 * @access Private
 */
router.post('/send-template', authenticate, validateRequest(sendTemplateSchema), async (req: Request, res: Response) => {
  try {
    const { phone, templateId, variables } = req.body;

    const result = await whatsappService.sendTemplatedMessage(phone, templateId, variables);

    if (result.success) {
      logger.info('WhatsApp template message sent via API', {
        userId: req.user?.id,
        phone: result.phone,
        templateId,
        messageId: result.messageId
      });

      res.json({
        success: true,
        message: 'WhatsApp template message sent successfully',
        data: {
          messageId: result.messageId,
          phone: result.phone,
          template: templateId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send WhatsApp template message',
        error: result.error
      });
    }
  } catch (error: any) {
    logger.error('WhatsApp send template API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/whatsapp/bulk-send
 * @desc Send bulk text messages via WhatsApp
 * @access Private
 */
router.post('/bulk-send', authenticate, validateRequest(bulkMessageSchema), async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;

    const result = await whatsappService.sendBulkMessages(messages);

    logger.info('WhatsApp bulk messages sent via API', {
      userId: req.user?.id,
      total: result.total,
      successful: result.successful,
      failed: result.failed
    });

    res.json({
      success: true,
      message: `Bulk WhatsApp messages completed: ${result.successful} sent, ${result.failed} failed`,
      data: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        results: result.results
      }
    });
  } catch (error: any) {
    logger.error('WhatsApp bulk send API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/whatsapp/bulk-template
 * @desc Send bulk templated messages via WhatsApp
 * @access Private
 */
router.post('/bulk-template', authenticate, validateRequest(bulkTemplateSchema), async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;

    const result = await whatsappService.sendBulkTemplatedMessages(messages);

    logger.info('WhatsApp bulk template messages sent via API', {
      userId: req.user?.id,
      total: result.total,
      successful: result.successful,
      failed: result.failed
    });

    res.json({
      success: true,
      message: `Bulk WhatsApp template messages completed: ${result.successful} sent, ${result.failed} failed`,
      data: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        results: result.results
      }
    });
  } catch (error: any) {
    logger.error('WhatsApp bulk template API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/whatsapp/status
 * @desc Get WhatsApp service status
 * @access Private
 */
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const status = whatsappService.getServiceStatus();

    res.json({
      success: true,
      message: 'WhatsApp service status retrieved',
      data: status
    });
  } catch (error: any) {
    logger.error('WhatsApp status API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/whatsapp/webhook
 * @desc Verify WhatsApp webhook
 * @access Public
 */
router.get('/webhook', (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (mode === 'subscribe') {
      const result = whatsappService.verifyWebhook(token, challenge);
      
      if (result) {
        logger.info('WhatsApp webhook verified successfully');
        res.status(200).send(result);
      } else {
        logger.warn('WhatsApp webhook verification failed');
        res.status(403).send('Forbidden');
      }
    } else {
      res.status(400).send('Bad Request');
    }
  } catch (error: any) {
    logger.error('WhatsApp webhook verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/whatsapp/webhook
 * @desc Handle WhatsApp webhook events
 * @access Public
 */
router.post('/webhook', (req: Request, res: Response) => {
  try {
    whatsappService.processWebhook(req.body);
    res.status(200).send('OK');
  } catch (error: any) {
    logger.error('WhatsApp webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;