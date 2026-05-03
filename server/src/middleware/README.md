# Authentication Middleware

## Device API Key Authentication Middleware

This middleware authenticates ESP32 devices using API Key and Device ID headers.

### Features

- ✅ Validates `X-API-Key` and `X-Device-ID` request headers
- ✅ Verifies API Key matches Device ID in database
- ✅ Checks if device is enabled
- ✅ Updates device `last_seen` timestamp automatically
- ✅ Attaches device information to request object

### Requirements

Implements requirements:
- **10.1**: ESP32 devices must include X-API-Key and X-Device-ID in request headers
- **10.2**: Cloud API must verify API Key matches Device ID
- **10.3**: API Key validation failure returns 401 Unauthorized
- **7.3**: Device last_seen timestamp is updated on each API request

### Usage

```typescript
import express from 'express';
import { Database } from './db';
import { createDeviceAuthMiddleware } from './middleware';

const app = express();
const db = new Database({ /* config */ });

// Create the middleware
const deviceAuth = createDeviceAuthMiddleware(db);

// Apply to specific routes
app.post('/api/check-card', deviceAuth, (req, res) => {
  // Access authenticated device info
  const device = req.device;
  console.log(`Request from device: ${device.device_id}`);
  
  // Your route logic here
  res.json({ success: true });
});

// Or apply globally to all routes
app.use('/api', deviceAuth);
```

### Request Headers

The middleware expects the following headers:

```
X-API-Key: sk_live_your_device_api_key_32chars_long
X-Device-ID: door_1
```

### Response Codes

| Status Code | Scenario |
|-------------|----------|
| 200 | Authentication successful (proceeds to next middleware) |
| 401 | Missing headers, invalid device ID, incorrect API key, or device disabled |
| 500 | Internal server error (database error) |

### Error Responses

**Missing Headers:**
```json
{
  "success": false,
  "error": "Missing authentication headers",
  "message": "X-API-Key and X-Device-ID headers are required"
}
```

**Invalid Device ID:**
```json
{
  "success": false,
  "error": "Invalid device ID",
  "message": "Device not found"
}
```

**Incorrect API Key:**
```json
{
  "success": false,
  "error": "Invalid API key",
  "message": "API Key does not match device ID"
}
```

**Device Disabled:**
```json
{
  "success": false,
  "error": "Device disabled",
  "message": "This device has been disabled"
}
```

**Internal Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "An error occurred during authentication"
}
```

### Authenticated Request Object

After successful authentication, the middleware attaches device information to the request:

```typescript
interface AuthenticatedRequest extends Request {
  device?: {
    device_id: string;
    name: string;
    enabled: boolean;
  };
}
```

### Example Route Handler

```typescript
import { AuthenticatedRequest } from './middleware';

app.post('/api/check-card', deviceAuth, (req: AuthenticatedRequest, res) => {
  // Device info is available
  const deviceId = req.device?.device_id;
  const deviceName = req.device?.name;
  
  console.log(`Card check request from ${deviceName} (${deviceId})`);
  
  // Your logic here
  res.json({ success: true });
});
```

### Testing

Run the test suite:

```bash
npm test -- authMiddleware.test.ts
```

Test coverage includes:
- ✅ Valid authentication with correct API key
- ✅ Last_seen timestamp update
- ✅ Missing X-API-Key header
- ✅ Missing X-Device-ID header
- ✅ Non-existent device ID
- ✅ Incorrect API key
- ✅ Disabled device
- ✅ Database error handling

### Security Considerations

1. **API Key Storage**: API keys are stored in the database and compared directly. Ensure database access is properly secured.

2. **HTTPS Required**: In production, always use HTTPS to prevent API keys from being intercepted.

3. **Rate Limiting**: This middleware should be used in conjunction with rate limiting middleware to prevent brute force attacks.

4. **Device Management**: Administrators can disable devices through the device management API, which immediately prevents authentication.

5. **Last Seen Tracking**: The automatic `last_seen` update helps monitor device connectivity and detect offline devices.

---

## Rate Limiting Middleware

This middleware implements device-level and IP-level rate limiting to prevent DDoS attacks and resource abuse.

### Features

- ✅ Device-level rate limiting (60 requests per minute per device)
- ✅ IP-level rate limiting (100 requests per minute per IP address)
- ✅ In-memory storage for counters (production-ready)
- ✅ Returns 429 status code with Retry-After header
- ✅ Security event logging when limits are exceeded
- ✅ Automatic cleanup of expired entries
- ✅ Support for proxy headers (X-Forwarded-For, X-Real-IP)

### Requirements

Implements requirements:
- **11.1**: Device-level limit of 60 requests per minute
- **11.2**: IP-level limit of 100 requests per minute
- **11.3**: Security logging when rate limits are triggered
- **11.4**: 429 status code with Retry-After header

### Usage

```typescript
import express from 'express';
import { rateLimitMiddleware } from './middleware';

const app = express();

// Apply to specific routes (recommended)
app.post('/api/check-card', rateLimitMiddleware(), (req, res) => {
  // Your route logic here
  res.json({ success: true });
});

// Or apply globally to all API routes
app.use('/api', rateLimitMiddleware());
```

### Individual Middleware

You can also use device-level and IP-level rate limiting separately:

```typescript
import { deviceRateLimitMiddleware, ipRateLimitMiddleware } from './middleware';

