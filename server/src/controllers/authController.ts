/**
 * Authentication Controller
 * 认证控制器
 * 
 * Handles admin login and authentication
 */

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Database } from '../db';
import { AdminRepository } from '../repositories/AdminRepository';
import { generateToken } from '../utils/jwtUtils';

/**
 * Login request body
 */
interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Authentication Controller class
 */
export class AuthController {
  private adminRepo: AdminRepository;

  constructor(db: Database) {
    this.adminRepo = new AdminRepository(db);
  }

  /**
   * Handle admin login
   * POST /api/auth/login
   * 
   * @param req Express request
   * @param res Express response
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body as LoginRequest;

      // Validate input
      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'Missing credentials',
          message: '用户名和密码不能为空',
        });
        return;
      }

      // Find admin by username
      const admin = await this.adminRepo.findByUsername(username);

      if (!admin) {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: '用户名或密码错误',
        });
        return;
      }

      // Verify password using bcrypt
      const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: '用户名或密码错误',
        });
        return;
      }

      // Generate JWT token
      const token = generateToken({
        id: admin.id,
        username: admin.username,
      });

      // Return success response with token
      res.status(200).json({
        success: true,
        message: '登录成功',
        data: {
          token,
          admin: this.adminRepo.toSafeAdmin(admin),
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: '服务器内部错误',
      });
    }
  }

  /**
   * Verify current token (optional endpoint for token validation)
   * GET /api/auth/verify
   * 
   * @param req Express request (with admin from middleware)
   * @param res Express response
   */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      // If we reach here, the token is valid (checked by middleware)
      const adminId = req.admin?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          message: '令牌无效',
        });
        return;
      }

      // Optionally fetch fresh admin data
      const admin = await this.adminRepo.findById(adminId);

      if (!admin) {
        res.status(401).json({
          success: false,
          error: 'Admin not found',
          message: '管理员不存在',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: '令牌有效',
        data: {
          admin: this.adminRepo.toSafeAdmin(admin),
        },
      });
    } catch (error) {
      console.error('Verify token error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: '服务器内部错误',
      });
    }
  }
}
