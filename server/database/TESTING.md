# Database Initialization Testing Guide

This guide helps you test the database initialization scripts.

## Prerequisites

1. Install Node.js dependencies:
```bash
cd server
npm install
```

## Test SQLite Initialization

### Step 1: Run the initialization script
```bash
cd server
npm run db:init
```

This will:
- Create the `data/` directory if it doesn't exist
- Create `data/access_control.db` SQLite database
- Execute the schema from `database/schema.sqlite.sql`
- Create all tables, indexes, and insert default data

### Step 2: Verify the database
```bash
# Install sqlite3 command-line tool if not already installed
# On Ubuntu/Debian: sudo apt install sqlite3
# On macOS: brew install sqlite3
# On Windows: Download from https://www.sqlite.org/download.html

# Open the database
sqlite3 data/access_control.db

# List all tables
.tables

# Check cards table
SELECT * FROM cards;

# Check devices table
SELECT * FROM devices;

# Check admins table
SELECT * FROM admins;

# Check indexes
.indexes

# Exit sqlite3
.quit
```

### Expected Output

**Tables:**
- cards
- devices
- access_logs
- admins

**Default Admin:**
- Username: admin
- Password: admin123 (hashed with bcrypt)
- Email: admin@example.com

**Sample Device:**
- device_id: door_1
- name: 前门门禁
- location: 一楼大厅

**Sample Card:**
- uid: 04A1B2C3D4E5F6
- name: 张三
- enabled: 1 (true)

## Test PostgreSQL Initialization

### Step 1: Start PostgreSQL (if using Docker)
```bash
docker run --name postgres-test \
  -e POSTGRES_USER=access_user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=access_control \
  -p 5432:5432 \
  -d postgres:15-alpine
```

### Step 2: Set environment variables
```bash
export DB_TYPE=postgresql
export DATABASE_URL=postgresql://access_user:password@localhost:5432/access_control
```

### Step 3: Run the initialization script
```bash
cd server
npm run db:init
```

### Step 4: Verify the database
```bash
# Connect to PostgreSQL
psql -U access_user -d access_control

# List all tables
\dt

# Check cards table
SELECT * FROM cards;

# Check devices table
SELECT * FROM devices;

# Check admins table
SELECT * FROM admins;

# Check indexes
\di

# Check triggers
\dS+ cards
\dS+ devices

# Check views
\dv

# Query the views
SELECT * FROM v_device_status;
SELECT * FROM v_recent_access_logs LIMIT 10;

# Exit psql
\q
```

## Troubleshooting

### SQLite Issues

**Error: SQLITE_CANTOPEN**
```bash
# Solution: Create the data directory manually
mkdir -p server/data
chmod 755 server/data
```

**Error: table already exists**
```bash
# Solution: Delete the existing database and reinitialize
rm server/data/access_control.db
npm run db:init
```

### PostgreSQL Issues

**Error: connection refused**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check connection string
echo $DATABASE_URL
```

**Error: database does not exist**
```bash
# Create the database manually
psql -U postgres -c "CREATE DATABASE access_control;"
psql -U postgres -c "CREATE USER access_user WITH PASSWORD 'password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE access_control TO access_user;"
```

**Error: permission denied**
```bash
# Grant permissions
psql -U postgres -d access_control -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO access_user;"
psql -U postgres -d access_control -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO access_user;"
```

## Verify Password Hash

To verify the default admin password hash is correct:

```bash
cd server
node scripts/generate-admin-hash.js
```

This will generate a new bcrypt hash for "admin123" and verify it works.

## Clean Up

### SQLite
```bash
rm server/data/access_control.db
```

### PostgreSQL
```bash
# Drop the database
psql -U postgres -c "DROP DATABASE access_control;"

# Stop and remove Docker container
docker stop postgres-test
docker rm postgres-test
```

## Integration with Server

After successful database initialization, you can start the server:

```bash
cd server
npm run dev
```

The server will connect to the database and you can test the API endpoints.

## Next Steps

After verifying the database initialization:
1. Proceed to Task 2.2: Implement database access layer (TypeScript)
2. Create repository classes for CRUD operations
3. Write unit tests for database operations
