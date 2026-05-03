# Task 4.2 Implementation Summary

## 任务：实现权限验证API端点

**Task**: 4.2 实现权限验证API端点

**Status**: ✅ Completed

**Requirements**: 2.1, 2.2, 2.3, 2.6, 2.7, 8.1, 8.2, 8.3

## Implementation Overview

Created the POST /api/check-card endpoint that ESP32 devices use to verify NFC card access permissions. The endpoint integrates authentication middleware, rate limiting, access control service, and access logging.

## Files Created

### 1. `src/controllers/accessController.ts`
**Purpose**: Main controller for card access verification

**Key Features**:
- Request validation (UID format, required fields)
- Integration with AccessControlService for permission checks
- Access log recording to database
- Proper error handling and response formatting

**Methods**:
- `checkCard(req, res)`: Main endpoint handler
- `isValidUid(uid)`: UID format validation (8-14 hex characters)

### 2. `src/routes/accessRoutes.ts`
**Purpose**: Route configuration for access control endpoints

**Middleware Chain**:
1. Rate limiting (device + IP level)
2. Device authentication (API Key + signature verification)
3. Access controller

**Endpoints**:
- `POST /api/check-card`: Card verification endpoint

### 3. `src/controllers/accessController.test.ts`
**Purpose**: Unit tests for AccessController

**Test Coverage** (8 tests):
- ✅ Allow access for valid enabled card
- ✅ Deny access for disabled card
- ✅ Deny access for non-existent card
- ✅ Return 400 for missing required fields
- ✅ Return 400 for invalid UID format
- ✅ Return 400 for UID too short
- ✅ Return 400 for UID too long
- ✅ Record access log for all attempts

### 4. `src/routes/accessRoutes.test.ts`
**Purpose**: Integration tests for complete middleware chain

**Test Coverage** (6 tests):
- ✅ Successfully verify card with valid authentication and signature
- ✅ Reject request with invalid API key
- ✅ Reject request with invalid signature
- ✅ Reject request with expired timestamp
- ✅ Reject request without authentication headers
- ✅ Deny access for disabled card

### 5. `src/examples/checkCardExample.ts`
**Purpose**: Usage examples and documentation

**Contents**:
- Node.js/TypeScript client example
- ESP32 Arduino C++ implementation example
- Error handling patterns
- Complete request/response examples

### 6. `src/controllers/README.md`
**Purpose**: Controller documentation

**Contents**:
- AccessController responsibilities
- API endpoint specification
- Request/response formats
- Error codes
- Testing instructions

### 7. `src/routes/index.ts` & `src/controllers/index.ts`
**Purpose**: Module exports for clean imports

## API Specification

### Endpoint: POST /api/check-card

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

**Response (Success - Access Allowed)**:
```json
{
  "success": true,
  "allow": true,
  "cacheable": true,
  "card_name": "张三",
  "message": "访问允许"
}
```

**Response (Success - Access Denied)**:
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
- `400 Bad Request`: Invalid request (missing fields, invalid UID format)
- `401 Unauthorized`: Authentication failed (invalid API Key or signature)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Integration Points

### 1. Authentication Middleware
- Uses `createDeviceAuthMiddleware` from `src/middleware/authMiddleware.ts`
- Validates X-API-Key and X-Device-ID headers
- Verifies HMAC-SHA256 signature
- Checks timestamp to prevent replay attacks (5 minute window)
- Updates device last_seen timestamp

### 2. Rate Limiting Middleware
- Uses `rateLimitMiddleware` from `src/middleware/rateLimitMiddleware.ts`
- Device-level: 60 requests per minute
- IP-level: 100 requests per minute
- Returns 429 with Retry-After header when exceeded

### 3. Access Control Service
- Uses `AccessControlService` from `src/services/accessControlService.ts`
- Checks card existence and enabled status
- Validates access date range (access_start, access_end)
- Validates time slots (e.g., "09:00-18:00")
- Validates device permissions (allowed_devices)
- Returns allow/deny decision with reason

