/**
 * Device Controller
 * 设备管理控制器
 * 
 * Handles device management endpoints:
 * - POST /api/devices - Register new device
 * - PUT /api/devices/:deviceId - Update device
 * - GET /api/devices - List devices with status
 * 
 * Requirements: 7.1, 7.2, 7.4, 7.6
 */

import { Request, Response } from 'express';
import { Database } from '../db';
import { DeviceRepository } from '../repositories/DeviceRepository';
import { CreateDeviceInput } from '../models/Device';
import * as crypto from 'crypto';

/**
 * Register device request body
 */
export interface RegisterDeviceRequest {
  device_id: string;
  name: string;
  location?: string | null;
  mac_address?: string | null;
}

/**
 * Update device request body
 */
export interface UpdateDeviceRequest {
  name?: string;
  location?: string | null;
  mac_address?: string | null;
  enabled?: boolean;
  firmware_version?: string | null;
}

/**
 * Device Controller
 */
export class DeviceController {
  private deviceRepository: DeviceRepository;

  constructor(db: Database) {
    this.deviceRepository = new DeviceRepository(db);
  }

  /**
   * POST /api/devices
   * Register a new device
   * 
   * Validates:
   * - Device ID format and uniqueness
   * - MAC address format and uniqueness
   * 
   * Generates:
   * - Random API Key (32 characters)
   * - Random Secret Key (32 characters)
   * 
   * Requirements: 7.1, 7.2
   */
  async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      const {
        device_id,
        name,
        location = null,
        mac_address = null,
      } = req.body as RegisterDeviceRequest;

