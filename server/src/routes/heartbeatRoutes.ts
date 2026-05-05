/**
 * Heartbeat Routes
 * 心跳路由
 * 
 * 设备心跳端点，用于保持设备在线状态
 */

import { Router, Response } from 'express';
import { Database } from '../db';
import { createDeviceAuthMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';

/**
 * Create heartbeat routes
 * @param db Database instance
 * @returns Express router
 */
export function createHeartbeatRoutes(db: Database): Router {
  const router = Router();

  // 创建设备认证中间件（不需要签名验证）
  const deviceAuth = createDeviceAuthMiddleware(db, false);

  /**
   * POST /api/heartbeat
   * 设备心跳端点
   * 
   * 只需要 API Key 认证，不需要签名
   * 自动更新设备的 last_seen 时间戳
   */
  router.post(
    '/heartbeat',
    deviceAuth,
    (_req: AuthenticatedRequest, res: Response) => {
      // 认证中间件已经更新了 last_seen
      res.status(200).json({
        success: true,
        message: 'Heartbeat received',
        timestamp: new Date().toISOString()
      });
    }
  );

  return router;
}
