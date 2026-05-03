/**
 * Rate Limiting Middleware
 * 速率限制中间件
 * 
 * Implements device-level and IP-level rate limiting
 * Device-level: 60 requests per minute per device
 * IP-level: 100 requests per minute per IP address
 * Returns 429 status code with Retry-After header when limit exceeded
 * Logs security events when rate limit is triggered
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { AuthenticatedRequest } from './authMiddleware';

/**
 * In-memory store for rate limiting counters
 * Maps key (device_id or IP) to { count, resetTime }
 */
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const deviceStore: RateLimitStore = {};
const ipStore: RateLimitStore = {};

/**
 * Clean up expired entries from store
 * @param store Rate limit store to clean
 */
function cleanupStore(store: RateLimitStore): void {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}

/**
 * Check rate limit for a given key
 * @param store Rate limit store
 * @param key Identifier (device_id or IP)
 * @param limit Maximum requests per window
 * @param windowMs Window duration in milliseconds
 * @returns Object with allowed status and retry time
 */
function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfter: number; current: number } {
  const now = Date.now();
  const entry = store[key];

  // If no entry or entry expired, create new entry
  if (!entry || entry.resetTime < now) {
    store[key] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return { allowed: true, retryAfter: 0, current: 1 };
  }

  // Increment counter
  entry.count++;

  // Check if limit exceeded
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter, current: entry.count };
  }

  return { allowed: true, retryAfter: 0, current: entry.count };
}

/**
 * Device-level rate limiting middleware
 * Limits requests per device to 60 per minute
 * 
 * @returns Express middleware function
 */
export function deviceRateLimitMiddleware() {
  const DEVICE_LIMIT = 60; // 60 requests per minute
  const WINDOW_MS = 60 * 1000; // 1 minute

  // Cleanup expired entries every minute
  setInterval(() => cleanupStore(deviceStore), WINDOW_MS);

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Extract device_id from authenticated request
    const deviceId = req.device?.device_id || req.headers['x-device-id'] as string;

    if (!deviceId) {
      // If no device_id, skip device-level rate limiting
      next();
      return;
    }

    // Check rate limit
    const result = checkRateLimit(deviceStore, deviceId, DEVICE_LIMIT, WINDOW_MS);

    if (!result.allowed) {
      // Log security event
      console.warn(
        `Rate limit exceeded for device ${deviceId}: ${result.current} requests in window`
      );

      // Return 429 Too Many Requests
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: `Device rate limit exceeded. Maximum ${DEVICE_LIMIT} requests per minute.`,
      });
      res.setHeader('Retry-After', result.retryAfter.toString());
      return;
    }

    // Rate limit not exceeded, proceed
    next();
  };
}

/**
 * IP-level rate limiting middleware
 * Limits requests per IP address to 100 per minute
 * 
 * @returns Express middleware function
 */
export function ipRateLimitMiddleware() {
  const IP_LIMIT = 100; // 100 requests per minute
  const WINDOW_MS = 60 * 1000; // 1 minute

  // Cleanup expired entries every minute
  setInterval(() => cleanupStore(ipStore), WINDOW_MS);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Extract IP address (handle proxy headers)
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown';

    if (ip === 'unknown') {
      // If IP cannot be determined, skip IP-level rate limiting
      next();
      return;
    }

    // Check rate limit
    const result = checkRateLimit(ipStore, ip, IP_LIMIT, WINDOW_MS);

    if (!result.allowed) {
      // Log security event
      console.warn(
        `Rate limit exceeded for IP ${ip}: ${result.current} requests in window`
      );

      // Return 429 Too Many Requests
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: `IP rate limit exceeded. Maximum ${IP_LIMIT} requests per minute.`,
      });
      res.setHeader('Retry-After', result.retryAfter.toString());
      return;
    }

    // Rate limit not exceeded, proceed
    next();
  };
}

/**
 * Combined rate limiting middleware
 * Applies both device-level and IP-level rate limiting
 * 
 * Usage:
 * app.use('/api/check-card', rateLimitMiddleware());
 * 
 * @returns Express middleware function
 */
export function rateLimitMiddleware() {
  return [deviceRateLimitMiddleware(), ipRateLimitMiddleware()];
}

/**
 * Alternative: Using express-rate-limit library (Redis-compatible)
 * This can be used for production with Redis store
 */
export function createExpressRateLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per window per IP
    message: {
      success: false,
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    handler: (req, res) => {
      console.warn(`Rate limit exceeded for IP ${req.ip}`);
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      });
    },
  });
}

/**
 * Get current rate limit status for a device (for testing/monitoring)
 * @param deviceId Device identifier
 * @returns Current count and reset time
 */
export function getDeviceRateLimitStatus(deviceId: string): {
  count: number;
  resetTime: number;
  remaining: number;
} | null {
  const entry = deviceStore[deviceId];
  if (!entry) {
    return null;
  }
  return {
    count: entry.count,
    resetTime: entry.resetTime,
    remaining: Math.max(0, 60 - entry.count),
  };
}

/**
 * Get current rate limit status for an IP (for testing/monitoring)
 * @param ip IP address
 * @returns Current count and reset time
 */
export function getIpRateLimitStatus(ip: string): {
  count: number;
  resetTime: number;
  remaining: number;
} | null {
  const entry = ipStore[ip];
  if (!entry) {
    return null;
  }
  return {
    count: entry.count,
    resetTime: entry.resetTime,
    remaining: Math.max(0, 100 - entry.count),
  };
}

/**
 * Clear rate limit stores (for testing)
 */
export function clearRateLimitStores(): void {
  Object.keys(deviceStore).forEach((key) => delete deviceStore[key]);
  Object.keys(ipStore).forEach((key) => delete ipStore[key]);
}
