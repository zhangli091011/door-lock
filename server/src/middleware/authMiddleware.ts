/**
 * Device API Key Authentication Middleware
 * 设备API Key认证中间件
 * 
 * Validates X-API-Key and X-Device-ID headers
 * Verifies API Key matches Device ID in database
 * Verifies request signature (HMAC-SHA256)
 * Validates timestamp to prevent replay attacks
 * Checks if device is enabled
 * Updates device last_seen timestamp
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 7.3, 2.8
 */

import { Request, Response, NextFunction } from 'express';
import { Database } from '../db';
import { DeviceRepository } from '../repositories/DeviceRepository';
import { verifyRequest, SignaturePayload } from '../utils/signatureUtils';

/**
 * Extended Request interface with device information
 */
export interface AuthenticatedRequest extends Request {
  device?: {
    device_id: string;
    name: string;
    enabled: boolean;
    secret_key: string;
  };
}

/**
 * Create device authentication middleware
 * @param db Database instance
 * @param requireSignature Whether to require signature verification (default: true)
 * @returns Express middleware function
 */
export function createDeviceAuthMiddleware(db: Database, requireSignature: boolean = true) {
  const deviceRepo = new DeviceRepository(db);

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract headers
      const apiKey = req.headers['x-api-key'] as string;
      const deviceId = req.headers['x-device-id'] as string;

      // Validate headers presence
      if (!apiKey || !deviceId) {
        res.status(401).json({
          success: false,
          error: 'Missing authentication headers',
          message: 'X-API-Key and X-Device-ID headers are required',
        });
        return;
      }

      // Query database to find device by device_id
      const device = await deviceRepo.findById(deviceId);

      // Check if device exists
      if (!device) {
        res.status(401).json({
          success: false,
          error: 'Invalid device ID',
          message: 'Device not found',
        });
        return;
      }

      // Verify API Key matches
      if (device.api_key !== apiKey) {
        res.status(401).json({
          success: false,
          error: 'Invalid API key',
          message: 'API Key does not match device ID',
        });
        return;
      }

      // Check if device is enabled
      if (!device.enabled) {
        res.status(401).json({
          success: false,
          error: 'Device disabled',
          message: 'This device has been disabled',
        });
        return;
      }

      // Verify request signature if required
      if (requireSignature) {
        // Extract request body
        const { uid, device_id, timestamp, signature } = req.body;

        // Validate required fields for signature verification
        if (!uid || !device_id || !timestamp || !signature) {
          res.status(400).json({
            success: false,
            error: 'Missing signature fields',
            message: 'uid, device_id, timestamp, and signature are required in request body',
          });
          return;
        }

        // Validate timestamp is a number
        if (typeof timestamp !== 'number' || isNaN(timestamp)) {
          res.status(400).json({
            success: false,
            error: 'Invalid timestamp',
            message: 'timestamp must be a valid Unix timestamp (number)',
          });
          return;
        }

        // Verify device_id in body matches header
        if (device_id !== deviceId) {
          res.status(400).json({
            success: false,
            error: 'Device ID mismatch',
            message: 'device_id in body must match X-Device-ID header',
          });
          return;
        }

        // Prepare payload for signature verification
        const payload: SignaturePayload = {
          uid,
          device_id,
          timestamp,
        };

        // Verify signature and timestamp
        const verification = verifyRequest(payload, signature, device.secret_key);

        if (!verification.valid) {
          // Log security event
          console.warn(`Signature verification failed for device ${deviceId}: ${verification.error}`);

          res.status(401).json({
            success: false,
            error: 'Signature verification failed',
            message: verification.error || 'Invalid request signature',
          });
          return;
        }
      }

      // Update device last_seen timestamp
      await deviceRepo.updateLastSeen(deviceId);

      // Attach device information to request object
      req.device = {
        device_id: device.device_id,
        name: device.name,
        enabled: device.enabled,
        secret_key: device.secret_key,
      };

      // Authentication successful, proceed to next middleware
      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred during authentication',
      });
    }
  };
}


