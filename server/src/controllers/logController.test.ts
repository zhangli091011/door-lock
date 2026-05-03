/**
 * Log Controller Tests
 * 日志控制器测试
 * 
 * Tests for access log query endpoints
 */

import { Request, Response } from 'express';
import { Database } from '../db';
import { LogController } from './logController';
import { AccessLogRepository } from '../repositories/AccessLogRepository';

// Mock the database
jest.mock('../db');
jest.mock('../repositories/AccessLogRepository');

describe('LogController', () => {
  let logController: LogController;
  let mockDb: jest.Mocked<Database>;
  let mockAccessLogRepository: jest.Mocked<AccessLogRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Create mock database
    mockDb = new Database({} as any) as jest.Mocked<Database>;

    // Create mock repository
    mockAccessLogRepository = new AccessLogRepository(mockDb) as jest.Mocked<AccessLogRepository>;

    // Create controller
    logController = new LogController(mockDb);
    (logController as any).accessLogRepository = mockAccessLogRepository;

    // Create mock request and response
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      query: {},
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogs', () => {
    it('should return paginated logs with default parameters', async () => {
      // Arrange
      const mockLogs = {
        logs: [
          {
            id: 1,
            uid: '04A1B2C3D4E5F6',
            device_id: 'door_1',
            timestamp: new Date('2024-01-15T14:30:00Z'),
            allowed: true,
            reason: null,
            source: 'cloud' as const,
            card_name: '张三',
            device_name: '前门门禁',
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          pages: 1,
        },
      };

      mockAccessLogRepository.findAll.mockResolvedValue(mockLogs);

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAccessLogRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockLogs,
      });
    });

    it('should filter logs by device_id', async () => {
      // Arrange
      mockRequest.query = { device_id: 'door_1' };
      const mockLogs = {
        logs: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      };
      mockAccessLogRepository.findAll.mockResolvedValue(mockLogs);

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAccessLogRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        device_id: 'door_1',
      });
    });

    it('should filter logs by uid', async () => {
      // Arrange
      mockRequest.query = { uid: '04A1B2C3D4E5F6' };
      const mockLogs = {
        logs: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      };
      mockAccessLogRepository.findAll.mockResolvedValue(mockLogs);

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAccessLogRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        uid: '04A1B2C3D4E5F6',
      });
    });

    it('should filter logs by allowed status (true)', async () => {
      // Arrange
      mockRequest.query = { allowed: 'true' };
      const mockLogs = {
        logs: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      };
      mockAccessLogRepository.findAll.mockResolvedValue(mockLogs);

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAccessLogRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        allowed: true,
      });
    });

    it('should filter logs by allowed status (false)', async () => {
      // Arrange
      mockRequest.query = { allowed: 'false' };
      const mockLogs = {
        logs: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      };
      mockAccessLogRepository.findAll.mockResolvedValue(mockLogs);

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAccessLogRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        allowed: false,
      });
    });

    it('should filter logs by time range', async () => {
      // Arrange
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-31T23:59:59Z';
      mockRequest.query = { start_time: startTime, end_time: endTime };
      const mockLogs = {
        logs: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      };
      mockAccessLogRepository.findAll.mockResolvedValue(mockLogs);

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAccessLogRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        start_time: new Date(startTime),
        end_time: new Date(endTime),
      });
    });

    it('should support custom pagination parameters', async () => {
      // Arrange
      mockRequest.query = { page: '2', limit: '20' };
      const mockLogs = {
        logs: [],
        pagination: { page: 2, limit: 20, total: 0, pages: 0 },
      };
      mockAccessLogRepository.findAll.mockResolvedValue(mockLogs);

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAccessLogRepository.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
      });
    });

    it('should return 400 for invalid page parameter', async () => {
      // Arrange
      mockRequest.query = { page: 'invalid' };

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid page parameter',
        message: 'Page must be a positive integer',
      });
    });

    it('should return 400 for negative page parameter', async () => {
      // Arrange
      mockRequest.query = { page: '-1' };

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid page parameter',
        message: 'Page must be a positive integer',
      });
    });

    it('should return 400 for invalid limit parameter', async () => {
      // Arrange
      mockRequest.query = { limit: 'invalid' };

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid limit parameter',
        message: 'Limit must be between 1 and 200',
      });
    });

    it('should return 400 for limit exceeding maximum', async () => {
      // Arrange
      mockRequest.query = { limit: '300' };

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid limit parameter',
        message: 'Limit must be between 1 and 200',
      });
    });

    it('should return 400 for invalid allowed parameter', async () => {
      // Arrange
      mockRequest.query = { allowed: 'invalid' };

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid allowed parameter',
        message: 'Allowed must be "true" or "false"',
      });
    });

    it('should return 400 for invalid start_time format', async () => {
      // Arrange
      mockRequest.query = { start_time: 'invalid-date' };

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid start_time parameter',
        message: 'start_time must be a valid ISO 8601 date string',
      });
    });

    it('should return 400 for invalid end_time format', async () => {
      // Arrange
      mockRequest.query = { end_time: 'invalid-date' };

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid end_time parameter',
        message: 'end_time must be a valid ISO 8601 date string',
      });
    });

    it('should return 400 when start_time is after end_time', async () => {
      // Arrange
      mockRequest.query = {
        start_time: '2024-01-31T23:59:59Z',
        end_time: '2024-01-01T00:00:00Z',
      };

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid time range',
        message: 'start_time must be before end_time',
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockAccessLogRepository.findAll.mockRejectedValue(new Error('Database error'));

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'Failed to query access logs',
      });
    });

    it('should support multiple filters simultaneously', async () => {
      // Arrange
      mockRequest.query = {
        device_id: 'door_1',
        uid: '04A1B2C3D4E5F6',
        allowed: 'true',
        start_time: '2024-01-01T00:00:00Z',
        end_time: '2024-01-31T23:59:59Z',
        page: '2',
        limit: '25',
      };
      const mockLogs = {
        logs: [],
        pagination: { page: 2, limit: 25, total: 0, pages: 0 },
      };
      mockAccessLogRepository.findAll.mockResolvedValue(mockLogs);

      // Act
      await logController.getLogs(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAccessLogRepository.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 25,
        device_id: 'door_1',
        uid: '04A1B2C3D4E5F6',
        allowed: true,
        start_time: new Date('2024-01-01T00:00:00Z'),
        end_time: new Date('2024-01-31T23:59:59Z'),
      });
    });
  });
});
