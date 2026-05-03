#!/usr/bin/env node

/**
 * Generate bcrypt hash for admin password
 * This utility helps generate the correct bcrypt hash for the default admin password
 */

const bcrypt = require('bcrypt');

const password = 'admin123';
const saltRounds = 10;

console.log('Generating bcrypt hash for password: admin123');
console.log('Salt rounds: 10');
console.log('');

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  
  console.log('Generated hash:');
  console.log(hash);
  console.log('');
  console.log('Use this hash in the SQL schema files for the default admin account.');
  console.log('');
  
  // Verify the hash works
  bcrypt.compare(password, hash, (err, result) => {
    if (err) {
      console.error('Error verifying hash:', err);
      process.exit(1);
    }
    
    if (result) {
      console.log('✓ Hash verification successful!');
    } else {
      console.log('✗ Hash verification failed!');
    }
  });
});
