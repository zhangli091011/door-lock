/**
 * Access Routes Integration Tests
 * 权限验证路由集成测试
 * 
 * Tests the complete middleware chain:
 * Rate limiting -> Authentication -> Access control
 */

import request from 'supertest';
import express, { Express } from 'express';
import { Database } from '../db';
import { createAccessRoutes } from './accessRoutes';
import { generateSignature } from '../utils/signatureUtils';

// Mock database
const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
  getLastInsertId: jest.fn(),
  close: jest.fn(),
} as unknown as Database;

describe('Access Routes Integration', () => {
  let app: Express;
  const testDevice = {
    device_id: 'door_1',
    name: '前门门禁',
    api_key: 'test_api_key_12345678901234567890',
    secret_key: 'test_secret_key_12345678901234567890',
    enabled: 1,
    mac_address: 'A4:CF:12:34:56:78',
    location: '一楼大厅',
    last_seen: new Date().toISOString(),
    firmware_version: '1.0.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const testCard = {
    uid: '04A1B2C3D4E5F6',
    name: '张三',
    enabled: 1,
    access_start: null,
    access_end: null,
    time_slots: null,
    allowed_devices: null,
    cacheable: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api', createAccessRoutes(mockDb));
  });

  describe('POST /api/check-card', () => {
    it('should successfully verify card with valid authentication and signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        uid: testCard.uid,
        device_id: testDevice.device_id,
        timestamp,
      };
      const signature = generateSignature(payload, testDevice.secret_key);

      // Mock device authentication
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce(testDevice) // Device query
        .mockResolvedValueOnce(testCard); // Card query

      // Mock execute for last_seen update and access log insert
      mockDb.execute = jest.fn().mockResolvedValue(1);
      mockDb.getLastInsertId = jest.fn().mockResolvedValue(1);

      // Mock access log query
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce(testDevice) // Device query
        .mockResolvedValueOnce(testCard) // Card query
        .mockResolvedValueOnce({
          id: 1,
          uid: testCard.uid,
          device_id: testDevice.device_id,
          timestamp: new Date().toISOString(),
          allowed: 1,
          reason: null,
          source: 'cloud',
          card_name: testCard.name,
          device_name: testDevice.name,
        });

      const response = await request(app)
        .post('/api/check-card')
        .set('X-API-Key', testDevice.api_key)
        .set('X-Device-ID', testDevice.device_id)
        .send({
          uid: testCard.uid,
          device_id: testDevice.device_id,
          timestamp,
          signature,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        allow: true,
        cacheable: true,
        card_name: testCard.name,
        message: '访问允许',
      });
    });

    it('should reject request with invalid API key', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        uid: testCard.uid,
        device_id: testDevice.device_id,
        timestamp,
      };
      const signature = generateSignature(payload, testDevice.secret_key);

      // Mock device query returns device
      mockDb.queryOne = jest.fn().mockResolvedValueOnce(testDevice);

      const response = await request(app)
        .post('/api/check-card')
        .set('X-API-Key', 'invalid_api_key')
        .set('X-Device-ID', testDevice.device_id)
        .send({
          uid: testCard.uid,
          device_id: testDevice.device_id,
          timestamp,
          signature,
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid API key',
      });
    });

    it('should reject request with invalid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000);

      // Mock device authentication
      mockDb.queryOne = jest.fn().mockResolvedValueOnce(testDevice);

      const response = await request(app)
        .post('/api/check-card')
        .set('X-API-Key', testDevice.api_key)
        .set('X-Device-ID', testDevice.device_id)
        .send({
          uid: testCard.uid,
          device_id: testDevice.device_id,
          timestamp,
          signature: 'invalid_signature',
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Signature verification failed',
      });
    });

    it('should reject request with expired timestamp', async () => {
      // Timestamp from 10 minutes ago (exceeds 5 minute window)
      const timestamp = Math.floor(Date.now() / 1000) - 600;
      const payload = {
        uid: testCard.uid,
        device_id: testDevice.device_id,
        timestamp,
      };
      const signature = generateSignature(payload, testDevice.secret_key);

      // Mock device authentication
      mockDb.queryOne = jest.fn().mockResolvedValueOnce(testDevice);

      const response = await request(app)
        .post('/api/check-card')
        .set('X-API-Key', testDevice.api_key)
        .set('X-Device-ID', testDevice.device_id)
        .send({
          uid: testCard.uid,
          device_id: testDevice.device_id,
          timestamp,
          signature,
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Signature verification failed',
      });
    });

    it('should reject request without authentication headers', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        uid: testCard.uid,
        device_id: testDevice.device_id,
        timestamp,
      };
      const signature = generateSignature(payload, testDevice.secret_key);

      const response = await request(app)
        .post('/api/check-card')
        .send({
          uid: testCard.uid,
          device_id: testDevice.device_id,
          timestamp,
          signature,
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Missing authentication headers',
      });
    });

    it('should deny access for disabled card', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        uid: testCard.uid,
        device_id: testDevice.device_id,
        timestamp,
      };
      const signature = generateSignature(payload, testDevice.secret_key);

      const disabledCard = { ...testCard, enabled: 0 };

      // Mock device authentication and card query
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce(testDevice) // Device query
        .mockResolvedValueOnce(disabledCard); // Card query

      // Mock execute for last_seen update and access log insert
      mockDb.execute = jest.fn().mockResolvedValue(1);
      mockDb.getLastInsertId = jest.fn().mockResolvedValue(1);

      // Mock access log query
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce(testDevice) // Device query
        .mockResolvedValueOnce(disabledCard) // Card query
        .mockResolvedValueOnce({
          id: 1,
          uid: testCard.uid,
          device_id: testDevice.device_id,
          timestamp: new Date().toISOString(),
          allowed: 0,
          reason: '卡片已禁用',
          source: 'cloud',
          card_name: testCard.name,
          device_name: testDevice.name,
        });

      const response = await request(app)
        .post('/api/check-card')
        .set('X-API-Key', testDevice.api_key)
        .set('X-Device-ID', testDevice.device_id)
        .send({
          uid: testCard.uid,
          device_id: testDevice.device_id,
          timestamp,
          signature,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        allow: false,
        cacheable: false,
        card_name: testCard.name,
        reason: '卡片已禁用',
        message: '访问拒绝',
      });
    });
  });
});
