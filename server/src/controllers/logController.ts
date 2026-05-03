/**
 * Log Controller
 * 日志控制器
 * 
 * Handles access log query endpoints:
 * - GET /api/logs - Query access logs with filtering and pagination
 * - GET /api/status - Get real-time system status
 * 
 * Requirements: 8.4, 8.5, 18.1, 18.2, 18.3, 18.4
 */

import { Request, Response } from 'express';
import { Database } from '../db';
import { AccessLogRepository } from '../repositories/AccessLogRepository';
import { DeviceRepository } from '../repositories/DeviceRepository';
import { CardRepository } from '../repositories/CardRepository';
import { AccessLogFilter } from '../models/AccessLog';

/**
 * Log Controller
 */
export class LogController {
  private accessLogRepository: AccessLogRepository;
  private deviceRepository: DeviceRepository;
  private cardRepository: CardRepository;

  constructor(db: Database) {
    this.accessLogRepository = new AccessLogRepository(db);
    this.deviceRepository = new DeviceRepository(db);
    this.cardRepository = new CardRepository(db);
  }

  /**
   * GET /api/logs
   * Query access logs with filtering and pagination
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
  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const {
        page = '1',
        limit = '50',
        device_id,
        uid,
        allowed,
        start_time,
        end_time,
      } = req.query;

      // Build filter object
      const filter: AccessLogFilter = {};

      // Parse pagination parameters
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Validate pagination parameters
      if (isNaN(pageNum) || pageNum < 1) {
        res.status(400).json({
          success: false,
          error: 'Invalid page parameter',
          message: 'Page must be a positive integer',
        });
        return;
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter',
          message: 'Limit must be between 1 and 200',
        });
        return;
      }

      filter.page = pageNum;
      filter.limit = limitNum;

      // Parse device_id filter
      if (device_id && typeof device_id === 'string') {
        filter.device_id = device_id;
      }

      // Parse uid filter
      if (uid && typeof uid === 'string') {
        filter.uid = uid;
      }

      // Parse allowed filter
      if (allowed !== undefined) {
        if (allowed === 'true') {
          filter.allowed = true;
        } else if (allowed === 'false') {
          filter.allowed = false;
        } else {
          res.status(400).json({
            success: false,
            error: 'Invalid allowed parameter',
            message: 'Allowed must be "true" or "false"',
          });
          return;
        }
      }

      // Parse start_time filter
      if (start_time && typeof start_time === 'string') {
        const startDate = new Date(start_time);
        if (isNaN(startDate.getTime())) {
          res.status(400).json({
            success: false,
            error: 'Invalid start_time parameter',
            message: 'start_time must be a valid ISO 8601 date string',
          });
          return;
        }
        filter.start_time = startDate;
      }

      // Parse end_time filter
      if (end_time && typeof end_time === 'string') {
        const endDate = new Date(end_time);
        if (isNaN(endDate.getTime())) {
          res.status(400).json({
            success: false,
            error: 'Invalid end_time parameter',
            message: 'end_time must be a valid ISO 8601 date string',
          });
          return;
        }
        filter.end_time = endDate;
      }

      // Validate time range
      if (filter.start_time && filter.end_time && filter.start_time > filter.end_time) {
        res.status(400).json({
          success: false,
          error: 'Invalid time range',
          message: 'start_time must be before end_time',
        });
        return;
      }

      // Query access logs
      const result = await this.accessLogRepository.findAll(filter);

      // Return success response
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error querying access logs:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to query access logs',
      });
    }
  }

  /**
   * GET /api/status
   * Get real-time system status
   * 
   * Returns:
   * - recent_access: Last 10 access log entries
   * - devices_status: All devices with online status
   * - statistics: System statistics (cards, devices, today's access)
   * 
   * Requirements: 18.1, 18.2, 18.3, 18.4
   */
  async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      // Query recent 10 access logs
      const recentAccess = await this.accessLogRepository.findRecent(10);

      // Query all devices with online status
      const devicesStatus = await this.deviceRepository.findAllWithStatus();

      // Get today's access statistics
      const accessStats = await this.accessLogRepository.getTodayStatistics();

      // Get card counts
      const totalCards = await this.cardRepository.countTotal();
      const activeCards = await this.cardRepository.countEnabled();

      // Get device counts
      const totalDevices = await this.deviceRepository.countTotal();
      const onlineDevices = await this.deviceRepository.countOnline();

      // Build response
      const statusData = {
        recent_access: recentAccess.map(log => ({
          uid: log.uid,
          card_name: log.card_name,
          device_id: log.device_id,
          device_name: log.device_name,
          timestamp: log.timestamp,
          allowed: log.allowed,
          source: log.source,
        })),
        devices_status: devicesStatus.map(device => ({
          device_id: device.device_id,
          name: device.name,
          location: device.location,
          online: device.is_online,
          last_seen: device.last_seen,
        })),
        statistics: {
          total_cards: totalCards,
          active_cards: activeCards,
          total_devices: totalDevices,
          online_devices: onlineDevices,
          today_access: accessStats.today_access,
          today_denied: accessStats.today_denied,
        },
      };

      // Return success response
      res.status(200).json({
        success: true,
        data: statusData,
      });
    } catch (error) {
      console.error('Error getting system status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get system status',
      });
    }
  }
}
