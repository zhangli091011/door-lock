/**
 * Web Auth Middleware Tests
 * Web认证中间件测试
 */

import { Request, Response, NextFunction } from 'express';
import { webAuthMiddleware } from './webAuthMiddleware';
import { generateToken } from '../utils/jwtUtils';

describe('Web Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  it('should pass with valid token', () => {
    const payload = { id: 1, username: 'admin' };
    const token = generateToken(payload);
    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    webAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRequest.admin).toBeDefined();
    expect(mockRequest.admin?.id).toBe(payload.id);
    expect(mockRequest.admin?.username).toBe(payload.username);
  });

  it('should reject request without token', () => {
    mockRequest.headers = {};

    webAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'No token provided',
      message: '未提供认证令牌',
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject request with invalid token', () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid.token.here',
    };

    webAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid or expired token',
      message: '令牌无效或已过期',
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject request with malformed authorization header', () => {
    mockRequest.headers = {
      authorization: 'NotBearer token',
    };

    webAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'No token provided',
      message: '未提供认证令牌',
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject request with empty authorization header', () => {
    mockRequest.headers = {
      authorization: '',
    };

    webAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject request with only Bearer in header', () => {
    mockRequest.headers = {
      authorization: 'Bearer',
    };

    webAuthMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
