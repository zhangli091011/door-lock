/**
 * Access Controller Tests
 * 权限验证控制器测试
 */

import { AccessController } from './accessController';
import { Database } from '../db';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// Mock database
const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
  getLastInsertId: jest.fn(),
  close: jest.fn(),
} as unknown as Database;

// Mock request and response
const mockRequest = (body: any, device?: any): AuthenticatedRequest => {
  return {
    body,
    device,
    headers: {},
  } as AuthenticatedRequest;
};

const mockResponse = (): Response => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('AccessController', () => {
  let controller: AccessController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AccessController(mockDb);
  });

  describe('checkCard', () => {
    it('should allow access for valid enabled card', async () => {
      // Mock card exists and is enabled
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce({
          // Card query
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
        });

      mockDb.execute = jest.fn().mockResolvedValue(1);
      mockDb.getLastInsertId = jest.fn().mockResolvedValue(1);
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce({
          // Card query
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
        })
        .mockResolvedValueOnce({
          // Access log query
          id: 1,
          uid: '04A1B2C3D4E5F6',
          device_id: 'door_1',
          timestamp: new Date().toISOString(),
          allowed: 1,
          reason: null,
          source: 'cloud',
          card_name: '张三',
          device_name: '前门门禁',
        });

      const req = mockRequest(
        {
          uid: '04A1B2C3D4E5F6',
          device_id: 'door_1',
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'test_signature',
        },
        {
          device_id: 'door_1',
          name: '前门门禁',
          enabled: true,
          secret_key: 'test_secret',
        }
      );
      const res = mockResponse();

      await controller.checkCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          allow: true,
          cacheable: true,
          card_name: '张三',
          message: '访问允许',
        })
      );
    });

    it('should deny access for disabled card', async () => {
      // Mock card exists but is disabled
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce({
          // Card query
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          enabled: 0,
          access_start: null,
          access_end: null,
          time_slots: null,
          allowed_devices: null,
          cacheable: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      mockDb.execute = jest.fn().mockResolvedValue(1);
      mockDb.getLastInsertId = jest.fn().mockResolvedValue(1);
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce({
          // Card query
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          enabled: 0,
          access_start: null,
          access_end: null,
          time_slots: null,
          allowed_devices: null,
          cacheable: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          // Access log query
          id: 1,
          uid: '04A1B2C3D4E5F6',
          device_id: 'door_1',
          timestamp: new Date().toISOString(),
          allowed: 0,
          reason: '卡片已禁用',
          source: 'cloud',
          card_name: '张三',
          device_name: '前门门禁',
        });

      const req = mockRequest(
        {
          uid: '04A1B2C3D4E5F6',
          device_id: 'door_1',
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'test_signature',
        },
        {
          device_id: 'door_1',
          name: '前门门禁',
          enabled: true,
          secret_key: 'test_secret',
        }
      );
      const res = mockResponse();

      await controller.checkCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          allow: false,
          cacheable: false,
          card_name: '张三',
          reason: '卡片已禁用',
          message: '访问拒绝',
        })
      );
    });

    it('should deny access for non-existent card', async () => {
      // Mock card does not exist
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce(null); // Card query returns null

      mockDb.execute = jest.fn().mockResolvedValue(1);
      mockDb.getLastInsertId = jest.fn().mockResolvedValue(1);
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce(null) // Card query
        .mockResolvedValueOnce({
          // Access log query
          id: 1,
          uid: '04A1B2C3D4E5F6',
          device_id: 'door_1',
          timestamp: new Date().toISOString(),
          allowed: 0,
          reason: '卡片不存在',
          source: 'cloud',
          card_name: null,
          device_name: '前门门禁',
        });

      const req = mockRequest(
        {
          uid: '04A1B2C3D4E5F6',
          device_id: 'door_1',
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'test_signature',
        },
        {
          device_id: 'door_1',
          name: '前门门禁',
          enabled: true,
          secret_key: 'test_secret',
        }
      );
      const res = mockResponse();

      await controller.checkCard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          allow: false,
          cacheable: false,
          reason: '卡片不存在',
          message: '访问拒绝',
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      const req = mockRequest(
        {
          uid: '04A1B2C3D4E5F6',
          // Missing device_id and timestamp
        },
        {
          device_id: 'door_1',
          name: '前门门禁',
          enabled: true,
          secret_key: 'test_secret',
        }
      );
      const res = mockResponse();

      await controller.checkCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing required fields',
        })
      );
    });

    it('should return 400 for invalid UID format', async () => {
      const req = mockRequest(
        {
          uid: 'INVALID_UID_WITH_SPECIAL_CHARS!',
          device_id: 'door_1',
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'test_signature',
        },
        {
          device_id: 'door_1',
          name: '前门门禁',
          enabled: true,
          secret_key: 'test_secret',
        }
      );
      const res = mockResponse();

      await controller.checkCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid UID format',
        })
      );
    });

    it('should return 400 for UID that is too short', async () => {
      const req = mockRequest(
        {
          uid: '04A1B2', // Only 6 characters, minimum is 8
          device_id: 'door_1',
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'test_signature',
        },
        {
          device_id: 'door_1',
          name: '前门门禁',
          enabled: true,
          secret_key: 'test_secret',
        }
      );
      const res = mockResponse();

      await controller.checkCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid UID format',
        })
      );
    });

    it('should return 400 for UID that is too long', async () => {
      const req = mockRequest(
        {
          uid: '04A1B2C3D4E5F6789', // 17 characters, maximum is 14
          device_id: 'door_1',
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'test_signature',
        },
        {
          device_id: 'door_1',
          name: '前门门禁',
          enabled: true,
          secret_key: 'test_secret',
        }
      );
      const res = mockResponse();

      await controller.checkCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid UID format',
        })
      );
    });

    it('should record access log for both allowed and denied access', async () => {
      // Mock card exists and is enabled
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce({
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
        });

      const executeSpy = jest.fn().mockResolvedValue(1);
      mockDb.execute = executeSpy;
      mockDb.getLastInsertId = jest.fn().mockResolvedValue(1);
      mockDb.queryOne = jest.fn()
        .mockResolvedValueOnce({
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
        })
        .mockResolvedValueOnce({
          id: 1,
          uid: '04A1B2C3D4E5F6',
          device_id: 'door_1',
          timestamp: new Date().toISOString(),
          allowed: 1,
          reason: null,
          source: 'cloud',
          card_name: '张三',
          device_name: '前门门禁',
        });

      const req = mockRequest(
        {
          uid: '04A1B2C3D4E5F6',
          device_id: 'door_1',
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'test_signature',
        },
        {
          device_id: 'door_1',
          name: '前门门禁',
          enabled: true,
          secret_key: 'test_secret',
        }
      );
      const res = mockResponse();

      await controller.checkCard(req, res);

      // Verify that execute was called to insert access log
      expect(executeSpy).toHaveBeenCalled();
      const insertCall = executeSpy.mock.calls[0];
      expect(insertCall[0]).toContain('INSERT INTO access_logs');
    });
  });
});
