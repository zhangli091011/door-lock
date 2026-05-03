/**
 * Access Control Service Usage Example
 * 
 * Demonstrates how to use the AccessControlService for card verification
 */

import { Database, DatabaseType } from '../db';
import { CardRepository } from '../repositories/CardRepository';
import { AccessControlService } from '../services/accessControlService';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Initialize database and repositories
  const db = new Database({
    type: DatabaseType.SQLITE,
    sqlitePath: ':memory:', // Use in-memory database for example
  });

  // Initialize schema
  const schemaPath = path.join(__dirname, '../../database/schema.sqlite.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await db.execute(schema);

  const cardRepository = new CardRepository(db);
  const accessControlService = new AccessControlService(cardRepository);

  // Example 1: Add a test card
  console.log('=== Example 1: Adding a test card ===');
  const testCard = await cardRepository.create({
    uid: '04A1B2C3D4E5F6',
    name: '张三',
    enabled: true,
    time_slots: '["09:00-18:00"]',
    allowed_devices: '["door_1", "door_2"]',
    cacheable: true,
  });
  console.log('Created card:', testCard);

  // Example 2: Verify access - should succeed
  console.log('\n=== Example 2: Valid access (within time slot, allowed device) ===');
  const validTime = new Date();
  validTime.setHours(14, 30, 0, 0); // 2:30 PM

  const result1 = await accessControlService.verifyAccess({
    uid: '04A1B2C3D4E5F6',
    device_id: 'door_1',
    timestamp: validTime,
  });
  console.log('Verification result:', result1);

  // Example 3: Verify access - should fail (outside time slot)
  console.log('\n=== Example 3: Invalid access (outside time slot) ===');
  const invalidTime = new Date();
  invalidTime.setHours(20, 0, 0, 0); // 8:00 PM

  const result2 = await accessControlService.verifyAccess({
    uid: '04A1B2C3D4E5F6',
    device_id: 'door_1',
    timestamp: invalidTime,
  });
  console.log('Verification result:', result2);

  // Example 4: Verify access - should fail (wrong device)
  console.log('\n=== Example 4: Invalid access (wrong device) ===');
  const result3 = await accessControlService.verifyAccess({
    uid: '04A1B2C3D4E5F6',
    device_id: 'door_3',
    timestamp: validTime,
  });
  console.log('Verification result:', result3);

  // Example 5: Disable card and verify
  console.log('\n=== Example 5: Disabled card ===');
  await cardRepository.update('04A1B2C3D4E5F6', { enabled: false });

  const result4 = await accessControlService.verifyAccess({
    uid: '04A1B2C3D4E5F6',
    device_id: 'door_1',
    timestamp: validTime,
  });
  console.log('Verification result:', result4);

  // Example 6: Non-existent card
  console.log('\n=== Example 6: Non-existent card ===');
  const result5 = await accessControlService.verifyAccess({
    uid: 'NONEXISTENT',
    device_id: 'door_1',
  });
  console.log('Verification result:', result5);

  // Close database
  await db.close();
}

// Run example if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
