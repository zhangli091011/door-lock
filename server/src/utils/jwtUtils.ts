/**
 * JWT Utilities
 * JWT令牌生成和验证工具
 * 
 * Provides functions for generating and verifying JWT tokens for web admin authentication
 */

import jwt from 'jsonwebtoken';

/**
 * JWT Payload structure
 */
export interface JWTPayload {
  id: number;           // Admin ID
  username: string;     // Admin username
  iat?: number;         // Issued at (automatically added by jwt.sign)
  exp?: number;         // Expiration time (automatically added by jwt.sign)
}

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
const JWT_EXPIRES_IN = '24h'; // Token valid for 24 hours

/**
 * Generate JWT token for admin user
 * @param payload JWT payload containing admin info
 * @returns JWT token string
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify JWT token and extract payload
 * @param token JWT token string
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
}

/**
 * Decode JWT token without verification (for debugging)
 * @param token JWT token string
 * @returns Decoded payload or null if invalid format
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader Authorization header value (e.g., "Bearer <token>")
 * @returns Token string or null if invalid format
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
