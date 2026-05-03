/**
 * Authentication Routes
 * 认证路由
 * 
 * Defines routes for admin authentication
 */

import { Router } from 'express';
import { Database } from '../db';
import { AuthController } from '../controllers/authController';
import { webAuthMiddleware } from '../middleware/webAuthMiddleware';

/**
 * Create authentication routes
 * @param db Database instance
 * @returns Express router
 */
export function createAuthRoutes(db: Database): Router {
  const router = Router();
  const authController = new AuthController(db);

  /**
   * POST /api/auth/login
   * Admin login endpoint
   */
  router.post('/login', (req, res) => authController.login(req, res));

  /**
   * GET /api/auth/verify
   * Verify current token (requires authentication)
   */
  router.get('/verify', webAuthMiddleware, (req, res) => authController.verify(req, res));

  return router;
}
