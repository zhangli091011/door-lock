/**
 * Device Controller Tests
 * 设备控制器测试
 * 
 * Tests for POST /api/devices endpoint
 */

import { Request, Response } from 'express';
import { DeviceController } from './deviceController';
import { Database } from '../db';
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
jest.mock('../repositories/DeviceRepository');

describe('DeviceController', () => {
  let deviceController: DeviceController;
  let mockDeviceRepository: jest.Mocked<DeviceRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create controller
    deviceController = new DeviceController(mockDb);

    // Get mocked repository
    mockDeviceRepository = (deviceController as any).deviceRepository;

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
      params: {},
    };
  });

  describe('registerDevice', () => {
    it('should successfully register a valid device', async () => {
      // Arrange
      const validDevice = {
        device_id: 'door_1',
        name: '前门门禁',
        location: '一楼大厅',
        mac_address: 'A4:CF:12:34:56:78',
      };

      mockRequest.body = validDevice;
      mockDeviceRepository.exists = jest.fn().mockResolvedValue(false);
      mockDeviceRepository.macAddressExists = jest.fn().mockResolvedValue(false);
      mockDeviceRepository.create = jest.fn().mockResolvedValue({
        ...validDevice,
        api_key: 'test_api_key_32_characters_long',
        secret_key: 'test_secret_key_32_chars_long',
        enabled: true,
        last_seen: null,
        firmware_version: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Act
      await deviceController.registerDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '设备注册成功',
          data: expect.objectContaining({
            device_id: validDevice.device_id,
            name: validDevice.name,
            api_key: expect.any(String),
            secret_key: expect.any(String),
          }),
        })
      );
    });

    it('should reject device with missing device_id', async () => {
      // Arrange
      mockRequest.body = {
        name: '前门门禁',
      };

      // Act
      await deviceController.registerDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing required fields',
        })
      );
    });

    it('should reject device with missing name', async () => {
      // Arrange
      mockRequest.body = {
        device_id: 'door_1',
      };

      // Act
      await deviceController.registerDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing required fields',
        })
      );
    });

    it('should reject device with invalid device_id format', async () => {
      // Arrange
      mockRequest.body = {
        device_id: 'door@1',  // Contains invalid character
        name: '前门门禁',
      };

      // Act
      await deviceController.registerDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid device_id format',
        })
      );
    });

    it('should reject device with duplicate device_id', async () => {
      // Arrange
      mockRequest.body = {
        device_id: 'door_1',
        name: '前门门禁',
      };

      mockDeviceRepository.exists = jest.fn().mockResolvedValue(true);

      // Act
      await deviceController.registerDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Device ID already exists',
        })
      );
    });

    it('should reject device with invalid MAC address format', async () => {
      // Arrange
      mockRequest.body = {
        device_id: 'door_1',
        name: '前门门禁',
        mac_address: 'invalid-mac',
      };

      mockDeviceRepository.exists = jest.fn().mockResolvedValue(false);

      // Act
      await deviceController.registerDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid MAC address format',
        })
      );
    });

    it('should reject device with duplicate MAC address', async () => {
      // Arrange
      mockRequest.body = {
        device_id: 'door_1',
        name: '前门门禁',
        mac_address: 'A4:CF:12:34:56:78',
      };

      mockDeviceRepository.exists = jest.fn().mockResolvedValue(false);
      mockDeviceRepository.macAddressExists = jest.fn().mockResolvedValue(true);

      // Act
      await deviceController.registerDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'MAC address already exists',
        })
      );
    });

    it('should generate 32-character API key and secret key', async () => {
      // Arrange
      mockRequest.body = {
        device_id: 'door_1',
        name: '前门门禁',
      };

      mockDeviceRepository.exists = jest.fn().mockResolvedValue(false);
      
      let capturedApiKey = '';
      let capturedSecretKey = '';
      mockDeviceRepository.create = jest.fn().mockImplementation((input) => {
        capturedApiKey = input.api_key;
        capturedSecretKey = input.secret_key;
        return Promise.resolve({
          ...input,
          enabled: true,
          last_seen: null,
          firmware_version: null,
          created_at: new Date(),
          updated_at: new Date(),
        });
      });

      // Act
      await deviceController.registerDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(capturedApiKey).toHaveLength(32);
      expect(capturedSecretKey).toHaveLength(32);
      expect(capturedApiKey).toMatch(/^[0-9a-f]{32}$/);
      expect(capturedSecretKey).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('updateDevice', () => {
    it('should successfully update a device', async () => {
      // Arrange
      const existingDevice = {
        device_id: 'door_1',
        name: '前门门禁',
        location: '一楼大厅',
        mac_address: 'A4:CF:12:34:56:78',
        api_key: 'test_api_key',
        secret_key: 'test_secret_key',
        enabled: true,
        last_seen: null,
        firmware_version: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRequest.params = { deviceId: 'door_1' };
      mockRequest.body = {
        name: '前门门禁（已更新）',
        enabled: false,
      };

      mockDeviceRepository.findById = jest.fn().mockResolvedValue(existingDevice);
      mockDeviceRepository.update = jest.fn().mockResolvedValue({
        ...existingDevice,
        name: '前门门禁（已更新）',
        enabled: false,
        updated_at: new Date(),
      });

      // Act
      await deviceController.updateDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '设备更新成功',
        })
      );
    });

    it('should reject update for non-existent device', async () => {
      // Arrange
      mockRequest.params = { deviceId: 'door_999' };
      mockRequest.body = {
        name: '不存在的设备',
      };

      mockDeviceRepository.findById = jest.fn().mockResolvedValue(null);

      // Act
      await deviceController.updateDevice(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Device not found',
        })
      );
    });
  });

  describe('listDevices', () => {
    it('should successfully list all devices with status', async () => {
      // Arrange
      const mockDevices = [
        {
          device_id: 'door_1',
          name: '前门门禁',
          location: '一楼大厅',
          mac_address: 'A4:CF:12:34:56:78',
          api_key: 'test_api_key_1',
          secret_key: 'test_secret_key_1',
          enabled: true,
          is_online: true,
          last_seen: new Date(),
          firmware_version: '1.0.0',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          device_id: 'door_2',
          name: '后门门禁',
          location: '一楼后门',
          mac_address: 'A4:CF:12:34:56:79',
          api_key: 'test_api_key_2',
          secret_key: 'test_secret_key_2',
          enabled: true,
          is_online: false,
          last_seen: new Date(Date.now() - 10 * 60 * 1000),
          firmware_version: '1.0.0',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDeviceRepository.findAllWithStatus = jest.fn().mockResolvedValue(mockDevices);

      // Act
      await deviceController.listDevices(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            devices: expect.arrayContaining([
              expect.objectContaining({
                device_id: 'door_1',
                is_online: true,
              }),
              expect.objectContaining({
                device_id: 'door_2',
                is_online: false,
              }),
            ]),
          }),
        })
      );

      // Verify secret_key is not included in response
      const responseData = jsonMock.mock.calls[0][0];
      responseData.data.devices.forEach((device: any) => {
        expect(device).not.toHaveProperty('secret_key');
      });
    });
  });
});
