/**
 * Device Routes Integration Tests
 * 设备路由集成测试
 * 
 * Tests for device management routes
 */

// Set JWT secret for testing BEFORE importing modules
process.env.JWT_SECRET = 'test_secret_key_for_device_routes_testing';

import express, { Express } from 'express';
import request from 'supertest';
import { Database } from '../db';
import { createDeviceRoutes } from './deviceRoutes';
import jwt from 'jsonwebtoken';

// Mock database
const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  close: jest.fn(),
} as unknown as Database;

describe('Device Routes Integration Tests', () => {
  let app: Express;
  let validToken: string;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/devices', createDeviceRoutes(mockDb));

    // Generate valid JWT token
    validToken = jwt.sign(
      { id: 1, username: 'admin' },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
  });

  describe('POST /api/devices', () => {
    it('should register a new device with valid JWT token', async () => {
      // Mock database responses
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce(null) // Device doesn't exist
        .mockResolvedValueOnce(null) // MAC address doesn't exist
        .mockResolvedValueOnce({     // Return created device
          device_id: 'door_1',
          name: '前门门禁',
          location: '一楼大厅',
          mac_address: 'A4:CF:12:34:56:78',
          api_key: 'test_api_key_32_characters_long',
          secret_key: 'test_secret_key_32_chars_long',
          enabled: 1,
          last_seen: null,
          firmware_version: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      mockDb.execute = jest.fn().mockResolvedValue(1);

      const response = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          device_id: 'door_1',
          name: '前门门禁',
          location: '一楼大厅',
          mac_address: 'A4:CF:12:34:56:78',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: '设备注册成功',
        data: {
          device_id: 'door_1',
          name: '前门门禁',
          api_key: expect.any(String),
          secret_key: expect.any(String),
        },
      });
    });

    it('should reject request without JWT token', async () => {
      const response = await request(app)
        .post('/api/devices')
        .send({
          device_id: 'door_1',
          name: '前门门禁',
        });

      expect(response.status).toBe(401);
    });

    it('should reject device with invalid device_id', async () => {
      const response = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          device_id: 'door@1',  // Invalid character
          name: '前门门禁',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid device_id format');
    });
  });

  describe('PUT /api/devices/:deviceId', () => {
    it('should update an existing device', async () => {
      // Mock database responses - queryOne is called multiple times:
      // 1. findById to check if device exists
      // 2. (possibly) macAddressExists if MAC is being updated
      // 3. findById after update to return updated device
      const existingDevice = {
        device_id: 'door_1',
        name: '前门门禁',
        location: '一楼大厅',
        mac_address: 'A4:CF:12:34:56:78',
        api_key: 'test_api_key',
        secret_key: 'test_secret_key',
        enabled: 1,
        last_seen: null,
        firmware_version: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updatedDevice = {
        ...existingDevice,
        name: '前门门禁（已更新）',
        enabled: 0,
        updated_at: new Date().toISOString(),
      };

      // Mock queryOne for findById calls
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce(existingDevice)  // First: check if device exists
        .mockResolvedValueOnce(updatedDevice);  // Second: return updated device

      // Mock execute for UPDATE statement
      mockDb.execute = jest.fn().mockResolvedValue(1);

      const response = await request(app)
        .put('/api/devices/door_1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: '前门门禁（已更新）',
          enabled: false,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: '设备更新成功',
      });
    });

    it('should return 404 for non-existent device', async () => {
      mockDb.queryOne = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put('/api/devices/door_999')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: '不存在的设备',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Device not found');
    });
  });

  describe('GET /api/devices', () => {
    it('should list all devices with online status', async () => {
      const now = new Date();
      const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      // Mock database response for findAll (which is called by findAllWithStatus)
      mockDb.query = jest.fn().mockResolvedValue({
        rows: [
          {
            device_id: 'door_1',
            name: '前门门禁',
            location: '一楼大厅',
            mac_address: 'A4:CF:12:34:56:78',
            api_key: 'test_api_key_1',
            secret_key: 'test_secret_key_1',
            enabled: 1,
            last_seen: fourMinutesAgo.toISOString(),  // Within 5 minutes - should be online
            firmware_version: '1.0.0',
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          },
          {
            device_id: 'door_2',
            name: '后门门禁',
            location: '一楼后门',
            mac_address: 'A4:CF:12:34:56:79',
            api_key: 'test_api_key_2',
            secret_key: 'test_secret_key_2',
            enabled: 1,
            last_seen: tenMinutesAgo.toISOString(),  // More than 5 minutes - should be offline
            firmware_version: '1.0.0',
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          },
        ],
      });

      const response = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.devices).toHaveLength(2);
      
      // Verify online status calculation
      expect(response.body.data.devices[0].is_online).toBe(true);
      expect(response.body.data.devices[1].is_online).toBe(false);

      // Verify secret_key is not exposed
      response.body.data.devices.forEach((device: any) => {
        expect(device).not.toHaveProperty('secret_key');
      });
    });

    it('should reject request without JWT token', async () => {
      const response = await request(app).get('/api/devices');

      expect(response.status).toBe(401);
    });
  });
});
