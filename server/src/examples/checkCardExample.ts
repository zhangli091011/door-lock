/**
 * Check Card API Example
 * 演示如何调用权限验证API
 * 
 * This example shows how ESP32 devices should call the /api/check-card endpoint
 * with proper authentication and signature
 */

import axios from 'axios';
import { generateSignature } from '../utils/signatureUtils';

// Configuration (these should be stored in ESP32 config.h)
const API_BASE_URL = 'http://localhost:3000/api';
const DEVICE_ID = 'door_1';
const API_KEY = 'sk_live_example_api_key_32chars_long';
const SECRET_KEY = 'secret_example_key_32chars_long_too';

/**
 * Example: Check card access
 */
async function checkCardAccess(uid: string): Promise<void> {
  try {
    // Step 1: Prepare request payload
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      uid,
      device_id: DEVICE_ID,
      timestamp,
    };

    // Step 2: Generate HMAC-SHA256 signature
    const signature = generateSignature(payload, SECRET_KEY);

    // Step 3: Send HTTP POST request
    const response = await axios.post(
      `${API_BASE_URL}/check-card`,
      {
        uid,
        device_id: DEVICE_ID,
        timestamp,
        signature,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'X-Device-ID': DEVICE_ID,
        },
        timeout: 5000, // 5 second timeout
      }
    );

    // Step 4: Handle response
    if (response.status === 200 && response.data.success) {
      if (response.data.allow) {
        console.log('✅ Access ALLOWED');
        console.log(`   Card holder: ${response.data.card_name}`);
        console.log(`   Cacheable: ${response.data.cacheable}`);
        console.log('   Action: Open door for 3 seconds');
      } else {
        console.log('❌ Access DENIED');
        console.log(`   Reason: ${response.data.reason}`);
        console.log('   Action: Beep 3 times (failure)');
      }
    } else {
      console.error('❌ API Error:', response.data.error);
      console.log('   Action: Use local cache');
    }
  } catch (error: any) {
    if (error.response) {
      // Server responded with error status
      console.error('❌ Server Error:', error.response.status);
      console.error('   Message:', error.response.data.message);
      
      if (error.response.status === 401) {
        console.log('   Reason: Authentication failed (check API Key or signature)');
      } else if (error.response.status === 429) {
        console.log('   Reason: Rate limit exceeded');
        console.log('   Retry after:', error.response.headers['retry-after'], 'seconds');
      }
    } else if (error.request) {
      // Network error (no response received)
      console.error('❌ Network Error: No response from server');
      console.log('   Action: Use local cache');
    } else {
      // Other error
      console.error('❌ Error:', error.message);
    }
  }
}

/**
 * Example: Multiple card checks
 */
async function runExamples(): Promise<void> {
  console.log('=== ESP32 Check Card API Examples ===\n');

  // Example 1: Valid card
  console.log('Example 1: Valid enabled card');
  await checkCardAccess('04A1B2C3D4E5F6');
  console.log('');

  // Example 2: Invalid card (not in database)
  console.log('Example 2: Non-existent card');
  await checkCardAccess('04FFFFFFFFFF');
  console.log('');

  // Example 3: Invalid UID format
  console.log('Example 3: Invalid UID format');
  await checkCardAccess('INVALID');
  console.log('');
}

/**
 * Example: ESP32 C++ equivalent code
 * 
 * This is how the ESP32 firmware would implement the same logic:
 */
const ESP32_EXAMPLE = `
// ESP32 Arduino C++ Code Example

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "mbedtls/md.h"

// Configuration
const char* API_BASE_URL = "http://your-server.com/api";
const char* DEVICE_ID = "door_1";
const char* API_KEY = "sk_live_example_api_key_32chars_long";
const char* SECRET_KEY = "secret_example_key_32chars_long_too";

// Generate HMAC-SHA256 signature
String generateSignature(String uid, String deviceId, unsigned long timestamp) {
  // Create sign string: uid|device_id|timestamp
  String signString = uid + "|" + deviceId + "|" + String(timestamp);
  
  // Calculate HMAC-SHA256
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)SECRET_KEY, strlen(SECRET_KEY));
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

// Check card access with cloud API
bool checkCardAccess(String uid) {
  HTTPClient http;
  
  // Step 1: Prepare request
  unsigned long timestamp = time(NULL);
  String signature = generateSignature(uid, DEVICE_ID, timestamp);
  
  // Step 2: Build JSON payload
  StaticJsonDocument<256> doc;
  doc["uid"] = uid;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = timestamp;
  doc["signature"] = signature;
  
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  // Step 3: Send HTTP POST request
  String url = String(API_BASE_URL) + "/check-card";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.setTimeout(5000); // 5 second timeout
  
  int httpCode = http.POST(jsonPayload);
  
  // Step 4: Handle response
  if (httpCode == 200) {
    String response = http.getString();
    StaticJsonDocument<512> responseDoc;
    deserializeJson(responseDoc, response);
    
    bool allow = responseDoc["allow"];
    bool cacheable = responseDoc["cacheable"];
    const char* cardName = responseDoc["card_name"];
    const char* reason = responseDoc["reason"];
    
    if (allow) {
      Serial.println("Access ALLOWED");
      Serial.print("Card holder: ");
      Serial.println(cardName);
      
      // Update local cache if cacheable
      if (cacheable) {
        updateCache(uid, true, timestamp);
      }
      
      // Open door
      unlockDoor(3000); // 3 seconds
      beep(1, 500); // Long beep (success)
      
      http.end();
      return true;
    } else {
      Serial.println("Access DENIED");
      Serial.print("Reason: ");
      Serial.println(reason);
      
      beep(3, 200); // 3 short beeps (failure)
      
      http.end();
      return false;
    }
  } else {
    // Network error or server error
    Serial.print("HTTP Error: ");
    Serial.println(httpCode);
    
    // Fallback to local cache
    bool cachedResult = verifyWithCache(uid);
    if (cachedResult) {
      Serial.println("Using cached result: ALLOWED");
      unlockDoor(3000);
      beep(2, 200); // 2 short beeps (offline mode)
    } else {
      Serial.println("Using cached result: DENIED");
      beep(3, 200); // 3 short beeps (failure)
    }
    
    http.end();
    return cachedResult;
  }
}
`;

console.log('\n=== ESP32 C++ Implementation Example ===');
console.log(ESP32_EXAMPLE);

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export { checkCardAccess, runExamples };