### 4. Access Log Repository
- Uses `AccessLogRepository` from `src/repositories/AccessLogRepository.ts`
- Records all access attempts to database
- Includes uid, device_id, timestamp, allowed, reason, source, card_name, device_name
- Source is always "cloud" (vs "cache" for ESP32 local cache)

## Testing Results

### Unit Tests (accessController.test.ts)
```
✓ should allow access for valid enabled card (5 ms)
✓ should deny access for disabled card (1 ms)
✓ should deny access for non-existent card
✓ should return 400 for missing required fields
✓ should return 400 for invalid UID format (1 ms)
✓ should return 400 for UID that is too short (1 ms)
✓ should return 400 for UID that is too long
✓ should record access log for both allowed and denied access (1 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

### Integration Tests (accessRoutes.test.ts)
```
✓ should successfully verify card with valid authentication and signature (465 ms)
✓ should reject request with invalid API key (7 ms)
✓ should reject request with invalid signature (29 ms)
✓ should reject request with expired timestamp (13 ms)
✓ should reject request without authentication headers (7 ms)
✓ should deny access for disabled card (6 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

**Total**: 14 tests, all passing ✅

## Requirements Validation

### ✅ Requirement 2.1: ESP32 sends verification request
- Endpoint accepts POST /api/check-card with uid, device_id, timestamp, signature

### ✅ Requirement 2.2: Request includes authentication
- X-API-Key and X-Device-ID headers required
- HMAC-SHA256 signature verification

### ✅ Requirement 2.3: API Key and signature validation
- authMiddleware validates API Key matches device
- signatureUtils verifies HMAC-SHA256 signature
- Timestamp validation prevents replay attacks

### ✅ Requirement 2.6: All permission checks pass → allow=true
- AccessControlService performs all checks
- Returns allow=true only when all checks pass

### ✅ Requirement 2.7: Any permission check fails → allow=false with reason
- Returns allow=false with specific reason
- Reasons include: "卡片不存在", "卡片已禁用", "不在允许时间段内", "不允许访问此设备", "权限已过期", "权限尚未生效"

### ✅ Requirement 8.1: Record all access attempts
- AccessLogRepository.create() called for every request
- Records both allowed and denied attempts

### ✅ Requirement 8.2: Log includes all required fields
- uid, device_id, timestamp, allowed, reason, source, card_name, device_name

### ✅ Requirement 8.3: Reason included when denied
- reason field populated when allow=false

## Security Features

1. **Authentication**: API Key + Device ID validation
2. **Signature Verification**: HMAC-SHA256 prevents request tampering
3. **Replay Attack Prevention**: Timestamp validation (5 minute window)
4. **Rate Limiting**: Device-level (60/min) and IP-level (100/min)
5. **Input Validation**: UID format, required fields
6. **Audit Logging**: All access attempts recorded

## Next Steps

This endpoint is now ready for:
1. Integration with main Express application (server.ts)
2. ESP32 firmware implementation (Task 11.5)
3. End-to-end testing with actual ESP32 hardware
4. Production deployment

## Usage

### From Node.js/TypeScript:
```typescript
import { checkCardAccess } from './examples/checkCardExample';
await checkCardAccess('04A1B2C3D4E5F6');
```

### From ESP32 (Arduino C++):
See `src/examples/checkCardExample.ts` for complete ESP32 implementation example.

### Testing:
```bash
# Run unit tests
npm test -- accessController.test.ts

# Run integration tests
npm test -- accessRoutes.test.ts

# Run all tests
npm test
```

## Notes

- The endpoint always returns 200 OK for successful requests, even when access is denied
- This allows ESP32 to distinguish between "access denied" (200 with allow=false) and "server error" (500)
- Access logs are recorded before sending response to ensure logging even if response fails
- Device last_seen timestamp is updated by authMiddleware for online status tracking
