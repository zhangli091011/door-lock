/**
 * Access Control Service
 * 权限验证服务
 * 
 * Implements core access control logic:
 * - Card existence and enabled status check
 * - Time slots validation
 * - Device permissions validation
 * - Access date range validation
 * 
 * Requirements: 2.4, 2.5, 2.6, 2.7, 6.6, 12.2, 12.3, 13.2, 13.3
 */

import { CardRepository } from '../repositories/CardRepository';
import { Card } from '../models/Card';

/**
 * Access verification result
 */
export interface AccessVerificationResult {
  allowed: boolean;           // Whether access is granted
  reason?: string;            // Rejection reason (if not allowed)
  card_name?: string;         // Card holder name
  cacheable: boolean;         // Whether this result can be cached by ESP32
}

/**
 * Access verification request
 */
export interface AccessVerificationRequest {
  uid: string;                // Card UID
  device_id: string;          // Device ID making the request
  timestamp?: Date;           // Request timestamp (defaults to now)
}

export class AccessControlService {
  constructor(private cardRepository: CardRepository) {}

  /**
   * Verify card access permissions
   * 
   * Checks multiple conditions in order:
   * 1. Card exists
   * 2. Card is enabled
   * 3. Current time is within access date range (access_start to access_end)
   * 4. Current time is within allowed time slots
   * 5. Device is in allowed devices list
   * 
   * @param request Access verification request
   * @returns Access verification result
   */
  async verifyAccess(request: AccessVerificationRequest): Promise<AccessVerificationResult> {
    const { uid, device_id, timestamp = new Date() } = request;

    // Step 1: Check if card exists
    const card = await this.cardRepository.findByUid(uid);
    if (!card) {
      return {
        allowed: false,
        reason: '卡片不存在',
        cacheable: false,
      };
    }

    // Step 2: Check if card is enabled
    if (!card.enabled) {
      return {
        allowed: false,
        reason: '卡片已禁用',
        card_name: card.name,
        cacheable: false,
      };
    }

    // Step 3: Check access date range (access_start and access_end)
    const dateRangeCheck = this.checkAccessDateRange(card, timestamp);
    if (!dateRangeCheck.allowed) {
      return {
        allowed: false,
        reason: dateRangeCheck.reason,
        card_name: card.name,
        cacheable: false,
      };
    }

    // Step 4: Check time slots
    const timeSlotsCheck = this.checkTimeSlots(card, timestamp);
    if (!timeSlotsCheck.allowed) {
      return {
        allowed: false,
        reason: timeSlotsCheck.reason,
        card_name: card.name,
        cacheable: card.cacheable,
      };
    }

    // Step 5: Check device permissions
    const deviceCheck = this.checkDevicePermissions(card, device_id);
    if (!deviceCheck.allowed) {
      return {
        allowed: false,
        reason: deviceCheck.reason,
        card_name: card.name,
        cacheable: false,
      };
    }

    // All checks passed
    return {
      allowed: true,
      card_name: card.name,
      cacheable: card.cacheable,
    };
  }

  /**
   * Check if current time is within access date range
   * Validates access_start and access_end fields
   * 
   * Requirements: 2.7
   */
  private checkAccessDateRange(
    card: Card,
    timestamp: Date
  ): { allowed: boolean; reason?: string } {
    // If access_start is set, check if current time is after start time
    if (card.access_start) {
      const startTime = new Date(card.access_start);
      if (timestamp < startTime) {
        return {
          allowed: false,
          reason: '权限尚未生效',
        };
      }
    }

    // If access_end is set, check if current time is before end time
    if (card.access_end) {
      const endTime = new Date(card.access_end);
      if (timestamp > endTime) {
        return {
          allowed: false,
          reason: '权限已过期',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if current time is within allowed time slots
   * Validates time_slots field (JSON array of "HH:MM-HH:MM" strings)
   * 
   * Requirements: 12.2, 12.3
   */
  private checkTimeSlots(
    card: Card,
    timestamp: Date
  ): { allowed: boolean; reason?: string } {
    // If no time slots are defined, allow 24/7 access
    if (!card.time_slots) {
      return { allowed: true };
    }

    try {
      // Parse time slots JSON
      const timeSlots: string[] = JSON.parse(card.time_slots);

      // If empty array, allow 24/7 access
      if (timeSlots.length === 0) {
        return { allowed: true };
      }

      // Get current time in HH:MM format
      const currentTime = this.formatTime(timestamp);

      // Check if current time falls within any time slot
      for (const slot of timeSlots) {
        if (this.isTimeInSlot(currentTime, slot)) {
          return { allowed: true };
        }
      }

      // Current time is not in any allowed time slot
      return {
        allowed: false,
        reason: '不在允许时间段内',
      };
    } catch (error) {
      // Invalid JSON format, treat as no restriction
      console.error('Invalid time_slots JSON format:', error);
      return { allowed: true };
    }
  }

  /**
   * Check if device is in allowed devices list
   * Validates allowed_devices field (JSON array of device IDs)
   * 
   * Requirements: 13.2, 13.3
   */
  private checkDevicePermissions(
    card: Card,
    device_id: string
  ): { allowed: boolean; reason?: string } {
    // If no device restrictions are defined, allow all devices
    if (!card.allowed_devices) {
      return { allowed: true };
    }

    try {
      // Parse allowed devices JSON
      const allowedDevices: string[] = JSON.parse(card.allowed_devices);

      // If empty array, allow all devices
      if (allowedDevices.length === 0) {
        return { allowed: true };
      }

      // Check if current device is in allowed list
      if (allowedDevices.includes(device_id)) {
        return { allowed: true };
      }

      // Device is not in allowed list
      return {
        allowed: false,
        reason: '不允许访问此设备',
      };
    } catch (error) {
      // Invalid JSON format, treat as no restriction
      console.error('Invalid allowed_devices JSON format:', error);
      return { allowed: true };
    }
  }

  /**
   * Format Date to HH:MM string
   */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Check if a time is within a time slot
   * @param time Time in HH:MM format
   * @param slot Time slot in "HH:MM-HH:MM" format
   * @returns True if time is within slot
   */
  private isTimeInSlot(time: string, slot: string): boolean {
    // Parse slot format "HH:MM-HH:MM"
    const parts = slot.split('-');
    if (parts.length !== 2) {
      console.error('Invalid time slot format:', slot);
      return false;
    }

    const [startTime, endTime] = parts.map(t => t.trim());

    // Convert times to minutes since midnight for comparison
    const currentMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    // Handle overnight time slots (e.g., "22:00-02:00")
    if (endMinutes < startMinutes) {
      // Time slot crosses midnight
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    } else {
      // Normal time slot within same day
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
  }

  /**
   * Convert HH:MM time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
