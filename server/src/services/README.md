# Access Control Service

## Overview

The Access Control Service (`accessControlService.ts`) implements the core permission verification logic for the ESP32 NFC Cloud Access Control System. It validates card access permissions based on multiple criteria including card status, time slots, device permissions, and access date ranges.

## Features

- **Card Existence Check**: Verifies that the card exists in the database
- **Enabled Status Check**: Ensures the card is enabled for access
- **Access Date Range Validation**: Checks if current time is within `access_start` and `access_end` dates
- **Time Slots Validation**: Validates access against allowed time slots (e.g., "09:00-18:00")
- **Device Permissions Validation**: Ensures the card is authorized for the specific device
- **Detailed Rejection Reasons**: Provides specific reasons when access is denied
- **Cacheable Flag**: Indicates whether the result can be cached by ESP32 devices

## Requirements Implemented

This service implements the following requirements from the specification:

- **2.4**: Card existence and enabled status check
- **2.5**: Access time slot validation
- **2.6**: Device permission validation
- **2.7**: Access date range validation
- **6.6**: Card enabled/disabled status enforcement
- **12.2**: Time slot format validation
- **12.3**: Time slot access control
- **13.2**: Device permission list validation
- **13.3**: Device access control

## Usage

### Basic Usage

```typescript
import { Database, DatabaseType } from '../db';
import { CardRepository } from '../repositories/CardRepository';
import { AccessControlService } from '../services/accessControlService';

// Initialize database and repositories
const db = new Database({
  type: DatabaseType.SQLITE,
  sqlitePath: './data/access_control.db',
});

const cardRepository = new CardRepository(db);
const accessControlService = new AccessControlService(cardRepository);

// Verify card access
const result = await accessControlService.verifyAccess({
  uid: '04A1B2C3D4E5F6',
  device_id: 'door_1',
  timestamp: new Date(), // Optional, defaults to current time
});

if (result.allowed) {
  console.log(`Access granted for ${result.card_name}`);
  console.log(`Cacheable: ${result.cacheable}`);
} else {
  console.log(`Access denied: ${result.reason}`);
}
```

### Integration with API Endpoint

```typescript
import express from 'express';
import { AccessControlService } from '../services/accessControlService';

const router = express.Router();

router.post('/api/check-card', async (req, res) => {
  const { uid, device_id } = req.body;

  try {
    const result = await accessControlService.verifyAccess({
      uid,
      device_id,
    });

    res.json({
      success: true,
      allow: result.allowed,
      cacheable: result.cacheable,
      card_name: result.card_name,
      reason: result.reason,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});
```

## API Reference

### `AccessControlService`

#### Constructor

```typescript
constructor(cardRepository: CardRepository)
```

Creates a new instance of the AccessControlService.

**Parameters:**
- `cardRepository`: CardRepository instance for database access

#### Methods

##### `verifyAccess(request: AccessVerificationRequest): Promise<AccessVerificationResult>`

Verifies card access permissions based on multiple criteria.

**Parameters:**
- `request.uid` (string): Card UID to verify
- `request.device_id` (string): Device ID making the request
- `request.timestamp` (Date, optional): Request timestamp (defaults to current time)

**Returns:**
- `allowed` (boolean): Whether access is granted
- `reason` (string, optional): Rejection reason if access is denied
- `card_name` (string, optional): Card holder name
- `cacheable` (boolean): Whether this result can be cached by ESP32

**Validation Order:**
1. Card existence check
2. Card enabled status check
3. Access date range validation (access_start to access_end)
4. Time slots validation
5. Device permissions validation

## Validation Rules

### Card Enabled Status

- **Allowed**: Card `enabled` field is `true`
- **Denied**: Card `enabled` field is `false`
- **Reason**: "卡片已禁用"
- **Cacheable**: `false`

### Access Date Range

- **Allowed**: Current time is between `access_start` and `access_end` (if set)
- **Denied (before start)**: Current time is before `access_start`
- **Reason**: "权限尚未生效"
- **Denied (after end)**: Current time is after `access_end`
- **Reason**: "权限已过期"
- **Cacheable**: `false`

### Time Slots

- **Format**: JSON array of "HH:MM-HH:MM" strings
- **Example**: `["09:00-12:00", "14:00-18:00"]`
- **Allowed**: Current time falls within any time slot
- **Denied**: Current time is outside all time slots
- **Reason**: "不在允许时间段内"
- **Cacheable**: `true` (card's cacheable setting)
- **Special**: Supports overnight slots (e.g., "22:00-02:00")
- **No restriction**: `null` or empty array allows 24/7 access

### Device Permissions

- **Format**: JSON array of device ID strings
- **Example**: `["door_1", "door_2"]`
- **Allowed**: Device ID is in the allowed list
- **Denied**: Device ID is not in the allowed list
- **Reason**: "不允许访问此设备"
- **Cacheable**: `false`
- **No restriction**: `null` or empty array allows all devices

## Testing

The service includes comprehensive unit tests covering all validation scenarios:

```bash
# Run tests
npm test -- accessControlService.test.ts

# Run tests with coverage
npm test -- --coverage accessControlService.test.ts
```

### Test Coverage

- Card existence check
- Card enabled status check
- Access date range validation (before start, after end, within range)
- Time slots validation (single slot, multiple slots, overnight slots)
- Device permissions validation
- Invalid JSON handling
- Complex scenarios with multiple restrictions

## Examples

See `src/examples/accessControlExample.ts` for a complete working example demonstrating:

1. Adding a test card
2. Valid access verification
3. Time slot restriction
4. Device permission restriction
5. Disabled card handling
6. Non-existent card handling

Run the example:

```bash
npx ts-node src/examples/accessControlExample.ts
```

## Error Handling

The service handles errors gracefully:

- **Invalid JSON**: Treats invalid `time_slots` or `allowed_devices` JSON as no restriction
- **Missing card**: Returns `allowed: false` with reason "卡片不存在"
- **Database errors**: Propagates errors to caller for proper handling

## Performance Considerations

- **Single database query**: Only one query to fetch card data
- **In-memory validation**: All checks performed in memory after fetching card
- **No external dependencies**: Pure TypeScript logic for validation
- **Efficient time comparison**: Uses minutes-since-midnight for time slot checks

## Future Enhancements

Potential improvements for future versions:

- [ ] Support for recurring schedules (weekday/weekend patterns)
- [ ] Holiday calendar integration
- [ ] Temporary access codes with expiration
- [ ] Multi-factor authentication support
- [ ] Access attempt rate limiting per card
- [ ] Geofencing validation
- [ ] Card group permissions

## Related Files

- `src/services/accessControlService.ts` - Service implementation
- `src/services/accessControlService.test.ts` - Unit tests
- `src/examples/accessControlExample.ts` - Usage example
- `src/repositories/CardRepository.ts` - Card data access layer
- `src/models/Card.ts` - Card data model

## License

Part of the ESP32 NFC Cloud Access Control System.
