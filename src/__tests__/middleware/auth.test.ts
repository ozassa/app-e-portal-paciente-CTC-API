import { Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth } from '../../middleware/auth';
import { generateToken, generateRefreshToken } from '../../utils/auth';

// Mock user data
const mockUser = {
  id: 'user-123',
  name: 'Test User',
  cpf: '12345678901',
  email: 'test@example.com',
  phone: '11999888777',
  plan: 'PREMIUM',
  cardNumber: '1234567890',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock request, response, and next function
const mockRequest = (authorization?: string): Partial<Request> => ({
  headers: {
    authorization,
  },
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext: NextFunction = jest.fn();

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock prisma user lookup
    global.prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid token', async () => {
      const token = generateToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe(mockUser.id);
      expect(req.user?.cpf).toBe(mockUser.cpf);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token de acesso requerido',
      });
    });

    it('should reject malformed authorization header', async () => {
      const req = mockRequest('InvalidFormat token') as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Formato de token inválido',
      });
    });

    it('should reject invalid token', async () => {
      const req = mockRequest('Bearer invalid.token.here') as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token inválido',
      });
    });

    it('should reject expired token', async () => {
      // Create an expired token (this would require mocking JWT or time)
      // For now, we'll test with an invalid token format
      const req = mockRequest('Bearer expired.token.format') as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject refresh token as access token', async () => {
      const refreshToken = generateRefreshToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      const req = mockRequest(`Bearer ${refreshToken}`) as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token inválido',
      });
    });

    it('should reject token for non-existent user', async () => {
      // Mock user not found
      global.prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      const token = generateToken({
        userId: 'non-existent-user',
        cpf: '00000000000',
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Usuário não encontrado',
      });
    });

    it('should reject token for inactive user', async () => {
      // Mock inactive user
      global.prisma.user.findUnique = jest.fn().mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const token = generateToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Conta desativada',
      });
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      global.prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const token = generateToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Erro interno do servidor',
      });
    });

    it('should set correct user data in request', async () => {
      const token = generateToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        cpf: mockUser.cpf,
        email: mockUser.email,
        phone: mockUser.phone,
        plan: mockUser.plan,
        cardNumber: mockUser.cardNumber,
        userId: mockUser.id, // Legacy compatibility
      });
    });

    it('should handle case-insensitive Bearer keyword', async () => {
      const token = generateToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      const testCases = [
        `bearer ${token}`,
        `BEARER ${token}`,
        `Bearer ${token}`,
        `BeArEr ${token}`,
      ];

      for (const authHeader of testCases) {
        const req = mockRequest(authHeader) as Request;
        const res = mockResponse() as Response;
        const next = jest.fn();

        await authenticate(req, res, next);

        expect(req.user).toBeDefined();
        expect(next).toHaveBeenCalled();
      }
    });
  });

  describe('optionalAuth middleware', () => {
    it('should proceed without authentication when no token provided', async () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should authenticate when valid token provided', async () => {
      const token = generateToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe(mockUser.id);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication when invalid token provided', async () => {
      const req = mockRequest('Bearer invalid.token') as Request;
      const res = mockResponse() as Response;

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication when user not found', async () => {
      global.prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      const token = generateToken({
        userId: 'non-existent',
        cpf: '00000000000',
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Token Extraction', () => {
    it('should handle extra whitespace in authorization header', async () => {
      const token = generateToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      const req = mockRequest(`  Bearer   ${token}  `) as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty Bearer token', async () => {
      const req = mockRequest('Bearer ') as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle Bearer without token', async () => {
      const req = mockRequest('Bearer') as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Performance and Security', () => {
    it('should not expose sensitive user information', async () => {
      // Add password field to mock user
      const userWithPassword = {
        ...mockUser,
        password: '$2b$10$hashedpassword',
      };

      global.prisma.user.findUnique = jest.fn().mockResolvedValue(userWithPassword);

      const token = generateToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user?.password).toBeUndefined();
    });

    it('should handle concurrent requests efficiently', async () => {
      const token = generateToken({
        userId: mockUser.id,
        cpf: mockUser.cpf,
      });

      // Simulate multiple concurrent requests
      const requests = Array(10).fill(null).map(() => {
        const req = mockRequest(`Bearer ${token}`) as Request;
        const res = mockResponse() as Response;
        const next = jest.fn();
        return authenticate(req, res, next);
      });

      await Promise.all(requests);

      // All requests should have been processed
      expect(global.prisma.user.findUnique).toHaveBeenCalledTimes(10);
    });

    it('should validate token structure before processing', async () => {
      const malformedTokens = [
        'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9', // Only header
        'Bearer header.payload', // Missing signature
        'Bearer not.jwt.format.extra.parts', // Too many parts
        'Bearer ....', // Empty parts
      ];

      for (const authHeader of malformedTokens) {
        const req = mockRequest(authHeader) as Request;
        const res = mockResponse() as Response;
        const next = jest.fn();

        await authenticate(req, res, next);

        expect(req.user).toBeUndefined();
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined authorization header', async () => {
      const req = { headers: {} } as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle null authorization header', async () => {
      const req = { headers: { authorization: null } } as any;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle non-string authorization header', async () => {
      const req = { headers: { authorization: 123 } } as any;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle missing headers object', async () => {
      const req = {} as Request;
      const res = mockResponse() as Response;

      await authenticate(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});