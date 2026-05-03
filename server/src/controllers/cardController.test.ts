/**
 * Card Controller Tests
 * 卡片控制器测试
 * 
 * Tests for POST /api/cards endpoint
 */

import { Request, Response } from 'express';
import { CardController } from './cardController';
import { Database } from '../db';
import { CardRepository } from '../repositories/CardRepository';
import { DeviceRepository } from '../repositories/DeviceRepository';

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

// Mock repositories
jest.mock('../repositories/CardRepository');
jest.mock('../repositories/DeviceRepository');

describe('CardController', () => {
  let cardController: CardController;
  let mockCardRepository: jest.Mocked<CardRepository>;
  let mockDeviceRepository: jest.Mocked<DeviceRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create controller
    cardController = new CardController(mockDb);

    // Get mocked repositories
    mockCardRepository = (cardController as any).cardRepository;
    mockDeviceRepository = (cardController as any).deviceRepository;

    // Setup response mock
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    // Setup request mock
    mockRequest = {
      body: {},
    };
  });

  describe('addCard', () => {
    it('should successfully add a valid card', async () => {
      // Arrange
      const validCard = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
      };

      mockRequest.body = validCard;
      mockCardRepository.exists = jest.fn().mockResolvedValue(false);
      mockCardRepository.create = jest.fn().mockResolvedValue({
        ...validCard,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '卡片添加成功',
          data: expect.objectContaining({
            uid: validCard.uid,
            name: validCard.name,
          }),
        })
      );
    });

    it('should reject card with missing uid', async () => {
      // Arrange
      mockRequest.body = {
        name: '张三',
      };

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing required fields',
        })
      );
    });

    it('should reject card with missing name', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
      };

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing required fields',
        })
      );
    });

    it('should reject card with invalid UID format (too short)', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2',
        name: '张三',
      };

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid UID format',
        })
      );
    });

    it('should reject card with invalid UID format (too long)', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6G7H8',
        name: '张三',
      };

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid UID format',
        })
      );
    });

    it('should reject card with invalid UID format (non-hex characters)', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04G1H2I3J4K5',
        name: '张三',
      };

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid UID format',
        })
      );
    });

    it('should reject card with duplicate UID', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
      };

      mockCardRepository.exists = jest.fn().mockResolvedValue(true);

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'UID already exists',
        })
      );
    });

    it('should reject card with empty name', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '   ',
      };

      mockCardRepository.exists = jest.fn().mockResolvedValue(false);

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid name',
        })
      );
    });

    it('should reject card with invalid time_slots format', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        time_slots: ['25:00-26:00'], // Invalid hours
      };

      mockCardRepository.exists = jest.fn().mockResolvedValue(false);

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid time_slots format',
        })
      );
    });

    it('should reject card with time_slots where start >= end', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        time_slots: ['18:00-09:00'], // Start after end
      };

      mockCardRepository.exists = jest.fn().mockResolvedValue(false);

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid time_slots format',
        })
      );
    });

    it('should accept card with valid time_slots', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        time_slots: ['09:00-12:00', '14:00-18:00'],
      };

      mockCardRepository.exists = jest.fn().mockResolvedValue(false);
      mockCardRepository.create = jest.fn().mockResolvedValue({
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        access_start: null,
        access_end: null,
        time_slots: JSON.stringify(['09:00-12:00', '14:00-18:00']),
        allowed_devices: null,
        cacheable: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(mockCardRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          time_slots: JSON.stringify(['09:00-12:00', '14:00-18:00']),
        })
      );
    });

    it('should reject card with non-existent device in allowed_devices', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        allowed_devices: ['door_1', 'door_999'],
      };

      mockCardRepository.exists = jest.fn().mockResolvedValue(false);
      mockDeviceRepository.exists = jest
        .fn()
        .mockResolvedValueOnce(true) // door_1 exists
        .mockResolvedValueOnce(false); // door_999 doesn't exist

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid allowed_devices',
          message: 'Device ID "door_999" does not exist',
        })
      );
    });

    it('should accept card with valid allowed_devices', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        allowed_devices: ['door_1', 'door_2'],
      };

      mockCardRepository.exists = jest.fn().mockResolvedValue(false);
      mockDeviceRepository.exists = jest.fn().mockResolvedValue(true);
      mockCardRepository.create = jest.fn().mockResolvedValue({
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: JSON.stringify(['door_1', 'door_2']),
        cacheable: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(mockCardRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          allowed_devices: JSON.stringify(['door_1', 'door_2']),
        })
      );
    });

    it('should reject card with invalid access_start date', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        access_start: 'invalid-date',
      };

      mockCardRepository.exists = jest.fn().mockResolvedValue(false);

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid access_start',
        })
      );
    });

    it('should reject card where access_start >= access_end', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        access_start: '2024-12-31T23:59:59Z',
        access_end: '2024-01-01T00:00:00Z',
      };

      mockCardRepository.exists = jest.fn().mockResolvedValue(false);

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid access time range',
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockRequest.body = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
      };

      mockCardRepository.exists = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      await cardController.addCard(mockRequest as Request, mockResponse as Response);

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

  describe('updateCard', () => {
    const existingCard = {
      uid: '04A1B2C3D4E5F6',
      name: '张三',
      enabled: true,
      access_start: null,
      access_end: null,
      time_slots: null,
      allowed_devices: null,
      cacheable: true,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    };

    beforeEach(() => {
      mockRequest.params = { uid: '04A1B2C3D4E5F6' };
    });

    it('should successfully update a card', async () => {
      // Arrange
      mockRequest.body = {
        name: '李四',
        enabled: false,
      };

      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);
      mockCardRepository.update = jest.fn().mockResolvedValue({
        ...existingCard,
        name: '李四',
        enabled: false,
        updated_at: new Date(),
      });

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '卡片更新成功',
          data: expect.objectContaining({
            uid: '04A1B2C3D4E5F6',
            name: '李四',
            enabled: false,
          }),
        })
      );
    });

    it('should reject update with invalid UID format', async () => {
      // Arrange
      mockRequest.params = { uid: 'invalid' };
      mockRequest.body = { name: '李四' };

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid UID format',
        })
      );
    });

    it('should reject update for non-existent card', async () => {
      // Arrange
      mockRequest.body = { name: '李四' };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(null);

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Card not found',
        })
      );
    });

    it('should reject update with invalid name', async () => {
      // Arrange
      mockRequest.body = { name: '   ' };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid name',
        })
      );
    });

    it('should successfully update enabled status', async () => {
      // Arrange
      mockRequest.body = { enabled: false };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);
      mockCardRepository.update = jest.fn().mockResolvedValue({
        ...existingCard,
        enabled: false,
        updated_at: new Date(),
      });

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(mockCardRepository.update).toHaveBeenCalledWith(
        '04A1B2C3D4E5F6',
        expect.objectContaining({ enabled: false })
      );
    });

    it('should successfully update time_slots', async () => {
      // Arrange
      mockRequest.body = {
        time_slots: ['09:00-17:00'],
      };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);
      mockCardRepository.update = jest.fn().mockResolvedValue({
        ...existingCard,
        time_slots: JSON.stringify(['09:00-17:00']),
        updated_at: new Date(),
      });

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(mockCardRepository.update).toHaveBeenCalledWith(
        '04A1B2C3D4E5F6',
        expect.objectContaining({
          time_slots: JSON.stringify(['09:00-17:00']),
        })
      );
    });

    it('should reject update with invalid time_slots', async () => {
      // Arrange
      mockRequest.body = {
        time_slots: ['25:00-26:00'],
      };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid time_slots format',
        })
      );
    });

    it('should successfully update allowed_devices', async () => {
      // Arrange
      mockRequest.body = {
        allowed_devices: ['door_1'],
      };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);
      mockDeviceRepository.exists = jest.fn().mockResolvedValue(true);
      mockCardRepository.update = jest.fn().mockResolvedValue({
        ...existingCard,
        allowed_devices: JSON.stringify(['door_1']),
        updated_at: new Date(),
      });

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(mockCardRepository.update).toHaveBeenCalledWith(
        '04A1B2C3D4E5F6',
        expect.objectContaining({
          allowed_devices: JSON.stringify(['door_1']),
        })
      );
    });

    it('should reject update with non-existent device', async () => {
      // Arrange
      mockRequest.body = {
        allowed_devices: ['door_999'],
      };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);
      mockDeviceRepository.exists = jest.fn().mockResolvedValue(false);

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid allowed_devices',
        })
      );
    });

    it('should successfully update access time range', async () => {
      // Arrange
      mockRequest.body = {
        access_start: '2024-01-01T00:00:00Z',
        access_end: '2024-12-31T23:59:59Z',
      };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);
      mockCardRepository.update = jest.fn().mockResolvedValue({
        ...existingCard,
        access_start: new Date('2024-01-01T00:00:00Z'),
        access_end: new Date('2024-12-31T23:59:59Z'),
        updated_at: new Date(),
      });

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should reject update with invalid access time range', async () => {
      // Arrange
      mockRequest.body = {
        access_start: '2024-12-31T23:59:59Z',
        access_end: '2024-01-01T00:00:00Z',
      };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid access time range',
        })
      );
    });

    it('should allow clearing time_slots with null', async () => {
      // Arrange
      mockRequest.body = {
        time_slots: null,
      };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);
      mockCardRepository.update = jest.fn().mockResolvedValue({
        ...existingCard,
        time_slots: null,
        updated_at: new Date(),
      });

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(mockCardRepository.update).toHaveBeenCalledWith(
        '04A1B2C3D4E5F6',
        expect.objectContaining({ time_slots: null })
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockRequest.body = { name: '李四' };
      mockCardRepository.findByUid = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      await cardController.updateCard(mockRequest as Request, mockResponse as Response);

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

  describe('deleteCard', () => {
    const existingCard = {
      uid: '04A1B2C3D4E5F6',
      name: '张三',
      enabled: true,
      access_start: null,
      access_end: null,
      time_slots: null,
      allowed_devices: null,
      cacheable: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should successfully delete a card', async () => {
      // Arrange
      mockRequest.params = { uid: '04A1B2C3D4E5F6' };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);
      mockCardRepository.delete = jest.fn().mockResolvedValue(true);

      // Act
      await cardController.deleteCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: '卡片删除成功',
      });
      expect(mockCardRepository.delete).toHaveBeenCalledWith('04A1B2C3D4E5F6');
    });

    it('should reject delete with invalid UID format', async () => {
      // Arrange
      mockRequest.params = { uid: 'invalid' };

      // Act
      await cardController.deleteCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid UID format',
        })
      );
    });

    it('should reject delete for non-existent card', async () => {
      // Arrange
      mockRequest.params = { uid: '04A1B2C3D4E5F6' };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(null);

      // Act
      await cardController.deleteCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Card not found',
        })
      );
    });

    it('should handle delete failure', async () => {
      // Arrange
      mockRequest.params = { uid: '04A1B2C3D4E5F6' };
      mockCardRepository.findByUid = jest.fn().mockResolvedValue(existingCard);
      mockCardRepository.delete = jest.fn().mockResolvedValue(false);

      // Act
      await cardController.deleteCard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Delete failed',
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockRequest.params = { uid: '04A1B2C3D4E5F6' };
      mockCardRepository.findByUid = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      await cardController.deleteCard(mockRequest as Request, mockResponse as Response);

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
});
