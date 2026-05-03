/**
 * Card Controller
 * 卡片管理控制器
 * 
 * Handles card management endpoints:
 * - POST /api/cards - Add new card
 * - PUT /api/cards/:uid - Update card
 * - DELETE /api/cards/:uid - Delete card
 * - GET /api/cards - List cards with filtering
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8
 */

import { Request, Response } from 'express';
import { Database } from '../db';
import { CardRepository } from '../repositories/CardRepository';
import { DeviceRepository } from '../repositories/DeviceRepository';
import { CreateCardInput } from '../models/Card';

/**
 * Add card request body
 */
export interface AddCardRequest {
  uid: string;
  name: string;
  enabled?: boolean;
  access_start?: string | null;
  access_end?: string | null;
  time_slots?: string[] | null;
  allowed_devices?: string[] | null;
  cacheable?: boolean;
}

/**
 * Update card request body
 */
export interface UpdateCardRequest {
  name?: string;
  enabled?: boolean;
  access_start?: string | null;
  access_end?: string | null;
  time_slots?: string[] | null;
  allowed_devices?: string[] | null;
  cacheable?: boolean;
}

/**
 * Card Controller
 */
export class CardController {
  private cardRepository: CardRepository;
  private deviceRepository: DeviceRepository;

  constructor(db: Database) {
    this.cardRepository = new CardRepository(db);
    this.deviceRepository = new DeviceRepository(db);
  }

