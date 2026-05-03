/**
 * Signature Utilities
 * 签名工具模块
 * 
 * Implements HMAC-SHA256 signature generation and verification
 * Implements timestamp validation for replay attack prevention
 * 
 * Requirements: 10.4, 10.5, 10.6, 2.8
 */

import crypto from 'crypto';

/**
 * Request payload interface for signature generation
 */
export interface SignaturePayload {
  uid: string;
  device_id: string;
  timestamp: number;
}

/**
 * Generate HMAC-SHA256 signature for request payload
 * 
 * @param payload Request payload containing uid, device_id, and timestamp
 * @param secretKey Device secret key
 * @returns Hexadecimal signature string
 * 
 * Algorithm:
 * 1. Construct sign string: uid|device_id|timestamp
 * 2. Calculate HMAC-SHA256 using secret key
 * 3. Convert to hexadecimal string
 */
export function generateSignature(payload: SignaturePayload, secretKey: string): string {
  // Step 1: Construct sign string
  const signString = `${payload.uid}|${payload.device_id}|${payload.timestamp}`;
  
  // Step 2: Calculate HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(signString);
  
  // Step 3: Convert to hexadecimal string
  const signature = hmac.digest('hex');
  
  return signature;
}

/**
 * Verify request signature
 * 
 * @param payload Request payload containing uid, device_id, and timestamp
 * @param receivedSignature Signature from request
 * @param secretKey Device secret key
 * @returns True if signature is valid, false otherwise
 */
export function verifySignature(
  payload: SignaturePayload,
  receivedSignature: string,
  secretKey: string
): boolean {
  // Generate expected signature
  const expectedSignature = generateSignature(payload, secretKey);
  
  // Compare signatures using timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    // If signatures have different lengths, timingSafeEqual throws an error
    return false;
  }
}

/**
 * Validate timestamp to prevent replay attacks
 * 
 * @param timestamp Unix timestamp from request (in seconds)
 * @param maxAgeSeconds Maximum age of request in seconds (default: 300 = 5 minutes)
 * @returns Object with valid flag and time difference in seconds
 */
export function validateTimestamp(
  timestamp: number,
  maxAgeSeconds: number = 300
): { valid: boolean; timeDiff: number } {
  // Get current Unix timestamp in seconds
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Calculate time difference (absolute value)
  const timeDiff = Math.abs(currentTime - timestamp);
  
  // Check if timestamp is within acceptable range
  const valid = timeDiff <= maxAgeSeconds;
  
  return { valid, timeDiff };
}

/**
 * Verify complete request including signature and timestamp
 * 
 * @param payload Request payload
 * @param receivedSignature Signature from request
 * @param secretKey Device secret key
 * @param maxAgeSeconds Maximum age of request in seconds (default: 300)
 * @returns Object with verification result and error message if invalid
 */
export function verifyRequest(
  payload: SignaturePayload,
  receivedSignature: string,
  secretKey: string,
  maxAgeSeconds: number = 300
): { valid: boolean; error?: string; timeDiff?: number } {
  // Step 1: Validate timestamp
  const timestampValidation = validateTimestamp(payload.timestamp, maxAgeSeconds);
  
  if (!timestampValidation.valid) {
    return {
      valid: false,
      error: `Request timestamp expired (${timestampValidation.timeDiff} seconds old, max ${maxAgeSeconds} seconds)`,
      timeDiff: timestampValidation.timeDiff,
    };
  }
  
  // Step 2: Verify signature
  const signatureValid = verifySignature(payload, receivedSignature, secretKey);
  
  if (!signatureValid) {
    return {
      valid: false,
      error: 'Invalid signature',
    };
  }
  
  // Both timestamp and signature are valid
  return {
    valid: true,
    timeDiff: timestampValidation.timeDiff,
  };
}
