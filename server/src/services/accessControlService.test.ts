/**
 * Access Control Service Unit Tests
 * 
 * Tests for core access control logic:
 * - Card existence and enabled status check
 * - Time slots validation
 * - Device permissions validation
 * - Access date range validation
 */

import { AccessControlService } from './accessControlService';
import { Card } from '../models/Card';

// Mock CardRepository
class MockCardRepository {
  private cards: Map<string, Card> = new Map();

  async findByUid(uid: string): Promise<Card | null> {
    return this.cards.get(uid) || null;
  }

  // Helper method to add test cards
  addCard(card: Card): void {
    this.cards.set(card.uid, card);
  }

  // Helper method to clear all cards
  clear(): void {
    this.cards.clear();
  }
}

describe('AccessControlService', () => {
  let service: AccessControlService;
  let mockRepository: MockCardRepository;

  beforeEach(() => {
    mockRepository = new MockCardRepository();
    service = new AccessControlService(mockRepository as any);
  });

  describe('Card Existence Check', () => {
    it('should deny access for non-existent card', async () => {
      const result = await service.verifyAccess({
        uid: 'NONEXISTENT',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('卡片不存在');
      expect(result.cacheable).toBe(false);
    });
  });

  describe('Card Enabled Status Check', () => {
    it('should allow access for enabled card', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(true);
      expect(result.card_name).toBe('张三');
      expect(result.cacheable).toBe(true);
    });

    it('should deny access for disabled card', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: false,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('卡片已禁用');
      expect(result.card_name).toBe('张三');
      expect(result.cacheable).toBe(false);
    });
  });

  describe('Access Date Range Validation', () => {
    it('should allow access when no date range is set', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny access before access_start date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days in future

      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: futureDate,
        access_end: null,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: new Date(), // Current time
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('权限尚未生效');
      expect(result.cacheable).toBe(false);
    });

    it('should allow access after access_start date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7); // 7 days ago

      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: pastDate,
        access_end: null,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny access after access_end date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7); // 7 days ago

      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: pastDate,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: new Date(), // Current time
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('权限已过期');
      expect(result.cacheable).toBe(false);
    });

    it('should allow access within date range', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7); // 7 days ago

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days in future

      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: pastDate,
        access_end: futureDate,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Time Slots Validation', () => {
    it('should allow access when no time slots are set', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow access when time slots array is empty', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: '[]',
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow access within time slot', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: '["09:00-18:00"]',
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      // Create timestamp at 14:30 (2:30 PM)
      const timestamp = new Date();
      timestamp.setHours(14, 30, 0, 0);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp,
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny access outside time slot', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: '["09:00-18:00"]',
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      // Create timestamp at 20:00 (8:00 PM)
      const timestamp = new Date();
      timestamp.setHours(20, 0, 0, 0);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('不在允许时间段内');
      expect(result.cacheable).toBe(true); // Time slot restrictions are cacheable
    });

    it('should allow access in multiple time slots', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: '["09:00-12:00", "14:00-18:00"]',
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      // Test morning slot (10:30 AM)
      const morningTime = new Date();
      morningTime.setHours(10, 30, 0, 0);

      const morningResult = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: morningTime,
      });

      expect(morningResult.allowed).toBe(true);

      // Test afternoon slot (15:00 PM)
      const afternoonTime = new Date();
      afternoonTime.setHours(15, 0, 0, 0);

      const afternoonResult = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: afternoonTime,
      });

      expect(afternoonResult.allowed).toBe(true);

      // Test lunch break (13:00 PM) - should be denied
      const lunchTime = new Date();
      lunchTime.setHours(13, 0, 0, 0);

      const lunchResult = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: lunchTime,
      });

      expect(lunchResult.allowed).toBe(false);
      expect(lunchResult.reason).toBe('不在允许时间段内');
    });

    it('should handle overnight time slots', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: '["22:00-02:00"]', // 10 PM to 2 AM
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      // Test late night (23:00 - 11 PM)
      const lateNight = new Date();
      lateNight.setHours(23, 0, 0, 0);

      const lateNightResult = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: lateNight,
      });

      expect(lateNightResult.allowed).toBe(true);

      // Test early morning (01:00 - 1 AM)
      const earlyMorning = new Date();
      earlyMorning.setHours(1, 0, 0, 0);

      const earlyMorningResult = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: earlyMorning,
      });

      expect(earlyMorningResult.allowed).toBe(true);

      // Test afternoon (14:00 - 2 PM) - should be denied
      const afternoon = new Date();
      afternoon.setHours(14, 0, 0, 0);

      const afternoonResult = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: afternoon,
      });

      expect(afternoonResult.allowed).toBe(false);
    });

    it('should handle invalid time slots JSON gracefully', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: 'invalid json',
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      // Should allow access when JSON is invalid (treat as no restriction)
      expect(result.allowed).toBe(true);
    });
  });

  describe('Device Permissions Validation', () => {
    it('should allow access when no device restrictions are set', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow access when allowed_devices array is empty', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: '[]',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow access for allowed device', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: '["door_1", "door_2"]',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny access for non-allowed device', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: '["door_1", "door_2"]',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_3',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('不允许访问此设备');
      expect(result.cacheable).toBe(false);
    });

    it('should handle invalid allowed_devices JSON gracefully', async () => {
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: null,
        access_end: null,
        time_slots: null,
        allowed_devices: 'invalid json',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      const result = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
      });

      // Should allow access when JSON is invalid (treat as no restriction)
      expect(result.allowed).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    it('should check all conditions in correct order', async () => {
      // Card with all restrictions
      const card: Card = {
        uid: '04A1B2C3D4E5F6',
        name: '张三',
        enabled: true,
        cacheable: true,
        access_start: new Date('2024-01-01'),
        access_end: new Date('2024-12-31'),
        time_slots: '["09:00-18:00"]',
        allowed_devices: '["door_1"]',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.addCard(card);

      // Test with valid conditions
      const validTime = new Date('2024-06-15T14:30:00');
      const validResult = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: validTime,
      });

      expect(validResult.allowed).toBe(true);

      // Test with invalid time slot
      const invalidTime = new Date('2024-06-15T20:00:00');
      const invalidTimeResult = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_1',
        timestamp: invalidTime,
      });

      expect(invalidTimeResult.allowed).toBe(false);
      expect(invalidTimeResult.reason).toBe('不在允许时间段内');

      // Test with invalid device
      const invalidDeviceResult = await service.verifyAccess({
        uid: '04A1B2C3D4E5F6',
        device_id: 'door_2',
        timestamp: validTime,
      });

      expect(invalidDeviceResult.allowed).toBe(false);
      expect(invalidDeviceResult.reason).toBe('不允许访问此设备');
    });
  });
});
