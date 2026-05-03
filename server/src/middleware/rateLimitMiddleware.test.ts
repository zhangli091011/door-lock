/**
 * Rate Limiting Middleware Tests
 * 速率限制中间件测试
 */

import { Request, Response, NextFunction } from 'express';
import {
  deviceRateLimitMiddleware,
  ipRateLimitMiddleware,
  rateLimitMiddleware,
  getDeviceRateLimitStatus,
  getIpRateLimitStatus,
  clearRateLimitStores,
} from './rateLimitMiddleware';
import { AuthenticatedRequest } from './authMiddleware';

// Mock Express Request, Response, and NextFunction
const createMockRequest = (overrides: Partial<AuthenticatedRequest> = {}): Partial<AuthenticatedRequest> => ({
  headers: {},
  socket: { remoteAddress: '127.0.0.1' } as any,
  ...overrides,
});

const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
};

const createMockNext = (): NextFunction => jest.fn();

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    // Clear rate limit stores before each test
    clearRateLimitStores();
    jest.clearAllMocks();
  });

  describe('deviceRateLimitMiddleware', () => {
    it('should allow requests under the device limit', () => {
      const middleware = deviceRateLimitMiddleware();
      const req = createMockRequest({
        device: { device_id: 'test_device', name: 'Test', enabled: true, secret_key: 'secret' },
      }) as AuthenticatedRequest;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 59 requests (under limit of 60)
      for (let i = 0; i < 59; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(59);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding device limit (60 per minute)', () => {
      const middleware = deviceRateLimitMiddleware();
      const req = createMockRequest({
        device: { device_id: 'test_device', name: 'Test', enabled: true, secret_key: 'secret' },
      }) as AuthenticatedRequest;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 60 requests (at limit)
      for (let i = 0; i < 60; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(60);

      // 61st request should be blocked
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Too many requests',
        message: 'Device rate limit exceeded. Maximum 60 requests per minute.',
      });
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });

    it('should track different devices separately', () => {
      const middleware = deviceRateLimitMiddleware();
      const req1 = createMockRequest({
        device: { device_id: 'device_1', name: 'Device 1', enabled: true, secret_key: 'secret1' },
      }) as AuthenticatedRequest;
      const req2 = createMockRequest({
        device: { device_id: 'device_2', name: 'Device 2', enabled: true, secret_key: 'secret2' },
      }) as AuthenticatedRequest;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 60 requests from device_1
      for (let i = 0; i < 60; i++) {
        middleware(req1, res, next);
      }

      // Make 60 requests from device_2 (should be allowed)
      for (let i = 0; i < 60; i++) {
        middleware(req2, res, next);
      }

      expect(next).toHaveBeenCalledTimes(120);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should skip rate limiting if no device_id is present', () => {
      const middleware = deviceRateLimitMiddleware();
      const req = createMockRequest() as AuthenticatedRequest; // No device info
      const res = createMockResponse() as Response;
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use X-Device-ID header if device object is not present', () => {
      const middleware = deviceRateLimitMiddleware();
      const req = createMockRequest({
        headers: { 'x-device-id': 'header_device' },
      }) as AuthenticatedRequest;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 60 requests
      for (let i = 0; i < 60; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(60);

      // 61st request should be blocked
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should return correct Retry-After header value', () => {
      const middleware = deviceRateLimitMiddleware();
      const req = createMockRequest({
        device: { device_id: 'test_device', name: 'Test', enabled: true, secret_key: 'secret' },
      }) as AuthenticatedRequest;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 60 requests to reach limit
      for (let i = 0; i < 60; i++) {
        middleware(req, res, next);
      }

      // 61st request should be blocked with Retry-After header
      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
      const retryAfter = (res.setHeader as jest.Mock).mock.calls[0][1];
      expect(parseInt(retryAfter)).toBeGreaterThan(0);
      expect(parseInt(retryAfter)).toBeLessThanOrEqual(60);
    });
  });

  describe('ipRateLimitMiddleware', () => {
    it('should allow requests under the IP limit', () => {
      const middleware = ipRateLimitMiddleware();
      const req = createMockRequest({
        socket: { remoteAddress: '192.168.1.100' } as any,
      }) as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 99 requests (under limit of 100)
      for (let i = 0; i < 99; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(99);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding IP limit (100 per minute)', () => {
      const middleware = ipRateLimitMiddleware();
      const req = createMockRequest({
        socket: { remoteAddress: '192.168.1.100' } as any,
      }) as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 100 requests (at limit)
      for (let i = 0; i < 100; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(100);

      // 101st request should be blocked
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Too many requests',
        message: 'IP rate limit exceeded. Maximum 100 requests per minute.',
      });
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });

    it('should track different IPs separately', () => {
      const middleware = ipRateLimitMiddleware();
      const req1 = createMockRequest({
        socket: { remoteAddress: '192.168.1.100' } as any,
      }) as Request;
      const req2 = createMockRequest({
        socket: { remoteAddress: '192.168.1.101' } as any,
      }) as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 100 requests from IP 1
      for (let i = 0; i < 100; i++) {
        middleware(req1, res, next);
      }

      // Make 100 requests from IP 2 (should be allowed)
      for (let i = 0; i < 100; i++) {
        middleware(req2, res, next);
      }

      expect(next).toHaveBeenCalledTimes(200);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle X-Forwarded-For header (proxy)', () => {
      const middleware = ipRateLimitMiddleware();
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
        socket: { remoteAddress: '192.168.1.1' } as any,
      }) as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(100);

      // 101st request should be blocked
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should handle X-Real-IP header', () => {
      const middleware = ipRateLimitMiddleware();
      const req = createMockRequest({
        headers: { 'x-real-ip': '203.0.113.1' },
        socket: { remoteAddress: '192.168.1.1' } as any,
      }) as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(100);

      // 101st request should be blocked
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should skip rate limiting if IP cannot be determined', () => {
      const middleware = ipRateLimitMiddleware();
      const req = createMockRequest({
        socket: {} as any, // No remoteAddress
      }) as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('rateLimitMiddleware (combined)', () => {
    it('should apply both device and IP rate limiting', () => {
      const middlewares = rateLimitMiddleware();
      expect(middlewares).toHaveLength(2);
    });

    it('should block when device limit is exceeded first', () => {
      const [deviceMiddleware, ipMiddleware] = rateLimitMiddleware();
      const req = createMockRequest({
        device: { device_id: 'test_device', name: 'Test', enabled: true, secret_key: 'secret' },
        socket: { remoteAddress: '192.168.1.100' } as any,
      }) as AuthenticatedRequest;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 60 requests (device limit)
      for (let i = 0; i < 60; i++) {
        deviceMiddleware(req, res, next);
        if ((next as jest.Mock).mock.calls.length === i + 1) {
          ipMiddleware(req, res, next);
        }
      }

      // 61st request should be blocked by device middleware
      deviceMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Device rate limit exceeded'),
        })
      );
    });

    it('should block when IP limit is exceeded first', () => {
      const [deviceMiddleware, ipMiddleware] = rateLimitMiddleware();
      
      // Use different devices to avoid hitting device limit (60)
      // but same IP to hit IP limit (100)
      let nextCallCount = 0;

      // Make 100 requests from different devices but same IP
      for (let i = 0; i < 100; i++) {
        const req = createMockRequest({
          device: { device_id: `device_${i}`, name: `Device ${i}`, enabled: true, secret_key: 'secret' },
          socket: { remoteAddress: '192.168.1.100' } as any,
        }) as AuthenticatedRequest;
        const res = createMockResponse() as Response;
        const next = jest.fn(() => { nextCallCount++; });
        
        deviceMiddleware(req, res, next);
        if ((next as jest.Mock).mock.calls.length === 1) {
          ipMiddleware(req, res, next);
        }
      }

      // 101st request should be blocked by IP middleware
      const req101 = createMockRequest({
        device: { device_id: 'device_100', name: 'Device 100', enabled: true, secret_key: 'secret' },
        socket: { remoteAddress: '192.168.1.100' } as any,
      }) as AuthenticatedRequest;
      const res101 = createMockResponse() as Response;
      const next101 = createMockNext();
      
      deviceMiddleware(req101, res101, next101);
      if ((next101 as jest.Mock).mock.calls.length === 1) {
        ipMiddleware(req101, res101, next101);
      }

      expect(res101.status).toHaveBeenCalledWith(429);
      expect(res101.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('IP rate limit exceeded'),
        })
      );
    });
  });

  describe('Rate limit status functions', () => {
    it('should return null for non-existent device', () => {
      const status = getDeviceRateLimitStatus('non_existent_device');
      expect(status).toBeNull();
    });

    it('should return correct status for device', () => {
      const middleware = deviceRateLimitMiddleware();
      const req = createMockRequest({
        device: { device_id: 'test_device', name: 'Test', enabled: true, secret_key: 'secret' },
      }) as AuthenticatedRequest;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        middleware(req, res, next);
      }

      const status = getDeviceRateLimitStatus('test_device');
      expect(status).not.toBeNull();
      expect(status?.count).toBe(10);
      expect(status?.remaining).toBe(50);
      expect(status?.resetTime).toBeGreaterThan(Date.now());
    });

    it('should return null for non-existent IP', () => {
      const status = getIpRateLimitStatus('192.168.1.200');
      expect(status).toBeNull();
    });

    it('should return correct status for IP', () => {
      const middleware = ipRateLimitMiddleware();
      const req = createMockRequest({
        socket: { remoteAddress: '192.168.1.100' } as any,
      }) as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 20 requests
      for (let i = 0; i < 20; i++) {
        middleware(req, res, next);
      }

      const status = getIpRateLimitStatus('192.168.1.100');
      expect(status).not.toBeNull();
      expect(status?.count).toBe(20);
      expect(status?.remaining).toBe(80);
      expect(status?.resetTime).toBeGreaterThan(Date.now());
    });
  });

  describe('clearRateLimitStores', () => {
    it('should clear all rate limit stores', () => {
      const deviceMiddleware = deviceRateLimitMiddleware();
      const ipMiddleware = ipRateLimitMiddleware();
      const req1 = createMockRequest({
        device: { device_id: 'test_device', name: 'Test', enabled: true, secret_key: 'secret' },
      }) as AuthenticatedRequest;
      const req2 = createMockRequest({
        socket: { remoteAddress: '192.168.1.100' } as any,
      }) as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make some requests
      deviceMiddleware(req1, res, next);
      ipMiddleware(req2, res, next);

      // Verify stores have data
      expect(getDeviceRateLimitStatus('test_device')).not.toBeNull();
      expect(getIpRateLimitStatus('192.168.1.100')).not.toBeNull();

      // Clear stores
      clearRateLimitStores();

      // Verify stores are empty
      expect(getDeviceRateLimitStatus('test_device')).toBeNull();
      expect(getIpRateLimitStatus('192.168.1.100')).toBeNull();
    });
  });

  describe('Security logging', () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should log security event when device rate limit is exceeded', () => {
      const middleware = deviceRateLimitMiddleware();
      const req = createMockRequest({
        device: { device_id: 'test_device', name: 'Test', enabled: true, secret_key: 'secret' },
      }) as AuthenticatedRequest;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Exceed device limit
      for (let i = 0; i < 61; i++) {
        middleware(req, res, next);
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded for device test_device')
      );
    });

    it('should log security event when IP rate limit is exceeded', () => {
      const middleware = ipRateLimitMiddleware();
      const req = createMockRequest({
        socket: { remoteAddress: '192.168.1.100' } as any,
      }) as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Exceed IP limit
      for (let i = 0; i < 101; i++) {
        middleware(req, res, next);
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded for IP 192.168.1.100')
      );
    });
  });
});
