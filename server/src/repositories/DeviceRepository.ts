/**
 * Device Repository
 * 设备数据访问层
 * 
 * Implements CRUD operations for Device model
 */

import { Database } from '../db';
import { Device, CreateDeviceInput, UpdateDeviceInput, DeviceWithStatus } from '../models/Device';

export class DeviceRepository {
  constructor(private db: Database) {}

  /**
   * Find device by device_id
   * @param deviceId Device ID
   * @returns Device or null if not found
   */
  async findById(deviceId: string): Promise<Device | null> {
    const sql = `
      SELECT device_id, name, location, mac_address, api_key, secret_key,
             enabled, last_seen, firmware_version, created_at, updated_at
      FROM devices
      WHERE device_id = ?
    `;
    
    const row = await this.db.queryOne(sql, [deviceId]);
    return row ? this.mapRowToDevice(row) : null;
  }

  /**
   * Find device by API key
   * @param apiKey API Key
   * @returns Device or null if not found
   */
  async findByApiKey(apiKey: string): Promise<Device | null> {
    const sql = `
      SELECT device_id, name, location, mac_address, api_key, secret_key,
             enabled, last_seen, firmware_version, created_at, updated_at
      FROM devices
      WHERE api_key = ?
    `;
    
    const row = await this.db.queryOne(sql, [apiKey]);
    return row ? this.mapRowToDevice(row) : null;
  }

  /**
   * Find all devices
   * @returns Array of devices
   */
  async findAll(): Promise<Device[]> {
    const sql = `
      SELECT device_id, name, location, mac_address, api_key, secret_key,
             enabled, last_seen, firmware_version, created_at, updated_at
      FROM devices
      ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(sql);
    return result.rows.map(row => this.mapRowToDevice(row));
  }

  /**
   * Find all devices with online status
   * A device is considered online if last_seen is within 5 minutes
   * @returns Array of devices with online status
   */
  async findAllWithStatus(): Promise<DeviceWithStatus[]> {
    const devices = await this.findAll();
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    return devices.map(device => ({
      ...device,
      is_online: device.last_seen ? device.last_seen >= fiveMinutesAgo : false,
    }));
  }

  /**
   * Create a new device
   * @param input Device creation input
   * @returns Created device
   */
  async create(input: CreateDeviceInput): Promise<Device> {
    const {
      device_id,
      name,
      location = null,
      mac_address = null,
      api_key,
      secret_key,
      enabled = true,
      firmware_version = null,
    } = input;

    const sql = `
      INSERT INTO devices (device_id, name, location, mac_address, api_key, 
                          secret_key, enabled, firmware_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      device_id,
      name,
      location,
      mac_address,
      api_key,
      secret_key,
      enabled ? 1 : 0,
      firmware_version,
    ];

    await this.db.execute(sql, params);

    // Fetch and return the created device
    const device = await this.findById(device_id);
    if (!device) {
      throw new Error('Failed to create device');
    }

    return device;
  }

  /**
   * Update an existing device
   * @param deviceId Device ID
   * @param input Device update input
   * @returns Updated device or null if not found
   */
  async update(deviceId: string, input: UpdateDeviceInput): Promise<Device | null> {
    // Check if device exists
    const existingDevice = await this.findById(deviceId);
    if (!existingDevice) {
      return null;
    }

    // Build UPDATE clause dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }

    if (input.location !== undefined) {
      updates.push('location = ?');
      params.push(input.location);
    }

    if (input.mac_address !== undefined) {
      updates.push('mac_address = ?');
      params.push(input.mac_address);
    }

    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(input.enabled ? 1 : 0);
    }

    if (input.last_seen !== undefined) {
      updates.push('last_seen = ?');
      params.push(input.last_seen);
    }

    if (input.firmware_version !== undefined) {
      updates.push('firmware_version = ?');
      params.push(input.firmware_version);
    }

    if (updates.length === 0) {
      // No updates to perform
      return existingDevice;
    }

    // Add updated_at timestamp
    updates.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `
      UPDATE devices
      SET ${updates.join(', ')}
      WHERE device_id = ?
    `;

    params.push(deviceId);
    await this.db.execute(sql, params);

    // Fetch and return the updated device
    return await this.findById(deviceId);
  }

  /**
   * Update device last_seen timestamp
   * @param deviceId Device ID
   * @returns True if updated, false if not found
   */
  async updateLastSeen(deviceId: string): Promise<boolean> {
    const sql = `
      UPDATE devices
      SET last_seen = CURRENT_TIMESTAMP
      WHERE device_id = ?
    `;

    const affectedRows = await this.db.execute(sql, [deviceId]);
    return affectedRows > 0;
  }

  /**
   * Delete a device
   * @param deviceId Device ID
   * @returns True if deleted, false if not found
   */
  async delete(deviceId: string): Promise<boolean> {
    const sql = 'DELETE FROM devices WHERE device_id = ?';
    const affectedRows = await this.db.execute(sql, [deviceId]);
    return affectedRows > 0;
  }

  /**
   * Check if a device exists
   * @param deviceId Device ID
   * @returns True if exists, false otherwise
   */
  async exists(deviceId: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM devices WHERE device_id = ? LIMIT 1';
    const result = await this.db.queryOne(sql, [deviceId]);
    return result !== null;
  }

  /**
   * Check if an API key exists
   * @param apiKey API Key
   * @returns True if exists, false otherwise
   */
  async apiKeyExists(apiKey: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM devices WHERE api_key = ? LIMIT 1';
    const result = await this.db.queryOne(sql, [apiKey]);
    return result !== null;
  }

  /**
   * Check if a MAC address exists
   * @param macAddress MAC Address
   * @returns True if exists, false otherwise
   */
  async macAddressExists(macAddress: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM devices WHERE mac_address = ? LIMIT 1';
    const result = await this.db.queryOne(sql, [macAddress]);
    return result !== null;
  }

  /**
   * Get count of online devices (last_seen within 5 minutes)
   * @returns Number of online devices
   */
  async countOnline(): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const sql = `
      SELECT COUNT(*) as count 
      FROM devices 
      WHERE last_seen >= ? AND enabled = 1
    `;
    const result = await this.db.queryOne(sql, [fiveMinutesAgo.toISOString()]);
    return result ? result.count : 0;
  }

  /**
   * Get total count of devices
   * @returns Total number of devices
   */
  async countTotal(): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM devices';
    const result = await this.db.queryOne(sql);
    return result ? result.count : 0;
  }

  /**
   * Map database row to Device object
   * Handles boolean conversion for SQLite
   */
  private mapRowToDevice(row: any): Device {
    return {
      device_id: row.device_id,
      name: row.name,
      location: row.location,
      mac_address: row.mac_address,
      api_key: row.api_key,
      secret_key: row.secret_key,
      enabled: Boolean(row.enabled),
      last_seen: row.last_seen ? new Date(row.last_seen) : null,
      firmware_version: row.firmware_version,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
