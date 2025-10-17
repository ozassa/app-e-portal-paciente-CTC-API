import Joi from 'joi';

// CPF validation
export const validateCPF = (cpf: string): boolean => {
  // Remove all non-digit characters
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Check if it has 11 digits
  if (cleanCPF.length !== 11) return false;
  
  // Check if all digits are the same
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Validate CPF algorithm
  let sum = 0;
  let remainder;
  
  // Validate first digit
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;
  
  // Validate second digit
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;
  
  return true;
};

// Phone validation
export const validatePhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
};

// Sanitize input
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

// Format CPF
export const formatCPF = (cpf: string): string => {
  const cleanCPF = cpf.replace(/\D/g, '');
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// Format phone
export const formatPhone = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (cleanPhone.length === 11) {
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return phone;
};

// Validation schemas
export const validationSchemas = {
  // Auth schemas
  login: Joi.object({
    cpf: Joi.string()
      .pattern(/^\d{11}$/)
      .required()
      .messages({
        'string.pattern.base': 'CPF deve conter 11 dígitos',
        'any.required': 'CPF é obrigatório'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': 'Senha deve ter pelo menos 6 caracteres',
        'any.required': 'Senha é obrigatória'
      })
  }),

  verify2FA: Joi.object({
    sessionId: Joi.string().required().messages({
      'any.required': 'Session ID é obrigatório'
    }),
    code: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'Código deve conter 6 dígitos',
        'any.required': 'Código é obrigatório'
      })
  }),

  signup: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'string.max': 'Nome deve ter no máximo 100 caracteres',
        'any.required': 'Nome é obrigatório'
      }),
    cpf: Joi.string()
      .pattern(/^\d{11}$/)
      .required()
      .custom((value, helpers) => {
        if (!validateCPF(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      })
      .messages({
        'string.pattern.base': 'CPF deve conter 11 dígitos',
        'any.invalid': 'CPF inválido',
        'any.required': 'CPF é obrigatório'
      }),
    phone: Joi.string()
      .pattern(/^\d{10,11}$/)
      .required()
      .messages({
        'string.pattern.base': 'Telefone deve conter 10 ou 11 dígitos',
        'any.required': 'Telefone é obrigatório'
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': 'Email inválido'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': 'Senha deve ter pelo menos 6 caracteres',
        'any.required': 'Senha é obrigatória'
      })
  }),

  // User schemas
  updateProfile: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .optional(),
    phone: Joi.string()
      .pattern(/^\d{10,11}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Telefone deve conter 10 ou 11 dígitos'
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': 'Email inválido'
      })
  }),

  // Dependent schemas
  addDependent: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'string.max': 'Nome deve ter no máximo 100 caracteres',
        'any.required': 'Nome é obrigatório'
      }),
    cpf: Joi.string()
      .pattern(/^\d{11}$/)
      .required()
      .custom((value, helpers) => {
        if (!validateCPF(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      })
      .messages({
        'string.pattern.base': 'CPF deve conter 11 dígitos',
        'any.invalid': 'CPF inválido',
        'any.required': 'CPF é obrigatório'
      }),
    relationship: Joi.string()
      .valid('spouse', 'child', 'parent', 'other')
      .required()
      .messages({
        'any.only': 'Relacionamento deve ser: spouse, child, parent ou other',
        'any.required': 'Relacionamento é obrigatório'
      }),
    birthDate: Joi.date()
      .max('now')
      .optional()
      .messages({
        'date.max': 'Data de nascimento não pode ser futura'
      })
  }),

  // Appointment schemas
  createAppointment: Joi.object({
    unitId: Joi.string().required().messages({
      'any.required': 'ID da unidade é obrigatório'
    }),
    specialtyId: Joi.string().required().messages({
      'any.required': 'ID da especialidade é obrigatório'
    }),
    doctorId: Joi.string().required().messages({
      'any.required': 'ID do médico é obrigatório'
    }),
    date: Joi.date()
      .min('now')
      .required()
      .messages({
        'date.min': 'Data deve ser futura',
        'any.required': 'Data é obrigatória'
      }),
    time: Joi.string()
      .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required()
      .messages({
        'string.pattern.base': 'Horário deve estar no formato HH:mm',
        'any.required': 'Horário é obrigatório'
      }),
    dependentId: Joi.string().optional(),
    notes: Joi.string().max(500).optional().messages({
      'string.max': 'Observações devem ter no máximo 500 caracteres'
    })
  }),

  // Query params
  appointmentsQuery: Joi.object({
    status: Joi.string()
      .valid('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')
      .optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    dependentId: Joi.string().optional()
  }),

  unitsQuery: Joi.object({
    city: Joi.string().optional(),
    specialty: Joi.string().optional(),
    lat: Joi.number().min(-90).max(90).optional(),
    lng: Joi.number().min(-180).max(180).optional(),
    radius: Joi.number().min(0).max(100).optional()
  }),
};

// Middleware para validação
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: {
          message: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details
        }
      });
    }
    
    req.body = value;
    next();
  };
};

// Middleware para validação de query params
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: {
          message: 'Parâmetros de consulta inválidos',
          code: 'QUERY_VALIDATION_ERROR',
          details
        }
      });
    }
    
    req.query = value;
    next();
  };
};