/**
 * Auth Controller Tests
 * 认证控制器测试
 */

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthController } from './authController';
import { Database } from '../db';
import { AdminRepository } from '../repositories/AdminRepository';
import { Admin } from '../models/Admin';
import { verifyToken } from '../utils/jwtUtils';

// Mock dependencies
jest.mock('../repositories/AdminRepository');
jest.mock('bcrypt');

describe('AuthController', () => {
  let authController: AuthController;
  let mockDb: jest.Mocked<Database>;
  let mockAdminRepo: jest.Mocked<AdminRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockDb = {} as jest.Mocked<Database>;
    mockAdminRepo = new AdminRepository(mockDb) as jest.Mocked<AdminRepository>;
    authController = new AuthController(mockDb);
    (authController as any).adminRepo = mockAdminRepo;

    mockRequest = {
      body: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('login', () => {
    const validAdmin: Admin = {
      id: 1,
      username: 'admin',
      password_hash: '$2b$10$hashedpassword',
      email: 'admin@example.com',
      created_at: new Date(),
    };

    it('should login successfully with valid credentials', async () => {
      mockRequest.body = {
        username: 'admin',
        password: 'admin123',
      };

      mockAdminRepo.findByUsername.mockResolvedValue(validAdmin);
      mockAdminRepo.toSafeAdmin.mockReturnValue({
        id: validAdmin.id,
        username: validAdmin.username,
        email: validAdmin.email,
        created_at: validAdmin.created_at,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockAdminRepo.findByUsername).toHaveBeenCalledWith('admin');
      expect(bcrypt.compare).toHaveBeenCalledWith('admin123', validAdmin.password_hash);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '登录成功',
          data: expect.objectContaining({
            token: expect.any(String),
            admin: expect.objectContaining({
              id: validAdmin.id,
              username: validAdmin.username,
            }),
          }),
        })
      );
    });

    it('should return valid JWT token on successful login', async () => {
      mockRequest.body = {
        username: 'admin',
        password: 'admin123',
      };

      mockAdminRepo.findByUsername.mockResolvedValue(validAdmin);
      mockAdminRepo.toSafeAdmin.mockReturnValue({
        id: validAdmin.id,
        username: validAdmin.username,
        email: validAdmin.email,
        created_at: validAdmin.created_at,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await authController.login(mockRequest as Request, mockResponse as Response);

      const responseData = (mockResponse.json as jest.Mock).mock.calls[0][0];
      const token = responseData.data.token;

      // Verify the token is valid
      const payload = verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload?.id).toBe(validAdmin.id);
      expect(payload?.username).toBe(validAdmin.username);
    });

    it('should reject login with missing username', async () => {
      mockRequest.body = {
        password: 'admin123',
      };

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing credentials',
        message: '用户名和密码不能为空',
      });
      expect(mockAdminRepo.findByUsername).not.toHaveBeenCalled();
    });

    it('should reject login with missing password', async () => {
      mockRequest.body = {
        username: 'admin',
      };

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing credentials',
        message: '用户名和密码不能为空',
      });
      expect(mockAdminRepo.findByUsername).not.toHaveBeenCalled();
    });

    it('should reject login with non-existent username', async () => {
      mockRequest.body = {
        username: 'nonexistent',
        password: 'admin123',
      };

      mockAdminRepo.findByUsername.mockResolvedValue(null);

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockAdminRepo.findByUsername).toHaveBeenCalledWith('nonexistent');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid credentials',
        message: '用户名或密码错误',
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should reject login with incorrect password', async () => {
      mockRequest.body = {
        username: 'admin',
        password: 'wrongpassword',
      };

      mockAdminRepo.findByUsername.mockResolvedValue(validAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockAdminRepo.findByUsername).toHaveBeenCalledWith('admin');
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', validAdmin.password_hash);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid credentials',
        message: '用户名或密码错误',
      });
    });

    it('should handle database errors gracefully', async () => {
      mockRequest.body = {
        username: 'admin',
        password: 'admin123',
      };

      mockAdminRepo.findByUsername.mockRejectedValue(new Error('Database error'));

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: '服务器内部错误',
      });
    });
  });

  describe('verify', () => {
    const validAdmin: Admin = {
      id: 1,
      username: 'admin',
      password_hash: '$2b$10$hashedpassword',
      email: 'admin@example.com',
      created_at: new Date(),
    };

    it('should verify valid token and return admin info', async () => {
      mockRequest.admin = {
        id: 1,
        username: 'admin',
      };

      mockAdminRepo.findById.mockResolvedValue(validAdmin);
      mockAdminRepo.toSafeAdmin.mockReturnValue({
        id: validAdmin.id,
        username: validAdmin.username,
        email: validAdmin.email,
        created_at: validAdmin.created_at,
      });

      await authController.verify(mockRequest as Request, mockResponse as Response);

      expect(mockAdminRepo.findById).toHaveBeenCalledWith(1);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: '令牌有效',
        data: {
          admin: expect.objectContaining({
            id: validAdmin.id,
            username: validAdmin.username,
          }),
        },
      });
    });

    it('should reject if admin not found in request', async () => {
      mockRequest.admin = undefined;

      await authController.verify(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        message: '令牌无效',
      });
      expect(mockAdminRepo.findById).not.toHaveBeenCalled();
    });

    it('should reject if admin no longer exists in database', async () => {
      mockRequest.admin = {
        id: 999,
        username: 'deleted_admin',
      };

      mockAdminRepo.findById.mockResolvedValue(null);

      await authController.verify(mockRequest as Request, mockResponse as Response);

      expect(mockAdminRepo.findById).toHaveBeenCalledWith(999);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin not found',
        message: '管理员不存在',
      });
    });

    it('should handle database errors gracefully', async () => {
      mockRequest.admin = {
        id: 1,
        username: 'admin',
      };

      mockAdminRepo.findById.mockRejectedValue(new Error('Database error'));

      await authController.verify(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: '服务器内部错误',
      });
    });
  });
});
