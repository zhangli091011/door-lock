# Signature Utilities

## Overview

The signature utilities module provides HMAC-SHA256 signature generation and verification for securing API requests between ESP32 devices and the cloud server. This implements requirements 10.4, 10.5, 10.6, and 2.8 from the system design.

## Features

- **HMAC-SHA256 Signature Generation**: Creates cryptographically secure signatures for request payloads
- **Signature Verification**: Validates request signatures using timing-safe comparison
- **Timestamp Validation**: Prevents replay attacks by validating request timestamps (default: 5-minute window)
- **Complete Request Verification**: Combined signature and timestamp validation

## Usage

### Generating a Signature (ESP32 Client)

```typescript
import { generateSignature, SignaturePayload } from './signatureUtils';

const payload: SignaturePayload = {
  uid: '04A1B2C3D4E5F6',
  device_id: 'door_1',
  timestamp: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
};

const secretKey = 'your_device_secret_key';
const signature = generateSignature(payload, secretKey);

// Send in request body
const requestBody = {
  ...payload,
  signature,
};
```

### Verifying a Request (Server)

```typescript
import { verifyRequest } from './signatureUtils';

const payload = {
  uid: req.body.uid,
  device_id: req.body.device_id,
  timestamp: req.body.timestamp,
};

const receivedSignature = req.body.signature;
const deviceSecretKey = device.secret_key;

const result = verifyRequest(payload, receivedSignature, deviceSecretKey);

if (result.valid) {
  // Request is valid, proceed
  console.log(`Request verified (${result.timeDiff}s old)`);
} else {
  // Request is invalid
  console.error(`Verification failed: ${result.error}`);
  res.status(401).json({ error: result.error });
}
```

### Custom Timestamp Window

```typescript
// Allow requests up to 10 minutes old
const result = verifyRequest(payload, signature, secretKey, 600);
```

## API Reference

### `generateSignature(payload, secretKey)`

Generates an HMAC-SHA256 signature for the given payload.

**Parameters:**
- `payload: SignaturePayload` - Request payload containing uid, device_id, and timestamp
- `secretKey: string` - Device secret key

**Returns:** `string` - 64-character hexadecimal signature

**Algorithm:**
1. Construct sign string: `uid|device_id|timestamp`
2. Calculate HMAC-SHA256 using secret key
3. Convert to hexadecimal string

### `verifySignature(payload, receivedSignature, secretKey)`

Verifies a request signature.

**Parameters:**
- `payload: SignaturePayload` - Request payload
- `receivedSignature: string` - Signature from request
- `secretKey: string` - Device secret key

**Returns:** `boolean` - True if signature is valid

**Security:** Uses `crypto.timingSafeEqual()` to prevent timing attacks

### `validateTimestamp(timestamp, maxAgeSeconds?)`

Validates a timestamp to prevent replay attacks.

**Parameters:**
- `timestamp: number` - Unix timestamp in seconds
- `maxAgeSeconds: number` - Maximum age in seconds (default: 300 = 5 minutes)

**Returns:** `{ valid: boolean, timeDiff: number }`
- `valid` - Whether timestamp is within acceptable range
- `timeDiff` - Absolute time difference in seconds

### `verifyRequest(payload, receivedSignature, secretKey, maxAgeSeconds?)`

Verifies both signature and timestamp in one call.

**Parameters:**
- `payload: SignaturePayload` - Request payload
- `receivedSignature: string` - Signature from request
- `secretKey: string` - Device secret key
- `maxAgeSeconds: number` - Maximum age in seconds (default: 300)

**Returns:** `{ valid: boolean, error?: string, timeDiff?: number }`
- `valid` - Whether request is valid
- `error` - Error message if invalid
- `timeDiff` - Time difference in seconds

## Security Considerations

### Replay Attack Prevention

The timestamp validation prevents replay attacks by rejecting requests older than 5 minutes (configurable). This means:

- Captured requests cannot be replayed after 5 minutes
- Clock synchronization between ESP32 and server is important
- ESP32 should use NTP to maintain accurate time

### Timing Attack Prevention

The signature verification uses `crypto.timingSafeEqual()` to prevent timing attacks. This ensures that signature comparison takes constant time regardless of where the mismatch occurs.

### Secret Key Management

- Each device has a unique `secret_key` stored in the database
- Secret keys should be at least 32 characters long
- Secret keys are never returned via API responses
- ESP32 devices must store secret keys securely (e.g., in encrypted SPIFFS)

### Signature Algorithm

The signature is calculated as:

```
signature = HMAC-SHA256(uid|device_id|timestamp, secret_key)
```

This ensures:
- Any modification to uid, device_id, or timestamp invalidates the signature
- Only devices with the correct secret_key can generate valid signatures
- The pipe character `|` is used as a delimiter to prevent ambiguity

## Integration with Authentication Middleware

The signature verification is integrated into the authentication middleware:

```typescript
import { createDeviceAuthMiddleware } from './middleware/authMiddleware';

// Enable signature verification (default)
app.use('/api/check-card', createDeviceAuthMiddleware(db, true));

// Disable signature verification (for testing)
app.use('/api/test', createDeviceAuthMiddleware(db, false));
```

When signature verification is enabled, the middleware:
1. Validates API Key and Device ID (as before)
2. Extracts signature fields from request body
3. Verifies timestamp is within 5-minute window
4. Verifies signature matches expected value
5. Logs security events for failed verifications

## Testing

Comprehensive unit tests are provided in `signatureUtils.test.ts`:

- Signature generation and verification
- Timestamp validation
- Complete request verification
- Edge cases (empty strings, special characters, long strings)
- Security scenarios (expired timestamps, tampered payloads)

Run tests:
```bash
npm test -- signatureUtils.test.ts
```

## ESP32 Implementation

For the ESP32 client implementation, you'll need to:

1. Include a crypto library that supports HMAC-SHA256 (e.g., mbedTLS, which is included in ESP-IDF)
2. Implement the same signature generation algorithm
3. Ensure accurate timekeeping using NTP

Example ESP32 code structure:

```cpp
#include <mbedtls/md.h>

String generateSignature(String uid, String deviceId, unsigned long timestamp, String secretKey) {
  // Construct sign string
  String signString = uid + "|" + deviceId + "|" + String(timestamp);
  
  // Calculate HMAC-SHA256
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)secretKey.c_str(), secretKey.length());
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)signString.c_str(), signString.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  
  // Convert to hex string
  String signature = "";
  for (int i = 0; i < 32; i++) {
    char hex[3];
    sprintf(hex, "%02x", hmacResult[i]);
    signature += hex;
  }
  
  return signature;
}
```

## Troubleshooting

### "Request timestamp expired" Error

**Cause:** The ESP32's clock is not synchronized with the server.

**Solution:**
- Ensure ESP32 is using NTP to sync time
- Check timezone configuration
- Verify network connectivity for NTP

### "Invalid signature" Error

**Cause:** Signature calculation mismatch between ESP32 and server.

**Solution:**
- Verify secret_key matches on both sides
- Check that sign string format is exactly `uid|device_id|timestamp`
- Ensure timestamp is in Unix seconds (not milliseconds)
- Verify HMAC-SHA256 implementation on ESP32

### Clock Drift

**Symptom:** Requests occasionally fail with timestamp errors.

**Solution:**
- Implement periodic NTP sync on ESP32 (e.g., every hour)
- Consider increasing the timestamp window (not recommended for production)
- Monitor ESP32 uptime and reboot periodically

## Performance

- Signature generation: ~1ms on modern hardware
- Signature verification: ~1ms on modern hardware
- Timestamp validation: <0.1ms

The signature verification adds minimal overhead to request processing.