      // Validate required fields
      if (!device_id || !name) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'device_id and name are required',
        });
        return;
      }

      // Validate device_id format (alphanumeric, underscore, hyphen only)
      if (!this.isValidDeviceId(device_id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid device_id format',
          message: 'device_id must contain only letters, numbers, underscores, and hyphens',
        });
        return;
      }

      // Validate device_id uniqueness
      const existingDevice = await this.deviceRepository.exists(device_id);
      if (existingDevice) {
        res.status(409).json({
          success: false,
          error: 'Device ID already exists',
          message: 'A device with this ID already exists',
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

      // Validate MAC address format if provided
      if (mac_address !== null && mac_address !== undefined) {
        if (!this.isValidMacAddress(mac_address)) {
          res.status(400).json({
            success: false,
            error: 'Invalid MAC address format',
            message: 'MAC address must be in format XX:XX:XX:XX:XX:XX',
          });
          return;
        }

        // Validate MAC address uniqueness
        const macExists = await this.deviceRepository.macAddressExists(mac_address);
        if (macExists) {
          res.status(409).json({
            success: false,
            error: 'MAC address already exists',
            message: 'A device with this MAC address already exists',
          });
          return;
        }
      }

      // Generate random API Key (32 characters)
      const apiKey = this.generateRandomKey(32);

      // Generate random Secret Key (32 characters)
      const secretKey = this.generateRandomKey(32);

      // Create device input
      const deviceInput: CreateDeviceInput = {
        device_id,
        name: name.trim(),
        location: location ? location.trim() : null,
        mac_address,
        api_key: apiKey,
        secret_key: secretKey,
        enabled: true,
      };

      // Insert device into database
      const device = await this.deviceRepository.create(deviceInput);

      // Return success response with API Key and Secret Key
      res.status(201).json({
        success: true,
        message: '设备注册成功',
        data: {
          device_id: device.device_id,
          name: device.name,
          api_key: device.api_key,
          secret_key: device.secret_key,
          created_at: device.created_at,
        },
      });
    } catch (error) {
      console.error('Error in registerDevice controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while registering the device',
      });
    }
  }

  /**
   * PUT /api/devices/:deviceId
   * Update an existing device
   * 
   * Validates:
   * - Device existence
   * - Update data format
   * - MAC address format and uniqueness
   * 
   * Requirements: 7.6
   */
  async updateDevice(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const {
        name,
        location,
        mac_address,
        enabled,
        firmware_version,
      } = req.body as UpdateDeviceRequest;

      // Validate device_id format
      if (!this.isValidDeviceId(deviceId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid device_id format',
          message: 'device_id must contain only letters, numbers, underscores, and hyphens',
        });
        return;
      }

      // Check if device exists
      const existingDevice = await this.deviceRepository.findById(deviceId);
      if (!existingDevice) {
        res.status(404).json({
          success: false,
          error: 'Device not found',
          message: 'A device with this ID does not exist',
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

      // Validate MAC address if provided
      if (mac_address !== undefined && mac_address !== null) {
        if (!this.isValidMacAddress(mac_address)) {
          res.status(400).json({
            success: false,
            error: 'Invalid MAC address format',
            message: 'MAC address must be in format XX:XX:XX:XX:XX:XX',
          });
          return;
        }

        // Check if MAC address is already used by another device
        if (mac_address !== existingDevice.mac_address) {
          const macExists = await this.deviceRepository.macAddressExists(mac_address);
          if (macExists) {
            res.status(409).json({
              success: false,
              error: 'MAC address already exists',
              message: 'Another device with this MAC address already exists',
            });
            return;
          }
        }
      }

      // Build update input
      const updateInput: any = {};
      if (name !== undefined) updateInput.name = name.trim();
      if (location !== undefined) updateInput.location = location ? location.trim() : null;
      if (mac_address !== undefined) updateInput.mac_address = mac_address;
      if (enabled !== undefined) updateInput.enabled = enabled;
      if (firmware_version !== undefined) updateInput.firmware_version = firmware_version;

      // Update device in database
      const updatedDevice = await this.deviceRepository.update(deviceId, updateInput);

      if (!updatedDevice) {
        res.status(500).json({
          success: false,
          error: 'Update failed',
          message: 'Failed to update device',
        });
        return;
      }

      // Return success response (do not include secret_key in response)
      res.status(200).json({
        success: true,
        message: '设备更新成功',
        data: {
          device_id: updatedDevice.device_id,
          name: updatedDevice.name,
          location: updatedDevice.location,
          mac_address: updatedDevice.mac_address,
          enabled: updatedDevice.enabled,
          updated_at: updatedDevice.updated_at,
        },
      });
    } catch (error) {
      console.error('Error in updateDevice controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while updating the device',
      });
    }
  }

  /**
   * GET /api/devices
   * List all devices with online status
   * 
   * Returns:
   * - devices: Array of device objects with online status
   * 
   * Online status: last_seen within 5 minutes
   * 
   * Requirements: 7.4, 9.5
   */
  async listDevices(_req: Request, res: Response): Promise<void> {
    try {
      // Query devices with status from repository
      const devicesWithStatus = await this.deviceRepository.findAllWithStatus();

      // Format response (exclude secret_key for security)
      const formattedDevices = devicesWithStatus.map(device => ({
        device_id: device.device_id,
        name: device.name,
        location: device.location,
        mac_address: device.mac_address,
        enabled: device.enabled,
        is_online: device.is_online,
        last_seen: device.last_seen,
        firmware_version: device.firmware_version,
        created_at: device.created_at,
        updated_at: device.updated_at,
      }));

      // Return success response
      res.status(200).json({
        success: true,
        data: {
          devices: formattedDevices,
        },
      });
    } catch (error) {
      console.error('Error in listDevices controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while listing devices',
      });
    }
  }

  /**
   * Validate device_id format
   * Device ID must contain only letters, numbers, underscores, and hyphens
   * 
   * @param deviceId Device ID
   * @returns True if valid, false otherwise
   */
  private isValidDeviceId(deviceId: string): boolean {
    // Check if contains only alphanumeric, underscore, and hyphen
    const deviceIdRegex = /^[a-zA-Z0-9_-]+$/;
    return deviceIdRegex.test(deviceId) && deviceId.length > 0 && deviceId.length <= 50;
  }

  /**
   * Validate MAC address format
   * MAC address must be in format XX:XX:XX:XX:XX:XX
   * 
   * @param macAddress MAC address
   * @returns True if valid, false otherwise
   */
  private isValidMacAddress(macAddress: string): boolean {
    // Check MAC address format (XX:XX:XX:XX:XX:XX)
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    return macRegex.test(macAddress);
  }

  /**
   * Generate a random key
   * 
   * @param length Key length in characters
   * @returns Random hexadecimal string
   */
  private generateRandomKey(length: number): string {
    // Generate random bytes (length/2 because each byte = 2 hex chars)
    const bytes = crypto.randomBytes(Math.ceil(length / 2));
    // Convert to hexadecimal string and trim to exact length
    return bytes.toString('hex').slice(0, length);
  }
}
