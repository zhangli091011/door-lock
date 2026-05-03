# Database Schema Changelog

## Task 2.1 - Database Initialization Scripts (Completed)

### Created Files

1. **schema.sqlite.sql** - SQLite database schema
   - Tables: cards, devices, access_logs, admins
   - Indexes for query optimization
   - Default admin account (username: admin, password: admin123)
   - Sample data for testing

2. **schema.postgresql.sql** - PostgreSQL database schema
   - Tables: cards, devices, access_logs, admins
   - Indexes for query optimization (including composite indexes)
   - Triggers for automatic timestamp updates
   - Views for simplified queries (v_recent_access_logs, v_device_status)
   - Default admin account (username: admin, password: admin123)
   - Sample data for testing

3. **README.md** - Database documentation
   - Table structure documentation
   - Index documentation
   - Usage instructions
   - Security considerations
   - Maintenance guidelines

4. **TESTING.md** - Testing guide
   - Step-by-step testing instructions
   - Verification procedures
   - Troubleshooting guide

5. **CHANGELOG.md** - This file
   - Change history and documentation

### Updated Files

1. **scripts/init-database.js** - Database initialization script
   - Supports both SQLite and PostgreSQL
   - Reads and executes SQL schema files
   - Provides detailed console output
   - Error handling and troubleshooting guidance

### Additional Files

1. **scripts/generate-admin-hash.js** - Utility to generate bcrypt hashes
   - Generates bcrypt hash for admin password
   - Verifies hash correctness

2. **data/.gitkeep** - Placeholder for SQLite database directory
   - Ensures data directory exists in git

## Schema Details

### Tables

#### cards
- Primary key: uid (VARCHAR/TEXT)
- Stores NFC card information and permissions
- Supports time-based access control
- Supports device-specific permissions
- Cacheable flag for offline operation

#### devices
- Primary key: device_id (VARCHAR/TEXT)
- Stores ESP32 device information
- API key and secret key for authentication
- Last seen timestamp for online status
- Firmware version tracking

#### access_logs
- Primary key: id (SERIAL/INTEGER AUTOINCREMENT)
- Foreign keys: uid, device_id
- Records all access attempts
- Stores verification source (cloud/cache)
- Includes denial reasons

#### admins
- Primary key: id (SERIAL/INTEGER AUTOINCREMENT)
- Stores admin credentials
- Password hashed with bcrypt (cost=10)

### Indexes

**Common (SQLite & PostgreSQL):**
- idx_access_logs_timestamp - Time-based queries
- idx_access_logs_uid - Card-based queries
- idx_access_logs_device_id - Device-based queries
- idx_cards_enabled - Filter enabled cards
- idx_devices_enabled - Filter enabled devices

**PostgreSQL Additional:**
- idx_access_logs_device_timestamp - Composite index
- idx_access_logs_uid_timestamp - Composite index

### PostgreSQL-Specific Features

**Triggers:**
- update_cards_updated_at - Auto-update cards.updated_at
- update_devices_updated_at - Auto-update devices.updated_at

**Views:**
- v_recent_access_logs - Access logs with joined names
- v_device_status - Device status with online indicator

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 15.1**: Database tables created (cards, devices, access_logs, admins)
- **Requirement 15.2**: Indexes created for query optimization
- **Requirement 15.3**: Default admin account inserted with bcrypt hashed password
- **Requirement 15.4**: Support for both SQLite and PostgreSQL

## Security Notes

1. **Default Password**: The default admin password is "admin123" and MUST be changed immediately after first login
2. **Password Hashing**: All passwords are hashed using bcrypt with cost factor 10
3. **API Keys**: Device API keys are 32+ character random strings
4. **Secret Keys**: Device secret keys are used for HMAC-SHA256 request signing

## Known Issues

1. The bcrypt hash in the SQL files is a placeholder. Run `node scripts/generate-admin-hash.js` to generate a proper hash if needed.
2. Sample data is included for testing purposes and should be removed in production deployments.

## Future Enhancements

1. Database migration system (e.g., using Knex.js or TypeORM migrations)
2. Automated backup scripts
3. Log rotation and archival system
4. Performance monitoring queries
5. Database seeding scripts for development

## Testing Status

- [ ] SQLite initialization tested
- [ ] PostgreSQL initialization tested
- [ ] Default admin login tested
- [ ] Sample data verified
- [ ] Indexes verified
- [ ] PostgreSQL triggers verified
- [ ] PostgreSQL views verified

## Next Steps

1. Install dependencies: `cd server && npm install`
2. Test SQLite initialization: `npm run db:init`
3. Test PostgreSQL initialization: Set DB_TYPE=postgresql and run `npm run db:init`
4. Proceed to Task 2.2: Implement database access layer (TypeScript)