  /**
   * POST /api/cards
   * Add a new card
   * 
   * Validates:
   * - UID format (8-14 hex characters)
   * - UID uniqueness
   * - Time slots format
   * - Device ID existence
   * 
   * Requirements: 6.1, 6.2, 6.7, 6.8
   */
  async addCard(req: Request, res: Response): Promise<void> {
    try {
      const {
        uid,
        name,
        enabled = true,
        access_start = null,
        access_end = null,
        time_slots = null,
        allowed_devices = null,
        cacheable = true,
      } = req.body as AddCardRequest;

      // Validate required fields
      if (!uid || !name) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'uid and name are required',
        });
        return;
      }

      // Validate UID format (8-14 hexadecimal characters)
      if (!this.isValidUid(uid)) {
        res.status(400).json({
          success: false,
          error: 'Invalid UID format',
          message: 'UID must be 8-14 hexadecimal characters',
        });
        return;
      }

      // Validate UID uniqueness
      const existingCard = await this.cardRepository.exists(uid);
      if (existingCard) {
        res.status(409).json({
          success: false,
          error: 'UID already exists',
          message: 'A card with this UID already exists',
        });
        return;
      }

      // Validate name
      if (name.trim().length === 0 || name.length > 100) {
        res.status(400).json({
          success: false,
          error: 'Invalid name',
          message: 'Name must be between 1 and 100 characters',
        });
        return;
      }

      // Validate and convert time_slots
      let timeSlotsJson: string | null = null;
      if (time_slots !== null && time_slots !== undefined) {
        const validationResult = this.validateTimeSlots(time_slots);
        if (!validationResult.valid) {
          res.status(400).json({
            success: false,
            error: 'Invalid time_slots format',
            message: validationResult.message,
          });
          return;
        }
        timeSlotsJson = JSON.stringify(time_slots);
      }

      // Validate and convert allowed_devices
      let allowedDevicesJson: string | null = null;
      if (allowed_devices !== null && allowed_devices !== undefined) {
        const validationResult = await this.validateAllowedDevices(allowed_devices);
        if (!validationResult.valid) {
          res.status(400).json({
            success: false,
            error: 'Invalid allowed_devices',
            message: validationResult.message,
          });
          return;
        }
        allowedDevicesJson = JSON.stringify(allowed_devices);
      }

      // Validate access time range
      let accessStartDate: Date | null = null;
      let accessEndDate: Date | null = null;

      if (access_start) {
        accessStartDate = new Date(access_start);
        if (isNaN(accessStartDate.getTime())) {
          res.status(400).json({
            success: false,
            error: 'Invalid access_start',
            message: 'access_start must be a valid ISO 8601 date',
          });
          return;
        }
      }

      if (access_end) {
        accessEndDate = new Date(access_end);
        if (isNaN(accessEndDate.getTime())) {
          res.status(400).json({
            success: false,
            error: 'Invalid access_end',
            message: 'access_end must be a valid ISO 8601 date',
          });
          return;
        }
      }

      // Validate access_start < access_end
      if (accessStartDate && accessEndDate && accessStartDate >= accessEndDate) {
        res.status(400).json({
          success: false,
          error: 'Invalid access time range',
          message: 'access_start must be before access_end',
        });
        return;
      }

      // Create card input
      const cardInput: CreateCardInput = {
        uid,
        name: name.trim(),
        enabled,
        access_start: accessStartDate,
        access_end: accessEndDate,
        time_slots: timeSlotsJson,
        allowed_devices: allowedDevicesJson,
        cacheable,
      };

      // Insert card into database
      const card = await this.cardRepository.create(cardInput);

      // Return success response
      res.status(201).json({
        success: true,
        message: '卡片添加成功',
        data: {
          uid: card.uid,
          name: card.name,
          enabled: card.enabled,
          created_at: card.created_at,
        },
      });
    } catch (error) {
      console.error('Error in addCard controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while adding the card',
      });
    }
  }

  /**
   * PUT /api/cards/:uid
   * Update an existing card
   * 
   * Validates:
   * - Card existence
   * - Update data format
   * - Time slots format
   * - Device ID existence
   * 
   * Requirements: 6.3, 6.5
   */
  async updateCard(req: Request, res: Response): Promise<void> {
    try {
      const { uid } = req.params;
      const {
        name,
        enabled,
        access_start,
        access_end,
        time_slots,
        allowed_devices,
        cacheable,
      } = req.body as UpdateCardRequest;

      // Validate UID format
      if (!this.isValidUid(uid)) {
        res.status(400).json({
          success: false,
          error: 'Invalid UID format',
          message: 'UID must be 8-14 hexadecimal characters',
        });
        return;
      }

      // Check if card exists
      const existingCard = await this.cardRepository.findByUid(uid);
      if (!existingCard) {
        res.status(404).json({
          success: false,
          error: 'Card not found',
          message: 'A card with this UID does not exist',
        });
        return;
      }

      // Validate name if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
          res.status(400).json({
            success: false,
            error: 'Invalid name',
            message: 'Name must be between 1 and 100 characters',
          });
          return;
        }
      }

      // Validate and convert time_slots if provided
      let timeSlotsJson: string | null | undefined = undefined;
      if (time_slots !== undefined) {
        if (time_slots === null) {
          timeSlotsJson = null;
        } else {
          const validationResult = this.validateTimeSlots(time_slots);
          if (!validationResult.valid) {
            res.status(400).json({
              success: false,
              error: 'Invalid time_slots format',
              message: validationResult.message,
            });
            return;
          }
          timeSlotsJson = JSON.stringify(time_slots);
        }
      }

      // Validate and convert allowed_devices if provided
      let allowedDevicesJson: string | null | undefined = undefined;
      if (allowed_devices !== undefined) {
        if (allowed_devices === null) {
          allowedDevicesJson = null;
        } else {
          const validationResult = await this.validateAllowedDevices(allowed_devices);
          if (!validationResult.valid) {
            res.status(400).json({
              success: false,
              error: 'Invalid allowed_devices',
              message: validationResult.message,
            });
            return;
          }
          allowedDevicesJson = JSON.stringify(allowed_devices);
        }
      }

      // Validate access time range if provided
      let accessStartDate: Date | null | undefined = undefined;
      let accessEndDate: Date | null | undefined = undefined;

      if (access_start !== undefined) {
        if (access_start === null) {
          accessStartDate = null;
        } else {
          accessStartDate = new Date(access_start);
          if (isNaN(accessStartDate.getTime())) {
            res.status(400).json({
              success: false,
              error: 'Invalid access_start',
              message: 'access_start must be a valid ISO 8601 date',
            });
            return;
          }
        }
      }

      if (access_end !== undefined) {
        if (access_end === null) {
          accessEndDate = null;
        } else {
          accessEndDate = new Date(access_end);
          if (isNaN(accessEndDate.getTime())) {
            res.status(400).json({
              success: false,
              error: 'Invalid access_end',
              message: 'access_end must be a valid ISO 8601 date',
            });
            return;
          }
        }
      }

      // Validate access_start < access_end if both are being updated
      const finalAccessStart = accessStartDate !== undefined ? accessStartDate : existingCard.access_start;
      const finalAccessEnd = accessEndDate !== undefined ? accessEndDate : existingCard.access_end;

      if (finalAccessStart && finalAccessEnd && finalAccessStart >= finalAccessEnd) {
        res.status(400).json({
          success: false,
          error: 'Invalid access time range',
          message: 'access_start must be before access_end',
        });
        return;
      }

      // Build update input
      const updateInput: any = {};
      if (name !== undefined) updateInput.name = name.trim();
      if (enabled !== undefined) updateInput.enabled = enabled;
      if (accessStartDate !== undefined) updateInput.access_start = accessStartDate;
      if (accessEndDate !== undefined) updateInput.access_end = accessEndDate;
      if (timeSlotsJson !== undefined) updateInput.time_slots = timeSlotsJson;
      if (allowedDevicesJson !== undefined) updateInput.allowed_devices = allowedDevicesJson;
      if (cacheable !== undefined) updateInput.cacheable = cacheable;

      // Update card in database
      const updatedCard = await this.cardRepository.update(uid, updateInput);

      if (!updatedCard) {
        res.status(500).json({
          success: false,
          error: 'Update failed',
          message: 'Failed to update card',
        });
        return;
      }

      // Return success response
      res.status(200).json({
        success: true,
        message: '卡片更新成功',
        data: {
          uid: updatedCard.uid,
          name: updatedCard.name,
          enabled: updatedCard.enabled,
          updated_at: updatedCard.updated_at,
        },
      });
    } catch (error) {
      console.error('Error in updateCard controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while updating the card',
      });
    }
  }

  /**
   * DELETE /api/cards/:uid
   * Delete a card
   * 
   * Validates:
   * - Card existence
   * 
   * Requirements: 6.4
   */
  async deleteCard(req: Request, res: Response): Promise<void> {
    try {
      const { uid } = req.params;

      // Validate UID format
      if (!this.isValidUid(uid)) {
        res.status(400).json({
          success: false,
          error: 'Invalid UID format',
          message: 'UID must be 8-14 hexadecimal characters',
        });
        return;
      }

      // Check if card exists
      const existingCard = await this.cardRepository.findByUid(uid);
      if (!existingCard) {
        res.status(404).json({
          success: false,
          error: 'Card not found',
          message: 'A card with this UID does not exist',
        });
        return;
      }

      // Delete card from database
      const deleted = await this.cardRepository.delete(uid);

      if (!deleted) {
        res.status(500).json({
          success: false,
          error: 'Delete failed',
          message: 'Failed to delete card',
        });
        return;
      }

      // Return success response
      res.status(200).json({
        success: true,
        message: '卡片删除成功',
      });
    } catch (error) {
      console.error('Error in deleteCard controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while deleting the card',
      });
    }
  }

  /**
   * GET /api/cards
   * List cards with pagination and filtering
   * 
   * Query parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20)
   * - enabled: Filter by enabled status (true/false)
   * - search: Search keyword (matches UID or name)
   * 
   * Returns:
   * - cards: Array of card objects
   * - pagination: Pagination info (page, limit, total, pages)
   * 
   * Requirements: 9.4
   */
  async listCards(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, enabled, search } = req.query;

      // Parse and validate pagination parameters
      let pageNum = 1;
      let limitNum = 20;

      if (page !== undefined) {
        pageNum = parseInt(page as string, 10);
        if (isNaN(pageNum) || pageNum < 1) {
          res.status(400).json({
            success: false,
            error: 'Invalid page parameter',
            message: 'page must be a positive integer',
          });
          return;
        }
      }

      if (limit !== undefined) {
        limitNum = parseInt(limit as string, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          res.status(400).json({
            success: false,
            error: 'Invalid limit parameter',
            message: 'limit must be between 1 and 100',
          });
          return;
        }
      }

      // Parse enabled filter
      let enabledFilter: boolean | undefined = undefined;
      if (enabled !== undefined) {
        const enabledStr = (enabled as string).toLowerCase();
        if (enabledStr === 'true') {
          enabledFilter = true;
        } else if (enabledStr === 'false') {
          enabledFilter = false;
        } else {
          res.status(400).json({
            success: false,
            error: 'Invalid enabled parameter',
            message: 'enabled must be "true" or "false"',
          });
          return;
        }
      }

      // Parse search parameter
      const searchStr = search ? (search as string).trim() : undefined;

      // Query cards from repository
      const result = await this.cardRepository.findAll({
        page: pageNum,
        limit: limitNum,
        enabled: enabledFilter,
        search: searchStr,
      });

      // Format response
      const formattedCards = result.cards.map(card => ({
        uid: card.uid,
        name: card.name,
        enabled: card.enabled,
        access_start: card.access_start,
        access_end: card.access_end,
        time_slots: card.time_slots ? JSON.parse(card.time_slots) : null,
        allowed_devices: card.allowed_devices ? JSON.parse(card.allowed_devices) : null,
        cacheable: card.cacheable,
        created_at: card.created_at,
        updated_at: card.updated_at,
      }));

      // Return success response
      res.status(200).json({
        success: true,
        data: {
          cards: formattedCards,
          pagination: result.pagination,
        },
      });
    } catch (error) {
      console.error('Error in listCards controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while listing cards',
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

  /**
   * Validate time slots format
   * Each time slot must be in format "HH:MM-HH:MM"
   * 
   * @param timeSlots Array of time slot strings
   * @returns Validation result
   */
  private validateTimeSlots(timeSlots: any): { valid: boolean; message?: string } {
    // Check if it's an array
    if (!Array.isArray(timeSlots)) {
      return {
        valid: false,
        message: 'time_slots must be an array',
      };
    }

    // Validate each time slot
    const timeSlotRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])-([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

    for (const slot of timeSlots) {
      if (typeof slot !== 'string') {
        return {
          valid: false,
          message: 'Each time slot must be a string',
        };
      }

      if (!timeSlotRegex.test(slot)) {
        return {
          valid: false,
          message: `Invalid time slot format: "${slot}". Expected format: "HH:MM-HH:MM"`,
        };
      }

      // Validate that start time is before end time
      const [start, end] = slot.split('-');
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (startMinutes >= endMinutes) {
        return {
          valid: false,
          message: `Invalid time slot "${slot}": start time must be before end time`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate allowed devices
   * Each device ID must exist in the database
   * 
   * @param allowedDevices Array of device IDs
   * @returns Validation result
   */
  private async validateAllowedDevices(
    allowedDevices: any
  ): Promise<{ valid: boolean; message?: string }> {
    // Check if it's an array
    if (!Array.isArray(allowedDevices)) {
      return {
        valid: false,
        message: 'allowed_devices must be an array',
      };
    }

    // Empty array is valid (means no device restrictions)
    if (allowedDevices.length === 0) {
      return { valid: true };
    }

    // Validate each device ID
    for (const deviceId of allowedDevices) {
      if (typeof deviceId !== 'string') {
        return {
          valid: false,
          message: 'Each device ID must be a string',
        };
      }

      // Check if device exists
      const deviceExists = await this.deviceRepository.exists(deviceId);
      if (!deviceExists) {
        return {
          valid: false,
          message: `Device ID "${deviceId}" does not exist`,
        };
      }
    }

    return { valid: true };
  }
}
