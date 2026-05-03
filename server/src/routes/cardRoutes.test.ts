/**
 * Card Routes Integration Tests
 * 卡片路由集成测试
 * 
 * Tests for POST /api/cards endpoint with authentication
 */

import request from 'supertest';
import express, { Express } from 'express';
import { Database } from '../db';
import { createCardRoutes } from './cardRoutes';
import { generateToken } from '../utils/jwtUtils';

describe('Card Routes Integration Tests', () => {
  let app: Express;
  let mockDb: Database;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      query: jest.fn(),
      queryOne: jest.fn(),
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      close: jest.fn(),
    } as unknown as Database;

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/cards', createCardRoutes(mockDb));
  });

  describe('POST /api/cards', () => {
    it('should reject request without authentication token', async () => {
      const response = await request(app)
        .post('/api/cards')
        .send({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No token provided');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should successfully add card with valid authentication', async () => {
      // Generate valid JWT token
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      // Mock database responses
      (mockDb.queryOne as jest.Mock)
        .mockResolvedValueOnce(null) // Card doesn't exist
        .mockResolvedValueOnce({
          // Return created card
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

      (mockDb.execute as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          enabled: true,
          cacheable: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('卡片添加成功');
      expect(response.body.data).toMatchObject({
        uid: '04A1B2C3D4E5F6',
        name: '张三',
      });
    });

    it('should add card with time_slots', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      (mockDb.queryOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          enabled: 1,
          access_start: null,
          access_end: null,
          time_slots: JSON.stringify(['09:00-12:00', '14:00-18:00']),
          allowed_devices: null,
          cacheable: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      (mockDb.execute as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          time_slots: ['09:00-12:00', '14:00-18:00'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should add card with allowed_devices', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      // Mock: card doesn't exist, devices exist, card created
      (mockDb.queryOne as jest.Mock)
        .mockResolvedValueOnce(null) // Card doesn't exist
        .mockResolvedValueOnce({ device_id: 'door_1' }) // door_1 exists
        .mockResolvedValueOnce({ device_id: 'door_2' }) // door_2 exists
        .mockResolvedValueOnce({
          // Return created card
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          enabled: 1,
          access_start: null,
          access_end: null,
          time_slots: null,
          allowed_devices: JSON.stringify(['door_1', 'door_2']),
          cacheable: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      (mockDb.execute as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          allowed_devices: ['door_1', 'door_2'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject card with non-existent device', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      // Mock: card doesn't exist, door_1 exists, door_999 doesn't exist
      (mockDb.queryOne as jest.Mock)
        .mockResolvedValueOnce(null) // Card doesn't exist
        .mockResolvedValueOnce({ device_id: 'door_1' }) // door_1 exists
        .mockResolvedValueOnce(null); // door_999 doesn't exist

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          allowed_devices: ['door_1', 'door_999'],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid allowed_devices');
      expect(response.body.message).toContain('door_999');
    });

    it('should reject duplicate UID', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      // Mock: card already exists
      (mockDb.queryOne as jest.Mock).mockResolvedValueOnce({ uid: '04A1B2C3D4E5F6' });

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UID already exists');
    });

    it('should reject invalid UID format', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          uid: 'INVALID',
          name: '张三',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid UID format');
    });

    it('should reject invalid time_slots format', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      (mockDb.queryOne as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          time_slots: ['25:00-26:00'],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid time_slots format');
    });

    it('should add card with access time range', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      (mockDb.queryOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          enabled: 1,
          access_start: '2024-01-01T00:00:00.000Z',
          access_end: '2024-12-31T23:59:59.000Z',
          time_slots: null,
          allowed_devices: null,
          cacheable: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      (mockDb.execute as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          uid: '04A1B2C3D4E5F6',
          name: '张三',
          access_start: '2024-01-01T00:00:00Z',
          access_end: '2024-12-31T23:59:59Z',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/cards/:uid', () => {
    it('should reject request without authentication token', async () => {
      const response = await request(app).delete('/api/cards/04A1B2C3D4E5F6');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .delete('/api/cards/04A1B2C3D4E5F6')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should successfully delete card with valid authentication', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      (mockDb.queryOne as jest.Mock).mockResolvedValue({
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

      (mockDb.execute as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/cards/04A1B2C3D4E5F6')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('卡片删除成功');
    });

    it('should reject delete for non-existent card', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      (mockDb.queryOne as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/cards/04A1B2C3D4E5F6')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Card not found');
    });

    it('should reject delete with invalid UID format', async () => {
      const token = generateToken({
        id: 1,
        username: 'admin',
      });

      const response = await request(app)
        .delete('/api/cards/invalid')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid UID format');
    });
  });
});
