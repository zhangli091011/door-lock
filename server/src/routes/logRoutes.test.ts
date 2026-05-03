/**
 * Log Routes Integration Tests
 * 日志路由集成测试
 * 
 * Tests for access log query endpoints with authentication
 */

import request from 'supertest';
import express, { Express } from 'express';
import { Database } from '../db';
import { createLogRoutes } from './logRoutes';
import { generateToken } from '../utils/jwtUtils';

// Mock the database and repositories
jest.mock('../db');
jest.mock('../repositories/AccessLogRepository');
jest.mock('../repositories/DeviceRepository');
jest.mock('../repositories/CardRepository');
jest.mock('../repositories/AdminRepository');

describe('Log Routes Integration Tests', () => {
  let app: Express;
  let mockDb: jest.Mocked<Database>;
  let validToken: string;

  beforeAll(() => {
    // Generate a valid JWT token for testing
    validToken = generateToken({ id: 1, username: 'admin' });
  });

  beforeEach(() => {
    // Create mock database
    mockDb = {
      query: jest.fn(),
      queryOne: jest.fn(),
      execute: jest.fn(),
      getLastInsertId: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      close: jest.fn(),
    } as any;

    // Create Express app with log routes
    app = express();
    app.use(express.json());
    app.use('/api/logs', createLogRoutes(mockDb));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/logs', () => {
    it('should return 401 without authentication token', async () => {
      // Act
      const response = await request(app).get('/api/logs');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid page parameter', async () => {
      // Act
      const response = await request(app)
        .get('/api/logs?page=invalid')
        .set('Authorization', `Bearer ${validToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid page parameter');
    });

    it('should return 400 for invalid limit parameter', async () => {
      // Act
      const response = await request(app)
        .get('/api/logs?limit=300')
        .set('Authorization', `Bearer ${validToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid limit parameter');
    });

    it('should return 400 for invalid allowed parameter', async () => {
      // Act
      const response = await request(app)
        .get('/api/logs?allowed=invalid')
        .set('Authorization', `Bearer ${validToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid allowed parameter');
    });

    it('should return 400 for invalid time format', async () => {
      // Act
      const response = await request(app)
        .get('/api/logs?start_time=invalid-date')
        .set('Authorization', `Bearer ${validToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid start_time parameter');
    });

    it('should return 400 when start_time is after end_time', async () => {
      // Act
      const response = await request(app)
        .get('/api/logs?start_time=2024-01-31T23:59:59Z&end_time=2024-01-01T00:00:00Z')
        .set('Authorization', `Bearer ${validToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid time range');
    });
  });

  describe('GET /api/logs/status', () => {
    it('should return 401 without authentication token', async () => {
      // Act
      const response = await request(app).get('/api/logs/status');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return system status with valid token', async () => {
      // Arrange - Mock the repository methods before creating the app
      const { AccessLogRepository } = require('../repositories/AccessLogRepository');
      const { DeviceRepository } = require('../repositories/DeviceRepository');
      const { CardRepository } = require('../repositories/CardRepository');

      // Mock recent access logs
      const mockFindRecent = jest.fn().mockResolvedValue([
        {
          id: 1,
          uid: '04A1B2C3D4E5F6',
          card_name: '张三',
          device_id: 'door_1',
          device_name: '前门门禁',
          timestamp: new Date('2024-01-15T14:30:25Z'),
          allowed: true,
          source: 'cloud',
        },
      ]);

      // Mock today's statistics
      const mockGetTodayStatistics = jest.fn().mockResolvedValue({
        today_access: 120,
        today_denied: 5,
        total_access: 1500,
      });

      // Mock devices with status
      const mockFindAllWithStatus = jest.fn().mockResolvedValue([
        {
          device_id: 'door_1',
          name: '前门门禁',
          location: '一楼大厅',
          is_online: true,
          last_seen: new Date('2024-01-15T14:30:00Z'),
        },
      ]);

      // Mock device counts
      const mockCountTotalDevices = jest.fn().mockResolvedValue(2);
      const mockCountOnline = jest.fn().mockResolvedValue(1);

      // Mock card counts
      const mockCountTotalCards = jest.fn().mockResolvedValue(50);
      const mockCountEnabled = jest.fn().mockResolvedValue(45);

      // Apply mocks
      AccessLogRepository.mockImplementation(() => ({
        findRecent: mockFindRecent,
        getTodayStatistics: mockGetTodayStatistics,
      }));

      DeviceRepository.mockImplementation(() => ({
        findAllWithStatus: mockFindAllWithStatus,
        countTotal: mockCountTotalDevices,
        countOnline: mockCountOnline,
      }));

      CardRepository.mockImplementation(() => ({
        countTotal: mockCountTotalCards,
        countEnabled: mockCountEnabled,
      }));

      // Recreate app with mocked repositories
      const testApp = express();
      testApp.use(express.json());
      testApp.use('/api/logs', createLogRoutes(mockDb));

      // Act
      const response = await request(testApp)
        .get('/api/logs/status')
        .set('Authorization', `Bearer ${validToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('recent_access');
      expect(response.body.data).toHaveProperty('devices_status');
      expect(response.body.data).toHaveProperty('statistics');

      // Verify recent_access structure
      expect(response.body.data.recent_access).toHaveLength(1);
      expect(response.body.data.recent_access[0]).toHaveProperty('uid');
      expect(response.body.data.recent_access[0]).toHaveProperty('card_name');
      expect(response.body.data.recent_access[0]).toHaveProperty('device_id');
      expect(response.body.data.recent_access[0]).toHaveProperty('device_name');
      expect(response.body.data.recent_access[0]).toHaveProperty('timestamp');
      expect(response.body.data.recent_access[0]).toHaveProperty('allowed');

      // Verify devices_status structure
      expect(response.body.data.devices_status).toHaveLength(1);
      expect(response.body.data.devices_status[0]).toHaveProperty('device_id');
      expect(response.body.data.devices_status[0]).toHaveProperty('name');
      expect(response.body.data.devices_status[0]).toHaveProperty('online');
      expect(response.body.data.devices_status[0]).toHaveProperty('last_seen');

      // Verify statistics structure
      expect(response.body.data.statistics).toEqual({
        total_cards: 50,
        active_cards: 45,
        total_devices: 2,
        online_devices: 1,
        today_access: 120,
        today_denied: 5,
      });
    });

    it('should handle empty data gracefully', async () => {
      // Arrange - Mock empty responses
      const { AccessLogRepository } = require('../repositories/AccessLogRepository');
      const { DeviceRepository } = require('../repositories/DeviceRepository');
      const { CardRepository } = require('../repositories/CardRepository');

      const mockFindRecent = jest.fn().mockResolvedValue([]);
      const mockGetTodayStatistics = jest.fn().mockResolvedValue({
        today_access: 0,
        today_denied: 0,
        total_access: 0,
      });
      const mockFindAllWithStatus = jest.fn().mockResolvedValue([]);
      const mockCountTotalDevices = jest.fn().mockResolvedValue(0);
      const mockCountOnline = jest.fn().mockResolvedValue(0);
      const mockCountTotalCards = jest.fn().mockResolvedValue(0);
      const mockCountEnabled = jest.fn().mockResolvedValue(0);

      AccessLogRepository.mockImplementation(() => ({
        findRecent: mockFindRecent,
        getTodayStatistics: mockGetTodayStatistics,
      }));

      DeviceRepository.mockImplementation(() => ({
        findAllWithStatus: mockFindAllWithStatus,
        countTotal: mockCountTotalDevices,
        countOnline: mockCountOnline,
      }));

      CardRepository.mockImplementation(() => ({
        countTotal: mockCountTotalCards,
        countEnabled: mockCountEnabled,
      }));

      // Recreate app with mocked repositories
      const testApp = express();
      testApp.use(express.json());
      testApp.use('/api/logs', createLogRoutes(mockDb));

      // Act
      const response = await request(testApp)
        .get('/api/logs/status')
        .set('Authorization', `Bearer ${validToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recent_access).toHaveLength(0);
      expect(response.body.data.devices_status).toHaveLength(0);
      expect(response.body.data.statistics.total_cards).toBe(0);
    });
  });
});
