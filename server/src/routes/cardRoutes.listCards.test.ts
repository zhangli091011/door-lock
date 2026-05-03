/**
 * Card Routes - listCards Integration Test
 * Tests for GET /api/cards endpoint
 */

import request from 'supertest';
import express, { Express } from 'express';
import { Database } from '../db';
import { createCardRoutes } from './cardRoutes';
import { generateToken } from '../utils/jwtUtils';

// Mock dependencies
jest.mock('../db');
jest.mock('../repositories/CardRepository');
jest.mock('../repositories/DeviceRepository');

describe('GET /api/cards', () => {
  let app: Express;
  let mockDb: jest.Mocked<Database>;
  let validToken: string;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      query: jest.fn(),
      queryOne: jest.fn(),
      execute: jest.fn(),
      close: jest.fn(),
    } as any;

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/cards', createCardRoutes(mockDb));

    // Generate valid JWT token
    validToken = generateToken({ id: 1, username: 'admin' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 without authentication', async () => {
    const response = await request(app).get('/api/cards');

    expect(response.status).toBe(401);
  });

  it('should return 200 with valid authentication', async () => {
    // Mock CardRepository.findAll
    const CardRepository = require('../repositories/CardRepository').CardRepository;
    CardRepository.prototype.findAll = jest.fn().mockResolvedValue({
      cards: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
    });

    const response = await request(app)
      .get('/api/cards')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        cards: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
        },
      },
    });
  });

  it('should accept pagination parameters', async () => {
    // Mock CardRepository.findAll
    const CardRepository = require('../repositories/CardRepository').CardRepository;
    const mockFindAll = jest.fn().mockResolvedValue({
      cards: [],
      pagination: {
        page: 2,
        limit: 10,
        total: 25,
        pages: 3,
      },
    });
    CardRepository.prototype.findAll = mockFindAll;

    const response = await request(app)
      .get('/api/cards?page=2&limit=10')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      enabled: undefined,
      search: undefined,
    });
  });

  it('should accept enabled filter', async () => {
    // Mock CardRepository.findAll
    const CardRepository = require('../repositories/CardRepository').CardRepository;
    const mockFindAll = jest.fn().mockResolvedValue({
      cards: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
    });
    CardRepository.prototype.findAll = mockFindAll;

    const response = await request(app)
      .get('/api/cards?enabled=true')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      enabled: true,
      search: undefined,
    });
  });

  it('should accept search parameter', async () => {
    // Mock CardRepository.findAll
    const CardRepository = require('../repositories/CardRepository').CardRepository;
    const mockFindAll = jest.fn().mockResolvedValue({
      cards: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
    });
    CardRepository.prototype.findAll = mockFindAll;

    const response = await request(app)
      .get('/api/cards?search=张三')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      enabled: undefined,
      search: '张三',
    });
  });

  it('should return 400 for invalid page parameter', async () => {
    const response = await request(app)
      .get('/api/cards?page=invalid')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid page parameter');
  });

  it('should return 400 for invalid limit parameter', async () => {
    const response = await request(app)
      .get('/api/cards?limit=200')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid limit parameter');
  });

  it('should return 400 for invalid enabled parameter', async () => {
    const response = await request(app)
      .get('/api/cards?enabled=invalid')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid enabled parameter');
  });
});

