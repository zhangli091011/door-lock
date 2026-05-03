# Controllers

Controllers handle HTTP requests and responses for the API endpoints.

## AccessController

**File**: `accessController.ts`

**Purpose**: Handles the POST /api/check-card endpoint for ESP32 device card verification.

**Requirements**: 2.1, 2.2, 2.3, 2.6, 2.7, 8.1, 8.2, 8.3

### Responsibilities

1. **Request Validation**
   - Validates required fields (uid, device_id, timestamp)
   - Validates UID format (8-14 hexadecimal characters)
   - Signature validation is handled by authMiddleware

2. **Access Control**
   - Calls AccessControlService to verify card permissions
   - Checks card existence, enabled status, time slots, device permissions, and date range

3. **Logging**
   - Records all access attempts to the database
   - Includes card name, device name, and verification result
   - Logs source as "cloud" (vs "cache" for ESP32 local cache)

4. **Response**
   - Returns JSON response with access decision
   - Includes allow, cacheable, card_name, and reason fields
   - Always returns 200 OK for successful requests (even if access denied)

### API Endpoint

**POST /api/check-card**

**Middleware Chain**:
1. Rate limiting (device + IP level)
2. Device authentication (API Key + signature verification)
3. Access controller

**Request Headers**:
```
Content-Type: application/json
X-API-Key: {device_api_key}
X-Device-ID: {device_id}
```

**Request Body**:
```json
{
  "uid": "04A1B2C3D4E5F6",
  "device_id": "door_1",
  "timestamp": 1705329025,
  "signature": "a1b2c3d4e5f6..."
}
```

**Response (Access Allowed)**:
```json
{
  "success": true,
  "allow": true,
  "cacheable": true,
  "card_name": "张三",
  "message": "访问允许"
}
```

**Response (Access Denied)**:
```json
{
  "success": true,
  "allow": false,
  "cacheable": false,
  "card_name": "张三",
  "reason": "卡片已禁用",
  "message": "访问拒绝"
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields or invalid UID format
- `401 Unauthorized`: Invalid API Key or signature verification failed
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Usage Example

See `src/examples/checkCardExample.ts` for complete examples of:
- Node.js/TypeScript client implementation
- ESP32 Arduino C++ implementation
- Error handling and fallback to local cache

### Testing

**Unit Tests**: `accessController.test.ts`
- Tests all validation logic
- Tests access allowed/denied scenarios
- Tests error handling

**Integration Tests**: `src/routes/accessRoutes.test.ts`
- Tests complete middleware chain
- Tests authentication and signature verification
- Tests rate limiting
- Tests end-to-end access control flow

Run tests:
```bash
npm test -- accessController.test.ts
npm test -- accessRoutes.test.ts
```

## AuthController

**File**: `authController.ts`

**Purpose**: Handles admin authentication (login and token verification).

**Requirements**: 10.7, 10.8, 9.2, 9.3

See `authController.ts` for implementation details.
