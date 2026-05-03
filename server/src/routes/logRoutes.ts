/**
 * Log Routes
 * 日志路由
 * 
 * Defines routes for access log queries and system status
 */

import { Router, Request, Response } from 'express';
import { Database } from '../db';
import { LogController } from '../controllers/logController';
import { webAuthMiddleware } from '../middleware/webAuthMiddleware';

/**
 * Create log routes
 * @param db Database instance
 * @returns Express router
 */
export function createLogRoutes(db: Database): Router {
  const router = Router();
  const logController = new LogController(db);

  /**
   * GET /api/logs
   * Query access logs with filtering and pagination
   * 
   * Requires JWT authentication
   * 
   * Query parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 50)
   * - device_id: Filter by device ID
   * - uid: Filter by card UID
   * - allowed: Filter by access status (true/false)
   * - start_time: Filter by start time (ISO 8601 format)
   * - end_time: Filter by end time (ISO 8601 format)
   * 
   * Requirements: 8.4, 8.5
   */
  router.get(
    '/',
    webAuthMiddleware,
    (req: Request, res: Response) => logController.getLogs(req, res)
  );

  /**
   * GET /api/status
   * Get real-time system status
   * 
   * Requires JWT authentication
   * 
   * Returns:
   * - recent_access: Last 10 access log entries
   * - devices_status: All devices with online status
   * - statistics: System statistics (cards, devices, today's access)
   * 
   * Requirements: 18.1, 18.2, 18.3, 18.4
   */
  router.get(
    '/status',
    webAuthMiddleware,
    (req: Request, res: Response) => logController.getStatus(req, res)
  );

  return router;
}
