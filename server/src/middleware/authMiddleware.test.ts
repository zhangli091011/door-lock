/**
 * Device Authentication Middleware Tests
 * 设备认证中间件测试
 */

import { Response } from 'express';
import { Database, DatabaseType } from '../db';
import { DeviceRepository } from '../repositories/DeviceRepository';
import { createDeviceAuthMiddleware, AuthenticatedRequest } from './authMiddleware';
import { generateSignature } from '../utils/signatureUtils';

// Mock database
let db: Database;
let deviceRepo: DeviceRepository;

// Mock Express objects
const mockRequest = (headers: any = {}, body: any = {}): Partial<AuthenticatedRequest> => ({
  headers,
  body,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe('Device Authentication Middleware', () => {
  beforeAll(async () => {
    // Create in-memory SQLite database for testing
    db = new Database({
      type: DatabaseType.SQLITE,
      sqlitePath: ':memory:',
    });

    // Initialize database schema
    await db.execute(`
      CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        mac_address TEXT UNIQUE,
        api_key TEXT NOT NULL UNIQUE,
        secret_key TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        last_seen DATETIME,
        firmware_version TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    deviceRepo = new DeviceRepository(db);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clear devices table before each test
    await db.execute('DELETE FROM devices');
    jest.clearAllMocks();
  });

  describe('Authentication Success', () => {
    it('should authenticate valid device with correct API key (no signature required)', async () => {
      // Create test device
      await deviceRepo.create({
        device_id: 'test_device_1',
        name: 'Test Device',
        api_key: 'test_api_key_123',
        secret_key: 'test_secret_key_123',
        enabled: true,
      });

      const middleware = createDeviceAuthMiddleware(db, false); // Disable signature requirement
      const req = mockRequest({
        'x-api-key': 'test_api_key_123',
        'x-device-id': 'test_device_1',
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.device).toBeDefined();
      expect(req.device?.device_id).toBe('test_device_1');
      expect(req.device?.name).toBe('Test Device');
      expect(req.device?.enabled).toBe(true);
    });

    it('should update device last_seen timestamp', async () => {
      // Create test device
      await deviceRepo.create({
        device_id: 'test_device_2',
        name: 'Test Device 2',
        api_key: 'test_api_key_456',
        secret_key: 'test_secret_key_456',
        enabled: true,
      });

      const middleware = createDeviceAuthMiddleware(db, false);
      const req = mockRequest({
        'x-api-key': 'test_api_key_456',
        'x-device-id': 'test_device_2',
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      // Get initial last_seen
      const deviceBefore = await deviceRepo.findById('test_device_2');
      const lastSeenBefore = deviceBefore?.last_seen;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await middleware(req, res, next);

      // Get updated last_seen
      const deviceAfter = await deviceRepo.findById('test_device_2');
      const lastSeenAfter = deviceAfter?.last_seen;

      expect(next).toHaveBeenCalled();
      expect(lastSeenAfter).toBeDefined();
      if (lastSeenBefore && lastSeenAfter) {
        expect(lastSeenAfter.getTime()).toBeGreaterThan(lastSeenBefore.getTime());
      }
    });
  });

  describe('Authentication Failures', () => {
    it('should reject request with missing X-API-Key header', async () => {
      const middleware = createDeviceAuthMiddleware(db, false);
      const req = mockRequest({
        'x-device-id': 'test_device_1',
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing authentication headers',
        message: 'X-API-Key and X-Device-ID headers are required',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with missing X-Device-ID header', async () => {
      const middleware = createDeviceAuthMiddleware(db, false);
      const req = mockRequest({
        'x-api-key': 'test_api_key_123',
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing authentication headers',
        message: 'X-API-Key and X-Device-ID headers are required',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with non-existent device ID', async () => {
      const middleware = createDeviceAuthMiddleware(db, false);
      const req = mockRequest({
        'x-api-key': 'test_api_key_123',
        'x-device-id': 'non_existent_device',
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid device ID',
        message: 'Device not found',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with incorrect API key', async () => {
      // Create test device
      await deviceRepo.create({
        device_id: 'test_device_3',
        name: 'Test Device 3',
        api_key: 'correct_api_key',
        secret_key: 'test_secret_key',
        enabled: true,
      });

      const middleware = createDeviceAuthMiddleware(db, false);
      const req = mockRequest({
        'x-api-key': 'wrong_api_key',
        'x-device-id': 'test_device_3',
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid API key',
        message: 'API Key does not match device ID',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request for disabled device', async () => {
      // Create disabled test device
      await deviceRepo.create({
        device_id: 'test_device_4',
        name: 'Test Device 4',
        api_key: 'test_api_key_789',
        secret_key: 'test_secret_key_789',
        enabled: false,
      });

      const middleware = createDeviceAuthMiddleware(db, false);
      const req = mockRequest({
        'x-api-key': 'test_api_key_789',
        'x-device-id': 'test_device_4',
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Device disabled',
        message: 'This device has been disabled',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Create a middleware with a closed database to simulate error
      const closedDb = new Database({
        type: DatabaseType.SQLITE,
        sqlitePath: ':memory:',
      });
      await closedDb.close();

      const middleware = createDeviceAuthMiddleware(closedDb, false);
      const req = mockRequest({
        'x-api-key': 'test_api_key',
        'x-device-id': 'test_device',
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred during authentication',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Signature Verification', () => {
    const testSecretKey = 'test_secret_key_for_signature';
    const testApiKey = 'test_api_key_signature';
    const testDeviceId = 'test_device_sig';

    beforeEach(async () => {
      // Create test device with known secret key
      await deviceRepo.create({
        device_id: testDeviceId,
        name: 'Test Device Signature',
        api_key: testApiKey,
        secret_key: testSecretKey,
        enabled: true,
      });
    });

    it('should authenticate request with valid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const uid = '04A1B2C3D4E5F6';
      
      const signature = generateSignature(
        { uid, device_id: testDeviceId, timestamp },
        testSecretKey
      );

      const middleware = createDeviceAuthMiddleware(db, true); // Enable signature verification
      const req = mockRequest(
        {
          'x-api-key': testApiKey,
          'x-device-id': testDeviceId,
        },
        {
          uid,
          device_id: testDeviceId,
          timestamp,
          signature,
        }
      ) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.device).toBeDefined();
      expect(req.device?.device_id).toBe(testDeviceId);
    });

    it('should reject request with missing signature field', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const uid = '04A1B2C3D4E5F6';

      const middleware = createDeviceAuthMiddleware(db, true);
      const req = mockRequest(
        {
          'x-api-key': testApiKey,
          'x-device-id': testDeviceId,
        },
        {
          uid,
          device_id: testDeviceId,
          timestamp,
          // Missing signature
        }
      ) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing signature fields',
        message: 'uid, device_id, timestamp, and signature are required in request body',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with missing uid field', async () => {
      const timestamp = Math.floor(Date.now() / 1000);

      const middleware = createDeviceAuthMiddleware(db, true);
      const req = mockRequest(
        {
          'x-api-key': testApiKey,
          'x-device-id': testDeviceId,
        },
        {
          // Missing uid
          device_id: testDeviceId,
          timestamp,
          signature: 'dummy_signature',
        }
      ) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid timestamp type', async () => {
      const uid = '04A1B2C3D4E5F6';

      const middleware = createDeviceAuthMiddleware(db, true);
      const req = mockRequest(
        {
          'x-api-key': testApiKey,
          'x-device-id': testDeviceId,
        },
        {
          uid,
          device_id: testDeviceId,
          timestamp: 'not_a_number', // Invalid timestamp
          signature: 'dummy_signature',
        }
      ) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid timestamp',
        message: 'timestamp must be a valid Unix timestamp (number)',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with device_id mismatch between header and body', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const uid = '04A1B2C3D4E5F6';

      const middleware = createDeviceAuthMiddleware(db, true);
      const req = mockRequest(
        {
          'x-api-key': testApiKey,
          'x-device-id': testDeviceId,
        },
        {
          uid,
          device_id: 'different_device_id', // Mismatch
          timestamp,
          signature: 'dummy_signature',
        }
      ) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Device ID mismatch',
        message: 'device_id in body must match X-Device-ID header',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const uid = '04A1B2C3D4E5F6';
      const invalidSignature = 'a'.repeat(64); // Invalid signature

      const middleware = createDeviceAuthMiddleware(db, true);
      const req = mockRequest(
        {
          'x-api-key': testApiKey,
          'x-device-id': testDeviceId,
        },
        {
          uid,
          device_id: testDeviceId,
          timestamp,
          signature: invalidSignature,
        }
      ) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Signature verification failed',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with expired timestamp (older than 5 minutes)', async () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
      const uid = '04A1B2C3D4E5F6';
      
      const signature = generateSignature(
        { uid, device_id: testDeviceId, timestamp: expiredTimestamp },
        testSecretKey
      );

      const middleware = createDeviceAuthMiddleware(db, true);
      const req = mockRequest(
        {
          'x-api-key': testApiKey,
          'x-device-id': testDeviceId,
        },
        {
          uid,
          device_id: testDeviceId,
          timestamp: expiredTimestamp,
          signature,
        }
      ) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Signature verification failed',
          message: expect.stringContaining('timestamp expired'),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with tampered payload (signature mismatch)', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const uid = '04A1B2C3D4E5F6';
      
      // Generate signature for original UID
      const signature = generateSignature(
        { uid, device_id: testDeviceId, timestamp },
        testSecretKey
      );

      const middleware = createDeviceAuthMiddleware(db, true);
      const req = mockRequest(
        {
          'x-api-key': testApiKey,
          'x-device-id': testDeviceId,
        },
        {
          uid: 'TAMPERED_UID', // Changed UID after signing
          device_id: testDeviceId,
          timestamp,
          signature,
        }
      ) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Signature verification failed',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow bypassing signature verification when requireSignature is false', async () => {
      const middleware = createDeviceAuthMiddleware(db, false); // Disable signature verification
      const req = mockRequest(
        {
          'x-api-key': testApiKey,
          'x-device-id': testDeviceId,
        },
        {
          // No signature fields needed
        }
      ) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.device).toBeDefined();
    });
  });
});
