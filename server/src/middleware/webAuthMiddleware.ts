/**
 * Web Authentication Middleware
 * Web管理员JWT认证中间件
 * 
 * Validates JWT tokens for web admin requests
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, JWTPayload } from '../utils/jwtUtils';

/**
 * Extend Express Request to include admin info
 */
declare global {
  namespace Express {
    interface Request {
      admin?: JWTPayload;
    }
  }
}

/**
 * Web authentication middleware
 * Validates JWT token from Authorization header
 * 
 * @param req Express request
 * @param res Express response
 * @param next Next function
 */
export function webAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
        message: '未提供认证令牌',
      });
      return;
    }

    // Verify token
    const payload = verifyToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        message: '令牌无效或已过期',
      });
      return;
    }

    // Attach admin info to request
    req.admin = payload;

    // Continue to next middleware
    next();
  } catch (error) {
    console.error('Web auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '服务器内部错误',
    });
  }
}
