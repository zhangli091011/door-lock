/**
 * Card Controller - listCards Tests
 * Tests for the GET /api/cards endpoint
 */

import { Response } from 'express';
import { CardController } from './cardController';
import { Database } from '../db';
import { CardRepository } from '../repositories/CardRepository';

// Mock dependencies
jest.mock('../db');
jest.mock('../repositories/CardRepository');
jest.mock('../repositories/DeviceRepository');

describe('CardController - listCards', () => {
  let cardController: CardController;
  let mockDb: jest.Mocked<Database>;
  let mockCardRepository: jest.Mocked<CardRepository>;
  let mockResponse: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      query: jest.fn(),
      queryOne: jest.fn(),
      execute: jest.fn(),
      close: jest.fn(),
    } as any;

    // Create controller
    cardController = new CardController(mockDb);

    // Get mocked repositories
    mockCardRepository = (cardController as any).cardRepository;

    // Setup response mock
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn();
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should list cards with default pagination', async () => {
    // Arrange
    const mockRequest = {
      query: {},
    };

    const mockCards = [
      {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: null,
        cacheable: true,
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:00:00Z'),
      },
    ];

    mockCardRepository.findAll.mockResolvedValue({
      cards: mockCards,
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      },
    });

    // Act
    await cardController.listCards(mockRequest as any, mockResponse as Response);

    // Assert
    expect(mockCardRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      enabled: undefined,
      search: undefined,
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: {
        cards: mockCards,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      },
    });
  });

  it('should list cards with custom pagination', async () => {
    // Arrange
    const mockRequest = {
      query: {
        page: '2',
        limit: '10',
      },
    };

    mockCardRepository.findAll.mockResolvedValue({
      cards: [],
      pagination: {
        page: 2,
        limit: 10,
        total: 15,
        pages: 2,
      },
    });

    // Act
    await cardController.listCards(mockRequest as any, mockResponse as Response);

    // Assert
    expect(mockCardRepository.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      enabled: undefined,
      search: undefined,
    });
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it('should filter cards by enabled status', async () => {
    // Arrange
    const mockRequest = {
      query: {
        enabled: 'true',
      },
    };

    mockCardRepository.findAll.mockResolvedValue({
      cards: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
    });

    // Act
    await cardController.listCards(mockRequest as any, mockResponse as Response);

    // Assert
    expect(mockCardRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      enabled: true,
      search: undefined,
    });
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it('should search cards by keyword', async () => {
    // Arrange
    const mockRequest = {
      query: {
        search: '张三',
      },
    };

    mockCardRepository.findAll.mockResolvedValue({
      cards: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
    });

    // Act
    await cardController.listCards(mockRequest as any, mockResponse as Response);

    // Assert
    expect(mockCardRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      enabled: undefined,
      search: '张三',
    });
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it('should parse JSON fields in response', async () => {
    // Arrange
    const mockRequest = {
      query: {},
    };

    const mockCards = [
      {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        access_start: null,
        access_end: null,
        time_slots: '["09:00-12:00","14:00-18:00"]',
        allowed_devices: '["door_1","door_2"]',
        cacheable: true,
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:00:00Z'),
      },
    ];

    mockCardRepository.findAll.mockResolvedValue({
      cards: mockCards,
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      },
    });

    // Act
    await cardController.listCards(mockRequest as any, mockResponse as Response);

    // Assert
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: {
        cards: [
          {
            uid: '04A1B2C3D4E5F6',
            name: '张三',
            enabled: true,
            access_start: null,
            access_end: null,
            time_slots: ['09:00-12:00', '14:00-18:00'],
            allowed_devices: ['door_1', 'door_2'],
            cacheable: true,
            created_at: mockCards[0].created_at,
            updated_at: mockCards[0].updated_at,
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      },
    });
  });

  it('should return 400 for invalid page parameter', async () => {
    // Arrange
    const mockRequest = {
      query: {
        page: 'invalid',
      },
    };

    // Act
    await cardController.listCards(mockRequest as any, mockResponse as Response);

    // Assert
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid page parameter',
      })
    );
  });

  it('should return 400 for invalid limit parameter', async () => {
    // Arrange
    const mockRequest = {
      query: {
        limit: '200',
      },
    };

    // Act
    await cardController.listCards(mockRequest as any, mockResponse as Response);

    // Assert
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid limit parameter',
      })
    );
  });

  it('should return 400 for invalid enabled parameter', async () => {
    // Arrange
    const mockRequest = {
      query: {
        enabled: 'invalid',
      },
    };

    // Act
    await cardController.listCards(mockRequest as any, mockResponse as Response);

    // Assert
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid enabled parameter',
      })
    );
  });

  it('should handle database errors', async () => {
    // Arrange
    const mockRequest = {
      query: {},
    };

    mockCardRepository.findAll.mockRejectedValue(new Error('Database error'));

    // Act
    await cardController.listCards(mockRequest as any, mockResponse as Response);

    // Assert
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Internal server error',
      })
    );
  });
});

