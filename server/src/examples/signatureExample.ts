/**
 * Signature Verification Example
 * 
 * This file demonstrates how to use signature verification in API endpoints
 */

import express, { Response } from 'express';
import { Database, DatabaseType } from '../db';
import { createDeviceAuthMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { generateSignature } from '../utils/signatureUtils';

// Example: Setting up an Express app with signature verification
export function setupExampleApp() {
  const app = express();
  
  // Parse JSON request bodies
  app.use(express.json());
  
  // Initialize database
  const db = new Database({
    type: DatabaseType.SQLITE,
    sqlitePath: './data/access_control.db',
  });
  
  // Create authentication middleware with signature verification enabled
  const deviceAuth = createDeviceAuthMiddleware(db, true);
  
  // Example endpoint: Check card access with signature verification
  app.post('/api/check-card', deviceAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.body;
      
      // At this point, the middleware has already verified:
      // 1. API Key is valid
      // 2. Device exists and is enabled
      // 3. Signature is valid
      // 4. Timestamp is within 5-minute window
      
      // Access device information from req.device
      console.log(`Authenticated request from device: ${req.device?.device_id}`);
      console.log(`Card UID: ${uid}`);
      
      // Your business logic here (check card permissions, etc.)
      // ...
      
      res.json({
        success: true,
        allow: true,
        message: 'Access granted',
      });
    } catch (error) {
      console.error('Error processing request:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });
  
  // Example endpoint without signature verification (for testing)
  const deviceAuthNoSig = createDeviceAuthMiddleware(db, false);
  
  app.post('/api/test', deviceAuthNoSig, async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      message: 'Test endpoint (no signature required)',
      device: req.device?.device_id,
    });
  });
  
  return app;
}

// Example: Client-side signature generation (for ESP32 implementation reference)
export function exampleClientRequest() {
  const deviceId = 'door_1';
  const secretKey = 'your_device_secret_key_here';
  const uid = '04A1B2C3D4E5F6';
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Generate signature
  const signature = generateSignature(
    { uid, device_id: deviceId, timestamp },
    secretKey
  );
  
  // Prepare request
  const requestBody = {
    uid,
    device_id: deviceId,
    timestamp,
    signature,
  };
  
  const requestHeaders = {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_device_api_key_here',
    'X-Device-ID': deviceId,
  };
  
  console.log('Request Headers:', requestHeaders);
  console.log('Request Body:', requestBody);
  
  // In actual implementation, send HTTP POST request:
  // fetch('https://your-server.com/api/check-card', {
  //   method: 'POST',
  //   headers: requestHeaders,
  //   body: JSON.stringify(requestBody),
  // });
  
  return { headers: requestHeaders, body: requestBody };
}

// Example: Testing signature verification
export async function testSignatureVerification() {
  console.log('=== Signature Verification Example ===\n');
  
  // 1. Generate a valid signature
  const payload = {
    uid: '04A1B2C3D4E5F6',
    device_id: 'door_1',
    timestamp: Math.floor(Date.now() / 1000),
  };
  
  const secretKey = 'test_secret_key_12345678901234567890';
  const signature = generateSignature(payload, secretKey);
  
  console.log('Payload:', payload);
  console.log('Secret Key:', secretKey);
  console.log('Generated Signature:', signature);
  console.log();
  
  // 2. Simulate a request
  const request = {
    headers: {
      'x-api-key': 'test_api_key',
      'x-device-id': 'door_1',
    },
    body: {
      ...payload,
      signature,
    },
  };
  
  console.log('Request Headers:', request.headers);
  console.log('Request Body:', request.body);
  console.log();
  
  // 3. Show what happens with tampered data
  console.log('=== Tampering Detection ===\n');
  
  const tamperedPayload = { ...payload, uid: 'TAMPERED_UID' };
  console.log('Tampered Payload:', tamperedPayload);
  console.log('Original Signature:', signature);
  console.log('Result: Signature verification will FAIL because UID was changed');
  console.log();
  
  // 4. Show timestamp expiration
  console.log('=== Timestamp Expiration ===\n');
  
  const oldPayload = {
    ...payload,
    timestamp: Math.floor(Date.now() / 1000) - 400, // 6+ minutes ago
  };
  const oldSignature = generateSignature(oldPayload, secretKey);
  
  console.log('Old Payload (6+ minutes ago):', oldPayload);
  console.log('Old Signature:', oldSignature);
  console.log('Result: Request will be REJECTED due to expired timestamp');
  console.log();
  
  console.log('=== Summary ===');
  console.log('✓ Valid signature + fresh timestamp = Request accepted');
  console.log('✗ Valid signature + old timestamp = Request rejected (replay attack prevention)');
  console.log('✗ Invalid signature + fresh timestamp = Request rejected (tampering detected)');
  console.log('✗ Missing signature = Request rejected (signature required)');
}

// Run example if executed directly
if (require.main === module) {
  testSignatureVerification();
}
