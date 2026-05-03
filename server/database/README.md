# Database Schema Documentation

This directory contains the database initialization scripts for the ESP32 NFC Cloud Access Control System.

## Files

- `schema.sqlite.sql` - SQLite database schema (for local deployment)
- `schema.postgresql.sql` - PostgreSQL database schema (for cloud deployment)

## Database Tables

### 1. cards (卡片表)
Stores NFC card information and access permissions.

**Columns:**
- `uid` (PRIMARY KEY) - NFC card UID (8-14 hex characters)
- `name` - Cardholder name
- `enabled` - Whether the card is enabled
- `access_start` - Access permission start time (optional)
- `access_end` - Access permission end time (optional)
- `time_slots` - Allowed access time slots (JSON format)
- `allowed_devices` - Allowed device list (JSON array)
- `cacheable` - Whether ESP32 can cache this card
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### 2. devices (设备表)
Stores ESP32 device information and credentials.

**Columns:**
- `device_id` (PRIMARY KEY) - Unique device identifier
- `name` - Device name
- `location` - Device location description
- `mac_address` - ESP32 MAC address
- `api_key` - Device API key for authentication
- `secret_key` - Device secret key for request signing
- `enabled` - Whether the device is enabled
- `last_seen` - Last online timestamp
- `firmware_version` - Firmware version
- `created_at` - Registration timestamp
- `updated_at` - Last update timestamp

### 3. access_logs (访问日志表)
Stores all access attempts and results.

**Columns:**
- `id` (PRIMARY KEY) - Auto-increment ID
- `uid` - Card UID that was scanned
- `device_id` - Device that processed the scan
- `timestamp` - Scan timestamp
- `allowed` - Whether access was granted
- `reason` - Denial reason (if access was denied)
- `source` - Verification source (cloud/cache)
- `card_name` - Cardholder name (denormalized)
- `device_name` - Device name (denormalized)

### 4. admins (管理员表)
Stores administrator accounts for the web interface.

**Columns:**
- `id` (PRIMARY KEY) - Auto-increment ID
- `username` - Admin username
- `password_hash` - Bcrypt password hash
- `email` - Admin email address
- `created_at` - Account creation timestamp

## Indexes

The following indexes are created for query optimization:

- `idx_access_logs_timestamp` - Optimizes time-based log queries
- `idx_access_logs_uid` - Optimizes card-based log queries
- `idx_access_logs_device_id` - Optimizes device-based log queries
- `idx_cards_enabled` - Optimizes filtering enabled cards
- `idx_devices_enabled` - Optimizes filtering enabled devices

PostgreSQL additional indexes:
- `idx_access_logs_device_timestamp` - Composite index for device + time queries
- `idx_access_logs_uid_timestamp` - Composite index for card + time queries

## Default Data

### Default Admin Account
- **Username:** `admin`
- **Password:** `admin123`
- **Email:** `admin@example.com`

⚠️ **IMPORTANT:** Change the default admin password immediately after first login!

### Sample Data
The schema includes sample data for testing:
- Sample device: `door_1` (前门门禁)
- Sample card: `04A1B2C3D4E5F6` (张三)

## Usage

### Initialize SQLite Database

```bash
# Set environment variables
export DB_TYPE=sqlite
export DB_PATH=./data/access_control.db

# Run initialization script
npm run db:init
```

### Initialize PostgreSQL Database

```bash
# Set environment variables
export DB_TYPE=postgresql
export DATABASE_URL=postgresql://user:password@localhost:5432/access_control

# Run initialization script
npm run db:init
```

### Manual Initialization

#### SQLite
```bash
sqlite3 data/access_control.db < database/schema.sqlite.sql
```

#### PostgreSQL
```bash
psql -U access_user -d access_control -f database/schema.postgresql.sql
```

## PostgreSQL-Specific Features

### Automatic Timestamp Updates
PostgreSQL schema includes triggers that automatically update the `updated_at` field when records are modified:
- `update_cards_updated_at` - Updates cards.updated_at
- `update_devices_updated_at` - Updates devices.updated_at

### Views
PostgreSQL schema includes helpful views:
- `v_recent_access_logs` - Recent access logs with card and device names
- `v_device_status` - Device status with online/offline indicator

## Data Types

### SQLite vs PostgreSQL Differences

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| JSON Storage | TEXT | JSONB |
| Boolean | INTEGER (0/1) | BOOLEAN |
| Auto-increment | AUTOINCREMENT | SERIAL |
| Timestamp | DATETIME | TIMESTAMP |

## Security Considerations

1. **Password Hashing:** Admin passwords are hashed using bcrypt with cost factor 10
2. **API Keys:** Device API keys should be at least 32 characters long
3. **Secret Keys:** Device secret keys are used for HMAC-SHA256 request signing
4. **Foreign Keys:** Enabled in SQLite, enforced in PostgreSQL with CASCADE delete

## Maintenance

### Backup

#### SQLite
```bash
sqlite3 data/access_control.db ".backup backup.db"
```

#### PostgreSQL
```bash
pg_dump -U access_user access_control > backup.sql
```

### Log Cleanup
Access logs older than 3 months should be archived or deleted to maintain performance:

```sql
-- SQLite
DELETE FROM access_logs WHERE timestamp < datetime('now', '-3 months');

-- PostgreSQL
DELETE FROM access_logs WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '3 months';
```

## Troubleshooting

### SQLite Issues
- **Error: unable to open database file**
  - Check that the data directory exists and has write permissions
  - Verify the DB_PATH environment variable

### PostgreSQL Issues
- **Error: connection refused**
  - Ensure PostgreSQL server is running
  - Check connection string format
  - Verify firewall settings

- **Error: permission denied**
  - Grant necessary permissions to the database user:
    ```sql
    GRANT ALL PRIVILEGES ON DATABASE access_control TO access_user;
    ```

## References

- Requirements: See `requirements.md` sections 15.1-15.4
- Design: See `design.md` data model sections
- Tasks: See `tasks.md` task 2.1
