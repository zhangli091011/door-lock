/**
 * Access Control Routes
 * 权限验证路由
 * 
 * Defines routes for ESP32 device access control
 */

import { Router, Response } from 'express';
import { Database } from '../db';
import { AccessController } from '../controllers/accessController';
import { createDeviceAuthMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';

/**
 * Create access control routes
 * @param db Database instance
 * @returns Express router
 */
export function createAccessRoutes(db: Database): Router {
  const router = Router();
  const accessController = new AccessController(db);

  // Create authentication middleware with signature verification
  const deviceAuth = createDeviceAuthMiddleware(db, true);

  /**
   * POST /api/check-card
   * ESP32 device card verification endpoint
   * 
   * Middleware chain:
   * 1. Rate limiting (device + IP level)
   * 2. Device authentication (API Key + signature verification)
   * 3. Access controller
   * 
   * Requirements: 2.1, 2.2, 2.3, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2
   */
  router.post(
    '/check-card',
    rateLimitMiddleware(),
    deviceAuth,
    (req: AuthenticatedRequest, res: Response) => accessController.checkCard(req, res)
  );

  /**
   * POST /api/access/log
   * ESP32 device access log reporting endpoint
   * 用于设备上报本地缓存验证的访问日志
   * 
   * Middleware chain:
   * 1. Rate limiting
   * 2. Device authentication (API Key only, no signature required for log reporting)
   */
  const deviceAuthNoSignature = createDeviceAuthMiddleware(db, false);
  
  router.post(
    '/log',
    rateLimitMiddleware(),
    deviceAuthNoSignature,
    (req: AuthenticatedRequest, res: Response) => accessController.reportAccessLog(req, res)
  );

  return router;
}
