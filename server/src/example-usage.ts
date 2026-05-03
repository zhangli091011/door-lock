/**
 * Example Usage of Data Access Layer
 * 数据访问层使用示例
 * 
 * This file demonstrates how to use the database connection and repositories
 */

import { createDatabaseFromEnv } from './db';
import {
  CardRepository,
  DeviceRepository,
  AccessLogRepository,
  AdminRepository,
} from './repositories';

/**
 * Example: Initialize database and repositories
 */
async function exampleInitialization() {
  // Option 1: Create database from environment variables
  const db = createDatabaseFromEnv();

  // Initialize repositories
  const cardRepo = new CardRepository(db);
  const deviceRepo = new DeviceRepository(db);
  const accessLogRepo = new AccessLogRepository(db);
  const adminRepo = new AdminRepository(db);

  return { db, cardRepo, deviceRepo, accessLogRepo, adminRepo };
}

/**
 * Example: Card operations
 */
async function exampleCardOperations() {
  const { db, cardRepo } = await exampleInitialization();

  try {
    // Create a new card
    const newCard = await cardRepo.create({
      uid: '04A1B2C3D4E5F6',
      name: '张三',
      enabled: true,
      cacheable: true,
      time_slots: JSON.stringify(['09:00-12:00', '14:00-18:00']),
      allowed_devices: JSON.stringify(['door_1']),
    });
    console.log('Created card:', newCard);

    // Find card by UID
    const card = await cardRepo.findByUid('04A1B2C3D4E5F6');
    console.log('Found card:', card);

    // Update card
    const updatedCard = await cardRepo.update('04A1B2C3D4E5F6', {
      enabled: false,
    });
    console.log('Updated card:', updatedCard);

    // Find all cards with filtering
    const paginatedCards = await cardRepo.findAll({
      enabled: true,
      search: '张',
      page: 1,
      limit: 20,
    });
    console.log('Paginated cards:', paginatedCards);

    // Delete card
    const deleted = await cardRepo.delete('04A1B2C3D4E5F6');
    console.log('Card deleted:', deleted);
  } finally {
    await db.close();
  }
}

/**
 * Example: Device operations
 */
async function exampleDeviceOperations() {
  const { db, deviceRepo } = await exampleInitialization();

  try {
    // Create a new device
    const newDevice = await deviceRepo.create({
      device_id: 'door_1',
      name: '前门门禁',
      location: '一楼大厅',
      mac_address: 'A4:CF:12:34:56:78',
      api_key: 'sk_live_example_api_key_32chars',
      secret_key: 'secret_example_key_32chars',
      enabled: true,
      firmware_version: '1.0.0',
    });
    console.log('Created device:', newDevice);

    // Find device by ID
    const device = await deviceRepo.findById('door_1');
    console.log('Found device:', device);

    // Find device by API key
    const deviceByApiKey = await deviceRepo.findByApiKey('sk_live_example_api_key_32chars');
    console.log('Found device by API key:', deviceByApiKey);

    // Update device last_seen
    await deviceRepo.updateLastSeen('door_1');
    console.log('Updated device last_seen');

    // Find all devices with status
    const devicesWithStatus = await deviceRepo.findAllWithStatus();
    console.log('Devices with status:', devicesWithStatus);

    // Count online devices
    const onlineCount = await deviceRepo.countOnline();
    console.log('Online devices:', onlineCount);
  } finally {
    await db.close();
  }
}

/**
 * Example: AccessLog operations
 */
async function exampleAccessLogOperations() {
  const { db, accessLogRepo } = await exampleInitialization();

  try {
    // Create a new access log
    const newLog = await accessLogRepo.create({
      uid: '04A1B2C3D4E5F6',
      device_id: 'door_1',
      allowed: true,
      source: 'cloud',
      card_name: '张三',
      device_name: '前门门禁',
    });
    console.log('Created access log:', newLog);

    // Find recent logs
    const recentLogs = await accessLogRepo.findRecent(10);
    console.log('Recent logs:', recentLogs);

    // Find logs with filtering
    const paginatedLogs = await accessLogRepo.findAll({
      device_id: 'door_1',
      allowed: true,
      page: 1,
      limit: 50,
    });
    console.log('Paginated logs:', paginatedLogs);

    // Get today's statistics
    const stats = await accessLogRepo.getTodayStatistics();
    console.log('Today statistics:', stats);

    // Count by device
    const deviceCount = await accessLogRepo.countByDevice('door_1');
    console.log('Access count for door_1:', deviceCount);
  } finally {
    await db.close();
  }
}

/**
 * Example: Admin operations
 */
async function exampleAdminOperations() {
  const { db, adminRepo } = await exampleInitialization();

  try {
    // Find admin by username
    const admin = await adminRepo.findByUsername('admin');
    console.log('Found admin:', admin);

    // Convert to safe admin (without password hash)
    if (admin) {
      const safeAdmin = adminRepo.toSafeAdmin(admin);
      console.log('Safe admin:', safeAdmin);
    }

    // Find all admins
    const allAdmins = await adminRepo.findAll();
    console.log('All admins:', allAdmins);

    // Check if admin exists
    const exists = await adminRepo.exists('admin');
    console.log('Admin exists:', exists);
  } finally {
    await db.close();
  }
}

/**
 * Example: Transaction usage
 */
async function exampleTransaction() {
  const { db, cardRepo, accessLogRepo } = await exampleInitialization();

  try {
    // Begin transaction
    await db.beginTransaction();

    try {
      // Create a card
      await cardRepo.create({
        uid: '04B1C2D3E4F5A6',
        name: '李四',
        enabled: true,
        cacheable: true,
      });

      // Create an access log
      await accessLogRepo.create({
        uid: '04B1C2D3E4F5A6',
        device_id: 'door_1',
        allowed: true,
        source: 'cloud',
        card_name: '李四',
        device_name: '前门门禁',
      });

      // Commit transaction
      await db.commit();
      console.log('Transaction committed successfully');
    } catch (error) {
      // Rollback on error
      await db.rollback();
      console.error('Transaction rolled back:', error);
      throw error;
    }
  } finally {
    await db.close();
  }
}

// Export examples for testing
export {
  exampleInitialization,
  exampleCardOperations,
  exampleDeviceOperations,
  exampleAccessLogOperations,
  exampleAdminOperations,
  exampleTransaction,
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running data access layer examples...\n');

  // Uncomment to run specific examples:
  // exampleCardOperations().catch(console.error);
  // exampleDeviceOperations().catch(console.error);
  // exampleAccessLogOperations().catch(console.error);
  // exampleAdminOperations().catch(console.error);
  // exampleTransaction().catch(console.error);
}
