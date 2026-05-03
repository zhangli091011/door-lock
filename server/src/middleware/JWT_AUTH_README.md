# JWT Authentication Implementation

## Overview

This implementation provides JWT-based authentication for web administrators accessing the ESP32 NFC Access Control System management interface.

## Components

### 1. JWT Utilities (`utils/jwtUtils.ts`)

Provides functions for JWT token generation and verification:

- **`generateToken(payload)`**: Generates a JWT token with 24-hour expiration
- **`verifyToken(token)`**: Verifies and decodes a JWT token
- **`extractTokenFromHeader(authHeader)`**: Extracts token from Authorization header
- **`decodeToken(token)`**: Decodes token without verification (for debugging)

### 2. Web Authentication Middleware (`middleware/webAuthMiddleware.ts`)

Express middleware that:
- Extracts JWT token from `Authorization: Bearer <token>` header
- Verifies token validity and expiration
- Attaches admin info to `req.admin` for downstream handlers
- Returns 401 Unauthorized for invalid/missing tokens

### 3. Authentication Controller (`controllers/authController.ts`)

Handles authentication endpoints:

#### Login (`POST /api/auth/login`)
- Validates username and password
- Verifies password using bcrypt
- Generates JWT token on success
- Returns token and safe admin info

#### Verify (`GET /api/auth/verify`)
- Validates current JWT token
- Returns fresh admin info from database
- Requires `webAuthMiddleware`

### 4. Authentication Routes (`routes/authRoutes.ts`)

Defines Express routes:
- `POST /api/auth/login` - Admin login
- `GET /api/auth/verify` - Token verification (protected)

## Usage

### 1. Login

**Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing username or password
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

### 2. Access Protected Routes

**Request:**
```http
GET /api/admin/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "admin": {
      "id": 1,
      "username": "admin"
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing, invalid, or expired token

### 3. Verify Token

**Request:**
```http
GET /api/auth/verify
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "令牌有效",
  "data": {
    "admin": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## Integration Example

```typescript
import express from 'express';
import { Database } from './db';
import { createAuthRoutes } from './routes/authRoutes';
import { webAuthMiddleware } from './middleware/webAuthMiddleware';

const app = express();
app.use(express.json());

const db = new Database({ type: 'sqlite', database: './data/access_control.db' });

// Mount authentication routes
app.use('/api/auth', createAuthRoutes(db));

// Protected routes
app.get('/api/cards', webAuthMiddleware, (req, res) => {
  // req.admin contains { id, username }
  // Handle cards listing
});

app.post('/api/cards', webAuthMiddleware, (req, res) => {
  // Handle card creation
});
```

## Configuration

Set the JWT secret in environment variables:

```bash
JWT_SECRET=your_secure_random_secret_key_at_least_32_characters
```

**Important:** Change the default JWT secret in production!

## Token Details

- **Algorithm**: HS256 (HMAC-SHA256)
- **Expiration**: 24 hours
- **Payload**: `{ id: number, username: string, iat: number, exp: number }`

## Security Considerations

1. **HTTPS Required**: Always use HTTPS in production to protect tokens in transit
2. **Secret Key**: Use a strong, random JWT secret (minimum 32 characters)
3. **Token Storage**: Store tokens securely on the client (e.g., httpOnly cookies or secure localStorage)
4. **Token Expiration**: Tokens expire after 24 hours; implement token refresh if needed
5. **Password Hashing**: Passwords are hashed with bcrypt (cost factor 10)

## Testing

Run tests:
```bash
npm test -- --testPathPattern="jwtUtils|webAuthMiddleware|authController"
```

All tests include:
- JWT token generation and verification
- Token extraction from headers
- Middleware authentication flow
- Login success and failure scenarios
- Password verification with bcrypt
- Error handling

## Requirements Satisfied

This implementation satisfies the following requirements from the design document:

- **需求 10.7**: Web管理员请求包含Bearer Token
- **需求 10.8**: 云端API验证JWT令牌有效性和过期时间
- **需求 9.2**: 管理员登录成功后生成JWT令牌
- **需求 9.3**: JWT令牌过期后自动跳转登录页面

## Files Created

- `src/utils/jwtUtils.ts` - JWT utility functions
- `src/utils/jwtUtils.test.ts` - JWT utility tests
- `src/middleware/webAuthMiddleware.ts` - Web authentication middleware
- `src/middleware/webAuthMiddleware.test.ts` - Middleware tests
- `src/controllers/authController.ts` - Authentication controller
- `src/controllers/authController.test.ts` - Controller tests
- `src/routes/authRoutes.ts` - Authentication routes
- `src/examples/authExample.ts` - Integration example
