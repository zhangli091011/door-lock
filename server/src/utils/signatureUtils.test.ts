/**
 * Signature Utilities Unit Tests
 * 签名工具单元测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  generateSignature,
  verifySignature,
  validateTimestamp,
  verifyRequest,
  SignaturePayload,
} from './signatureUtils';

describe('Signature Utilities', () => {
  const testSecretKey = 'test_secret_key_12345678901234567890';
  let testPayload: SignaturePayload;

  beforeEach(() => {
    // Create a fresh payload for each test with current timestamp
    testPayload = {
      uid: '04A1B2C3D4E5F6',
      device_id: 'door_1',
      timestamp: Math.floor(Date.now() / 1000),
    };
  });

  describe('generateSignature', () => {
    it('should generate a valid HMAC-SHA256 signature', () => {
      const signature = generateSignature(testPayload, testSecretKey);

      // Signature should be a 64-character hexadecimal string (SHA256 = 32 bytes = 64 hex chars)
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent signatures for the same input', () => {
      const signature1 = generateSignature(testPayload, testSecretKey);
      const signature2 = generateSignature(testPayload, testSecretKey);

      expect(signature1).toBe(signature2);
    });

    it('should generate different signatures for different UIDs', () => {
      const signature1 = generateSignature(testPayload, testSecretKey);

      const payload2 = { ...testPayload, uid: 'DIFFERENT_UID' };
      const signature2 = generateSignature(payload2, testSecretKey);

      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures for different device IDs', () => {
      const signature1 = generateSignature(testPayload, testSecretKey);

      const payload2 = { ...testPayload, device_id: 'door_2' };
      const signature2 = generateSignature(payload2, testSecretKey);

      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures for different timestamps', () => {
      const signature1 = generateSignature(testPayload, testSecretKey);

      const payload2 = { ...testPayload, timestamp: testPayload.timestamp + 1 };
      const signature2 = generateSignature(payload2, testSecretKey);

      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures for different secret keys', () => {
      const signature1 = generateSignature(testPayload, testSecretKey);
      const signature2 = generateSignature(testPayload, 'different_secret_key');

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('verifySignature', () => {
    it('should verify a valid signature', () => {
      const signature = generateSignature(testPayload, testSecretKey);
      const isValid = verifySignature(testPayload, signature, testSecretKey);

      expect(isValid).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const invalidSignature = 'a'.repeat(64); // Invalid signature
      const isValid = verifySignature(testPayload, invalidSignature, testSecretKey);

      expect(isValid).toBe(false);
    });

    it('should reject a signature with wrong secret key', () => {
      const signature = generateSignature(testPayload, testSecretKey);
      const isValid = verifySignature(testPayload, signature, 'wrong_secret_key');

      expect(isValid).toBe(false);
    });

    it('should reject a signature with modified payload', () => {
      const signature = generateSignature(testPayload, testSecretKey);

      const modifiedPayload = { ...testPayload, uid: 'MODIFIED_UID' };
      const isValid = verifySignature(modifiedPayload, signature, testSecretKey);

      expect(isValid).toBe(false);
    });

    it('should reject a signature with incorrect length', () => {
      const shortSignature = 'abc123';
      const isValid = verifySignature(testPayload, shortSignature, testSecretKey);

      expect(isValid).toBe(false);
    });

    it('should reject a non-hexadecimal signature', () => {
      const nonHexSignature = 'g'.repeat(64); // 'g' is not a valid hex character
      const isValid = verifySignature(testPayload, nonHexSignature, testSecretKey);

      expect(isValid).toBe(false);
    });
  });

  describe('validateTimestamp', () => {
    it('should validate a current timestamp', () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const result = validateTimestamp(currentTimestamp);

      expect(result.valid).toBe(true);
      expect(result.timeDiff).toBeLessThanOrEqual(1); // Should be very close to 0
    });

    it('should validate a timestamp within 5 minutes (default)', () => {
      const fourMinutesAgo = Math.floor(Date.now() / 1000) - 240; // 4 minutes ago
      const result = validateTimestamp(fourMinutesAgo);

      expect(result.valid).toBe(true);
      expect(result.timeDiff).toBeGreaterThanOrEqual(240);
      expect(result.timeDiff).toBeLessThanOrEqual(241);
    });

    it('should reject a timestamp older than 5 minutes (default)', () => {
      const sixMinutesAgo = Math.floor(Date.now() / 1000) - 360; // 6 minutes ago
      const result = validateTimestamp(sixMinutesAgo);

      expect(result.valid).toBe(false);
      expect(result.timeDiff).toBeGreaterThanOrEqual(360);
    });

    it('should validate a future timestamp within 5 minutes', () => {
      const fourMinutesLater = Math.floor(Date.now() / 1000) + 240; // 4 minutes in future
      const result = validateTimestamp(fourMinutesLater);

      expect(result.valid).toBe(true);
      expect(result.timeDiff).toBeGreaterThanOrEqual(240);
      expect(result.timeDiff).toBeLessThanOrEqual(241);
    });

    it('should reject a future timestamp beyond 5 minutes', () => {
      const sixMinutesLater = Math.floor(Date.now() / 1000) + 360; // 6 minutes in future
      const result = validateTimestamp(sixMinutesLater);

      expect(result.valid).toBe(false);
      expect(result.timeDiff).toBeGreaterThanOrEqual(360);
    });

    it('should respect custom maxAgeSeconds parameter', () => {
      const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120;

      // Should be valid with 3-minute window
      const result1 = validateTimestamp(twoMinutesAgo, 180);
      expect(result1.valid).toBe(true);

      // Should be invalid with 1-minute window
      const result2 = validateTimestamp(twoMinutesAgo, 60);
      expect(result2.valid).toBe(false);
    });

    it('should return correct time difference', () => {
      const threeMinutesAgo = Math.floor(Date.now() / 1000) - 180;
      const result = validateTimestamp(threeMinutesAgo);

      expect(result.timeDiff).toBeGreaterThanOrEqual(180);
      expect(result.timeDiff).toBeLessThanOrEqual(181);
    });
  });

  describe('verifyRequest', () => {
    it('should verify a valid request with current timestamp', () => {
      const signature = generateSignature(testPayload, testSecretKey);
      const result = verifyRequest(testPayload, signature, testSecretKey);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.timeDiff).toBeDefined();
      expect(result.timeDiff).toBeLessThanOrEqual(1);
    });

    it('should reject a request with expired timestamp', () => {
      const expiredPayload = {
        ...testPayload,
        timestamp: Math.floor(Date.now() / 1000) - 400, // 6+ minutes ago
      };
      const signature = generateSignature(expiredPayload, testSecretKey);
      const result = verifyRequest(expiredPayload, signature, testSecretKey);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp expired');
      expect(result.timeDiff).toBeGreaterThanOrEqual(400);
    });

    it('should reject a request with invalid signature', () => {
      const invalidSignature = 'a'.repeat(64);
      const result = verifyRequest(testPayload, invalidSignature, testSecretKey);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should reject a request with modified payload after signing', () => {
      const signature = generateSignature(testPayload, testSecretKey);

      const modifiedPayload = { ...testPayload, uid: 'TAMPERED_UID' };
      const result = verifyRequest(modifiedPayload, signature, testSecretKey);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should respect custom maxAgeSeconds parameter', () => {
      const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120;
      const oldPayload = { ...testPayload, timestamp: twoMinutesAgo };
      const signature = generateSignature(oldPayload, testSecretKey);

      // Should be valid with 3-minute window
      const result1 = verifyRequest(oldPayload, signature, testSecretKey, 180);
      expect(result1.valid).toBe(true);

      // Should be invalid with 1-minute window
      const result2 = verifyRequest(oldPayload, signature, testSecretKey, 60);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('timestamp expired');
    });

    it('should validate timestamp before checking signature (performance)', () => {
      // Use a very old timestamp
      const veryOldPayload = {
        ...testPayload,
        timestamp: Math.floor(Date.now() / 1000) - 1000,
      };
      const signature = generateSignature(veryOldPayload, testSecretKey);
      const result = verifyRequest(veryOldPayload, signature, testSecretKey);

      // Should fail on timestamp, not signature
      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp expired');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values in payload', () => {
      const emptyPayload: SignaturePayload = {
        uid: '',
        device_id: '',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = generateSignature(emptyPayload, testSecretKey);
      expect(signature).toMatch(/^[a-f0-9]{64}$/);

      const isValid = verifySignature(emptyPayload, signature, testSecretKey);
      expect(isValid).toBe(true);
    });

    it('should handle special characters in payload', () => {
      const specialPayload: SignaturePayload = {
        uid: '!@#$%^&*()',
        device_id: 'device|with|pipes',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = generateSignature(specialPayload, testSecretKey);
      const isValid = verifySignature(specialPayload, signature, testSecretKey);
      expect(isValid).toBe(true);
    });

    it('should handle very long strings in payload', () => {
      const longPayload: SignaturePayload = {
        uid: 'A'.repeat(1000),
        device_id: 'B'.repeat(1000),
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = generateSignature(longPayload, testSecretKey);
      const isValid = verifySignature(longPayload, signature, testSecretKey);
      expect(isValid).toBe(true);
    });

    it('should handle timestamp at Unix epoch (0)', () => {
      const epochPayload = { ...testPayload, timestamp: 0 };
      const signature = generateSignature(epochPayload, testSecretKey);

      // Should be invalid due to age
      const result = verifyRequest(epochPayload, signature, testSecretKey);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp expired');
    });

    it('should handle very large timestamp values', () => {
      const futurePayload = { ...testPayload, timestamp: 9999999999 }; // Year 2286
      const signature = generateSignature(futurePayload, testSecretKey);

      // Should be invalid due to being too far in future
      const result = verifyRequest(futurePayload, signature, testSecretKey);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp expired');
    });
  });
});
