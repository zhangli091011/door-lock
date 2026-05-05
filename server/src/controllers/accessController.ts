/**
 * Access Control Controller
 * 权限验证控制器
 * 
 * Handles POST /api/check-card endpoint
 * Integrates authentication middleware, rate limiting, and access control service
 * Records access logs to database
 * Returns JSON response with access decision
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 8.1, 8.2, 8.3
 */

import { Response } from 'express';
import { Database } from '../db';
import { AccessControlService } from '../services/accessControlService';
import { CardRepository } from '../repositories/CardRepository';
import { AccessLogRepository } from '../repositories/AccessLogRepository';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

/**
 * Check card request body
 */
export interface CheckCardRequest {
  uid: string;
  device_id: string;
  timestamp: number;
  signature: string;
}

/**
 * Check card response
 */
export interface CheckCardResponse {
  success: boolean;
  allow: boolean;
  cacheable: boolean;
  card_name?: string;
  reason?: string;
  message: string;
}

export class AccessController {
  private accessControlService: AccessControlService;
  private accessLogRepository: AccessLogRepository;

  constructor(db: Database) {
    const cardRepository = new CardRepository(db);
    this.accessControlService = new AccessControlService(cardRepository);
    this.accessLogRepository = new AccessLogRepository(db);
  }

  /**
   * POST /api/check-card
   * Verify card access permissions
   * 
   * This endpoint is called by ESP32 devices to verify NFC card access
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 8.1, 8.2, 8.3
   */
  async checkCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Extract request body
      const { uid, device_id, timestamp } = req.body as CheckCardRequest;

      // Validate required fields (signature already validated by authMiddleware)
      if (!uid || !device_id || !timestamp) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'uid, device_id, and timestamp are required',
        });
        return;
      }

      // Validate UID format (8-14 hex characters)
      if (!this.isValidUid(uid)) {
        res.status(400).json({
          success: false,
          error: 'Invalid UID format',
          message: 'UID must be 8-14 hexadecimal characters',
        });
        return;
      }

      // Convert Unix timestamp to Date
      const requestTime = new Date(timestamp * 1000);

      // Call access control service to verify permissions
      const verificationResult = await this.accessControlService.verifyAccess({
        uid,
        device_id,
        timestamp: requestTime,
      });

      // Get device name for logging (already authenticated, so device exists)
      const device = req.device;
      const device_name = device?.name || device_id;

      // Record access log to database
      await this.accessLogRepository.create({
        uid,
        device_id,
        allowed: verificationResult.allowed,
        reason: verificationResult.reason || null,
        source: 'cloud',
        card_name: verificationResult.card_name || null,
        device_name,
      });

      // Build response
      const response: CheckCardResponse = {
        success: true,
        allow: verificationResult.allowed,
        cacheable: verificationResult.cacheable,
        message: verificationResult.allowed ? '访问允许' : '访问拒绝',
      };

      // Include card_name if available
      if (verificationResult.card_name) {
        response.card_name = verificationResult.card_name;
      }

      // Include reason if access denied
      if (!verificationResult.allowed && verificationResult.reason) {
        response.reason = verificationResult.reason;
      }

      // Return 200 OK with access decision
      res.status(200).json(response);
    } catch (error) {
      console.error('Error in checkCard controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while processing the request',
      });
    }
  }

  /**
   * POST /api/access/log
   * Report access log from ESP32 device (for cache-based access)
   * 设备上报本地缓存验证的访问日志
   */
  async reportAccessLog(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { uid, device_id, timestamp, allowed, source } = req.body;

      // Validate required fields
      if (!uid || !device_id || typeof allowed !== 'boolean' || !source) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'uid, device_id, allowed, and source are required',
        });
        return;
      }

      // Validate UID format
      if (!this.isValidUid(uid)) {
        res.status(400).json({
          success: false,
          error: 'Invalid UID format',
          message: 'UID must be 8-14 hexadecimal characters',
        });
        return;
      }

      // Validate source
      if (source !== 'cache' && source !== 'cloud') {
        res.status(400).json({
          success: false,
          error: 'Invalid source',
          message: 'source must be "cache" or "cloud"',
        });
        return;
      }

      // Get device name
      const device = req.device;
      const device_name = device?.name || device_id;

      // Try to get card name from database
      const cardRepository = new CardRepository(this.accessLogRepository['db']);
      let card_name: string | null = null;
      try {
        const card = await cardRepository.findByUid(uid);
        if (card) {
          card_name = card.name;
        }
      } catch (error) {
        // Card not found, continue without card_name
      }

      // Record access log to database
      await this.accessLogRepository.create({
        uid,
        device_id,
        allowed,
        reason: null,
        source,
        card_name,
        device_name,
      });

      res.status(201).json({
        success: true,
        message: 'Access log recorded successfully',
      });
    } catch (error) {
      console.error('Error in reportAccessLog controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while recording the access log',
      });
    }
  }

  /**
   * Validate UID format
   * UID must be 8-14 hexadecimal characters
   * 
   * @param uid Card UID
   * @returns True if valid, false otherwise
   */
  private isValidUid(uid: string): boolean {
    // Check length (8-14 characters)
    if (uid.length < 8 || uid.length > 14) {
      return false;
    }

    // Check if all characters are hexadecimal (0-9, A-F, a-f)
    const hexRegex = /^[0-9A-Fa-f]+$/;
    return hexRegex.test(uid);
  }
}
