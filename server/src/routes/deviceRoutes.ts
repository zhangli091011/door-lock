/**
 * Device Management Routes
 * 设备管理路由
 * 
 * Defines routes for web admin device management
 */

import { Router, Request, Response } from 'express';
import { Database } from '../db';
import { DeviceController } from '../controllers/deviceController';
import { webAuthMiddleware } from '../middleware/webAuthMiddleware';

/**
 * Create device management routes
 * @param db Database instance
 * @returns Express router
 */
export function createDeviceRoutes(db: Database): Router {
  const router = Router();
  const deviceController = new DeviceController(db);

  /**
   * POST /api/devices
   * Register a new device
   * 
   * Requires JWT authentication
   * 
   * Requirements: 7.1, 7.2
   */
  router.post(
    '/',
    webAuthMiddleware,
    (req: Request, res: Response) => deviceController.registerDevice(req, res)
  );

  /**
   * PUT /api/devices/:deviceId
   * Update an existing device
   * 
   * Requires JWT authentication
   * 
   * Requirements: 7.6
   */
  router.put(
    '/:deviceId',
    webAuthMiddleware,
    (req: Request, res: Response) => deviceController.updateDevice(req, res)
  );

  /**
   * GET /api/devices
   * List all devices with online status
   * 
   * Requires JWT authentication
   * 
   * Requirements: 7.4, 9.5
   */
  router.get(
    '/',
    webAuthMiddleware,
    (req: Request, res: Response) => deviceController.listDevices(req, res)
  );

  return router;
}
