/**
 * Authentication Example
 * 认证示例
 * 
 * Demonstrates how to integrate JWT authentication in the Express app
 */

import express from 'express';
import { Database, DatabaseType } from '../db';
import { createAuthRoutes } from '../routes/authRoutes';
import { webAuthMiddleware } from '../middleware/webAuthMiddleware';

/**
 * Example: Setting up authentication routes
 */
export function setupAuthenticationExample() {
  const app = express();
  
  // Parse JSON request bodies
  app.use(express.json());

  // Initialize database
  const db = new Database({
    type: DatabaseType.SQLITE,
    sqlitePath: './data/access_control.db',
  });

  // Mount authentication routes
  app.use('/api/auth', createAuthRoutes(db));

  // Example protected route
  app.get('/api/admin/profile', webAuthMiddleware, (req, res) => {
    res.json({
      success: true,
      message: 'Protected route accessed',
      data: {
        admin: req.admin,
      },
    });
  });

  return app;
}

/**
 * Example usage:
 * 
 * 1. Login:
 *    POST /api/auth/login
 *    Body: { "username": "admin", "password": "admin123" }
 *    Response: { "success": true, "data": { "token": "eyJhbGc...", "admin": {...} } }
 * 
 * 2. Access protected route:
 *    GET /api/admin/profile
 *    Headers: { "Authorization": "Bearer eyJhbGc..." }
 *    Response: { "success": true, "data": { "admin": {...} } }
 * 
 * 3. Verify token:
 *    GET /api/auth/verify
 *    Headers: { "Authorization": "Bearer eyJhbGc..." }
 *    Response: { "success": true, "message": "令牌有效", "data": { "admin": {...} } }
 */
