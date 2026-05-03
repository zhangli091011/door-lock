/**
 * JWT Utils Tests
 * JWT工具函数测试
 */

import { generateToken, verifyToken, extractTokenFromHeader, decodeToken } from './jwtUtils';

describe('JWT Utils', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        id: 1,
        username: 'admin',
      };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should generate different tokens for different payloads', () => {
      const payload1 = { id: 1, username: 'admin1' };
      const payload2 = { id: 2, username: 'admin2' };

      const token1 = generateToken(payload1);
      const token2 = generateToken(payload2);

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const payload = {
        id: 1,
        username: 'admin',
      };

      const token = generateToken(payload);
      const verified = verifyToken(token);

      expect(verified).toBeDefined();
      expect(verified?.id).toBe(payload.id);
      expect(verified?.username).toBe(payload.username);
      expect(verified?.iat).toBeDefined();
      expect(verified?.exp).toBeDefined();
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const verified = verifyToken(invalidToken);

      expect(verified).toBeNull();
    });

    it('should return null for malformed token', () => {
      const malformedToken = 'not-a-jwt-token';
      const verified = verifyToken(malformedToken);

      expect(verified).toBeNull();
    });

    it('should return null for empty token', () => {
      const verified = verifyToken('');

      expect(verified).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('should decode a token without verification', () => {
      const payload = {
        id: 1,
        username: 'admin',
      };

      const token = generateToken(payload);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.id).toBe(payload.id);
      expect(decoded?.username).toBe(payload.username);
    });

    it('should return null for invalid token format', () => {
      const decoded = decodeToken('not-a-token');

      expect(decoded).toBeNull();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      const authHeader = `Bearer ${token}`;

      const extracted = extractTokenFromHeader(authHeader);

      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      const extracted = extractTokenFromHeader(undefined);

      expect(extracted).toBeNull();
    });

    it('should return null for invalid format (no Bearer)', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      const authHeader = token; // Missing "Bearer " prefix

      const extracted = extractTokenFromHeader(authHeader);

      expect(extracted).toBeNull();
    });

    it('should return null for invalid format (wrong prefix)', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      const authHeader = `Basic ${token}`;

      const extracted = extractTokenFromHeader(authHeader);

      expect(extracted).toBeNull();
    });

    it('should return null for empty header', () => {
      const extracted = extractTokenFromHeader('');

      expect(extracted).toBeNull();
    });

    it('should return null for header with only Bearer', () => {
      const extracted = extractTokenFromHeader('Bearer');

      expect(extracted).toBeNull();
    });

    it('should return null for header with extra parts', () => {
      const authHeader = 'Bearer token extra';

      const extracted = extractTokenFromHeader(authHeader);

      expect(extracted).toBeNull();
    });
  });

  describe('Token expiration', () => {
    it('should include expiration time in token', () => {
      const payload = {
        id: 1,
        username: 'admin',
      };

      const token = generateToken(payload);
      const verified = verifyToken(token);

      expect(verified?.exp).toBeDefined();
      expect(verified?.iat).toBeDefined();

      // Token should expire in 24 hours (86400 seconds)
      const expiresIn = verified!.exp! - verified!.iat!;
      expect(expiresIn).toBe(86400); // 24 hours in seconds
    });
  });
});
