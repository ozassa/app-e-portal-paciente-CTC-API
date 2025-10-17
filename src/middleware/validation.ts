import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false, // Get all validation errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert values to expected types
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        value: detail.context?.value
      }));

      logger.warn('Request validation failed:', {
        path: req.path,
        method: req.method,
        errors: errorDetails,
        body: req.body
      });

      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: errorDetails
      });
    }

    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        value: detail.context?.value
      }));

      logger.warn('Query validation failed:', {
        path: req.path,
        method: req.method,
        errors: errorDetails,
        query: req.query
      });

      return res.status(400).json({
        success: false,
        message: 'Parâmetros de consulta inválidos',
        errors: errorDetails
      });
    }

    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        value: detail.context?.value
      }));

      logger.warn('Params validation failed:', {
        path: req.path,
        method: req.method,
        errors: errorDetails,
        params: req.params
      });

      return res.status(400).json({
        success: false,
        message: 'Parâmetros de rota inválidos',
        errors: errorDetails
      });
    }

    next();
  };
};