// Only device-level rate limiting
app.post('/api/check-card', deviceRateLimitMiddleware(), (req, res) => {
  res.json({ success: true });
});

// Only IP-level rate limiting
app.post('/api/public-endpoint', ipRateLimitMiddleware(), (req, res) => {
  res.json({ success: true });
});

// Both (same as rateLimitMiddleware())
app.post('/api/check-card', 
  deviceRateLimitMiddleware(), 
  ipRateLimitMiddleware(), 
  (req, res) => {
    res.json({ success: true });
  }
);
```

### Rate Limits

| Type | Limit | Window | Identifier |
|------|-------|--------|------------|
| Device | 60 requests | 1 minute | Device ID (from `req.device.device_id` or `X-Device-ID` header) |
| IP | 100 requests | 1 minute | IP address (from `X-Forwarded-For`, `X-Real-IP`, or `req.socket.remoteAddress`) |

### Response When Limit Exceeded

**Status Code:** 429 Too Many Requests

**Headers:**
```
Retry-After: 45
```

**Response Body (Device Limit):**
```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Device rate limit exceeded. Maximum 60 requests per minute."
}
```

**Response Body (IP Limit):**
```json
{
  "success": false,
  "error": "Too many requests",
  "message": "IP rate limit exceeded. Maximum 100 requests per minute."
}
```

### Monitoring Functions

The middleware provides utility functions for monitoring rate limit status:

```typescript
import { 
  getDeviceRateLimitStatus, 
  getIpRateLimitStatus 
} from './middleware';

// Check device rate limit status
const deviceStatus = getDeviceRateLimitStatus('door_1');
if (deviceStatus) {
  console.log(`Device door_1: ${deviceStatus.count} requests, ${deviceStatus.remaining} remaining`);
  console.log(`Resets at: ${new Date(deviceStatus.resetTime)}`);
}

// Check IP rate limit status
const ipStatus = getIpRateLimitStatus('192.168.1.100');
if (ipStatus) {
  console.log(`IP 192.168.1.100: ${ipStatus.count} requests, ${ipStatus.remaining} remaining`);
}
```

### Testing Utilities

For testing purposes, you can clear the rate limit stores:

```typescript
import { clearRateLimitStores } from './middleware';

// Clear all rate limit counters (useful in test setup)
beforeEach(() => {
  clearRateLimitStores();
});
```

### Testing

Run the test suite:

```bash
npm test -- rateLimitMiddleware.test.ts
```

Test coverage includes:
- ✅ Device-level rate limiting (60 requests per minute)
- ✅ IP-level rate limiting (100 requests per minute)
- ✅ Separate tracking for different devices
- ✅ Separate tracking for different IPs
- ✅ Retry-After header calculation
- ✅ X-Forwarded-For header support (proxy)
- ✅ X-Real-IP header support
- ✅ Security event logging
- ✅ Combined device and IP rate limiting
- ✅ Rate limit status monitoring functions

### Security Considerations

1. **In-Memory Storage**: The current implementation uses in-memory storage for rate limit counters. This is suitable for single-server deployments. For multi-server deployments, consider using Redis (see Redis Integration below).

2. **Automatic Cleanup**: Expired entries are automatically cleaned up every minute to prevent memory leaks.

3. **Proxy Support**: The middleware correctly handles proxy headers (`X-Forwarded-For`, `X-Real-IP`) to identify the real client IP address.

4. **Security Logging**: All rate limit violations are logged to the console with device ID or IP address for security monitoring.

5. **Graceful Degradation**: If device ID or IP cannot be determined, the middleware skips rate limiting for that request rather than blocking it.

### Redis Integration (Optional)

For production deployments with multiple servers, you can use the Redis-compatible rate limiter:

```typescript
import { createExpressRateLimiter } from './middleware';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const limiter = createExpressRateLimiter({
  store: new RedisStore({
    client: redis,
    prefix: 'rate_limit:',
  }),
});

app.use('/api', limiter);
```

### Performance Considerations

1. **Memory Usage**: Each rate limit entry stores approximately 24 bytes (key + count + resetTime). With 1000 active devices and IPs, memory usage is ~24KB.

2. **Cleanup Overhead**: Cleanup runs every 60 seconds and iterates through all entries. With thousands of entries, consider increasing the cleanup interval.

3. **Scalability**: For high-traffic deployments (>10,000 requests/minute), consider using Redis for distributed rate limiting.

### Integration Example

Complete example with authentication and rate limiting:

```typescript
import express from 'express';
import { Database } from './db';
import { 
  createDeviceAuthMiddleware, 
  rateLimitMiddleware 
} from './middleware';

const app = express();
const db = new Database({ /* config */ });

// Create middlewares
const deviceAuth = createDeviceAuthMiddleware(db);
const rateLimit = rateLimitMiddleware();

// Apply to API routes
app.post('/api/check-card', 
  rateLimit,      // Rate limiting first
  deviceAuth,     // Then authentication
  (req, res) => {
    // Your route logic here
    res.json({ success: true });
  }
);
```

### Next Steps

After implementing this middleware, you should:

1. Apply rate limiting to all API endpoints
2. Monitor rate limit violations in production
3. Consider Redis integration for multi-server deployments
4. Implement alerting for excessive rate limit violations
