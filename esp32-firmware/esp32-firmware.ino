/**
 * ESP32 NFC Cloud Access Control System
 * 基于可用版本改进，添加云端验证功能
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_PN532.h>
#include <mbedtls/md.h>
#include <time.h>
#include "config.h"

// ===== NTP配置 =====
const char* NTP_SERVER = "ntp.aliyun.com";  // 使用阿里云NTP服务器
const long GMT_OFFSET_SEC = 0;  // 使用UTC时间（标准Unix时间戳）
const int DAYLIGHT_OFFSET_SEC = 0;

// ===== NFC =====
Adafruit_PN532 nfc(-1, -1);

// ===== WiFi状态 =====
bool wifiConnected = false;
bool timeSync = false;  // NTP时间同步状态
unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 30000; // 30秒检查一次

// ===== 心跳包 =====
unsigned long lastHeartbeat = 0;
// HEARTBEAT_INTERVAL 在 config.h 中定义
const String HEARTBEAT_UID = "FFFFFFFFFFFF";  // 心跳专用UID（全F，12位十六进制）

// ===== 本地缓存 =====
struct CachedCard {
  String uid;
  bool allowed;
  unsigned long timestamp;
  bool valid;
};

CachedCard cache[CACHE_SIZE];
int cacheCount = 0;

// ===== 统计信息 =====
String lastCard = "None";
String lastResult = "None";
unsigned long lastAccessTime = 0;

// ===== 获取当前Unix时间戳 =====
unsigned long getCurrentTimestamp() {
  if (!timeSync) {
    // 如果时间未同步，返回0（会导致签名验证失败，但不会崩溃）
    Serial.println("⚠️  Warning: Time not synced, using fallback");
    return 0;
  }
  
  time_t now;
  time(&now);
  return (unsigned long)now;
}

// ===== 同步NTP时间 =====
bool syncTime() {
  Serial.println("🕐 Syncing time with NTP server...");
  
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  
  // 等待时间同步（最多10秒）
  int attempts = 0;
  time_t now = 0;
  while (now < 1000000000 && attempts < 20) {  // 确保时间戳合理
    time(&now);
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  if (now < 1000000000) {
    Serial.println("❌ Time sync failed");
    timeSync = false;
    return false;
  }
  
  timeSync = true;
  
  // 显示当前时间
  struct tm timeinfo;
  localtime_r(&now, &timeinfo);
  char timeStr[64];
  strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
  Serial.println("✅ Time synced: " + String(timeStr));
  Serial.println("📅 Unix timestamp: " + String(now));
  
  return true;
}
String uidToString(uint8_t *uid, uint8_t uidLength) {
  String s = "";
  for (int i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) s += "0";
    s += String(uid[i], HEX);
  }
  s.toUpperCase();
  return s;
}

// ===== HMAC-SHA256签名 =====
String generateSignature(String data) {
  byte hmacResult[32];
  
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)SECRET_KEY, strlen(SECRET_KEY));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)data.c_str(), data.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  
  String signature = "";
  for (int i = 0; i < 32; i++) {
    if (hmacResult[i] < 0x10) signature += "0";
    signature += String(hmacResult[i], HEX);
  }
  signature.toLowerCase();
  
  return signature;
}

// ===== 查找缓存 =====
int findInCache(String uid) {
  unsigned long now = millis() / 1000;
  
  for (int i = 0; i < cacheCount; i++) {
    if (cache[i].valid && cache[i].uid == uid) {
      // 检查是否过期
      if (now - cache[i].timestamp < CACHE_EXPIRE) {
        return i;
      } else {
        // 过期，标记为无效
        cache[i].valid = false;
      }
    }
  }
  return -1;
}

// ===== 添加到缓存 =====
void addToCache(String uid, bool allowed) {
  unsigned long now = millis() / 1000;
  
  // 查找是否已存在
  int index = -1;
  for (int i = 0; i < cacheCount; i++) {
    if (cache[i].uid == uid) {
      index = i;
      break;
    }
  }
  
  // 如果不存在且缓存未满，添加新条目
  if (index == -1 && cacheCount < CACHE_SIZE) {
    index = cacheCount;
    cacheCount++;
  }
  
  // 如果缓存已满，替换最旧的条目
  if (index == -1) {
    unsigned long oldestTime = now;
    int oldestIndex = 0;
    for (int i = 0; i < CACHE_SIZE; i++) {
      if (cache[i].timestamp < oldestTime) {
        oldestTime = cache[i].timestamp;
        oldestIndex = i;
      }
    }
    index = oldestIndex;
  }
  
  // 更新缓存
  cache[index].uid = uid;
  cache[index].allowed = allowed;
  cache[index].timestamp = now;
  cache[index].valid = true;
}

// ===== 云端验证 =====
bool checkCardCloud(String uid) {
  if (!wifiConnected) {
    Serial.println("WiFi not connected, using cache only");
    return false;
  }
  
  if (!timeSync) {
    Serial.println("⚠️  Time not synced, attempting to sync...");
    if (!syncTime()) {
      Serial.println("❌ Cannot verify without time sync");
      return false;
    }
  }
  
  HTTPClient http;
  
  // 构建请求URL
  String url = String(API_BASE_URL) + "/access/check-card";
  
  // 获取真实的Unix时间戳
  unsigned long timestamp = getCurrentTimestamp();
  
  if (timestamp == 0) {
    Serial.println("❌ Invalid timestamp, cannot proceed");
    return false;
  }
  
  // 构建签名数据（注意：使用竖线分隔符）
  String signData = uid + "|" + String(DEVICE_ID) + "|" + String(timestamp);
  String signature = generateSignature(signData);
  
  // 构建JSON请求体
  StaticJsonDocument<256> doc;
  doc["uid"] = uid;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = timestamp;
  doc["signature"] = signature;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  Serial.println("Checking card with cloud: " + uid);
  Serial.println("Timestamp: " + String(timestamp));
  Serial.println("Request: " + requestBody);
  
  // 发送HTTP请求
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.setTimeout(API_TIMEOUT);
  
  int httpCode = http.POST(requestBody);
  
  bool allowed = false;
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("Response: " + response);
    
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error) {
      if (responseDoc["success"] == true) {
        // 注意：后端返回的是 "allow" 不是 "allowed"
        allowed = responseDoc["allow"];
        bool cacheable = responseDoc["cacheable"];
        
        // 只缓存可缓存的卡片
        if (cacheable) {
          addToCache(uid, allowed);
          Serial.println("💾 Card cached");
        }
        
        Serial.println(allowed ? "✅ Access ALLOWED (cloud)" : "❌ Access DENIED (cloud)");
        
        if (!allowed && responseDoc.containsKey("reason")) {
          Serial.println("   Reason: " + String(responseDoc["reason"].as<const char*>()));
        }
      } else {
        Serial.println("API returned error: " + String(responseDoc["message"].as<const char*>()));
      }
    } else {
      Serial.println("JSON parse error: " + String(error.c_str()));
    }
  } else {
    Serial.println("HTTP error: " + String(httpCode));
    if (httpCode > 0) {
      String response = http.getString();
      Serial.println("Error response: " + response);
    }
  }
  
  http.end();
  return allowed;
}

// ===== 验证卡片 =====
bool checkCard(String uid) {
  // 1. 先查缓存
  int cacheIndex = findInCache(uid);
  if (cacheIndex >= 0) {
    Serial.println("Found in cache: " + uid);
    bool allowed = cache[cacheIndex].allowed;
    Serial.println(allowed ? "✅ Access ALLOWED (cache)" : "❌ Access DENIED (cache)");
    return allowed;
  }
  
  // 2. 缓存未命中，查询云端
  if (wifiConnected) {
    return checkCardCloud(uid);
  }
  
  // 3. WiFi未连接，拒绝访问
  Serial.println("❌ Access DENIED (no cache, no WiFi)");
  return false;
}

// ===== 开门 =====
void unlockDoor() {
  Serial.println("🔓 Unlocking door...");
  
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
  
  delay(UNLOCK_DURATION);
  
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("🔒 Door locked");
}

// ===== 蜂鸣器：拒绝 =====
void beepDenied() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

// ===== 连接WiFi =====
void connectWiFi() {
  Serial.println("\n🌐 Connecting to WiFi: " + String(WIFI_SSID));
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\n✅ WiFi connected!");
    Serial.println("📍 IP address: " + WiFi.localIP().toString());
    Serial.println("📶 Signal strength: " + String(WiFi.RSSI()) + " dBm");
  } else {
    wifiConnected = false;
    Serial.println("\n❌ WiFi connection failed");
    Serial.println("⚠️  Running in offline mode (cache only)");
  }
}

// ===== 发送心跳包 =====
void sendHeartbeat() {
  if (!wifiConnected) {
    return;
  }
  
  // 检查是否到了发送心跳的时间
  if (millis() - lastHeartbeat < HEARTBEAT_INTERVAL) {
    return;
  }
  
  lastHeartbeat = millis();
  
  Serial.println("\n💓 Sending heartbeat...");
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/heartbeat";
  
  // 心跳端点只需要空的JSON body
  String requestBody = "{}";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.setTimeout(5000);
  
  int httpCode = http.POST(requestBody);
  
  if (httpCode == 200) {
    Serial.println("✅ Heartbeat sent successfully");
  } else {
    Serial.println("⚠️  Heartbeat failed (HTTP " + String(httpCode) + ")");
  }
  
  http.end();
}

// ===== 检查WiFi状态 =====
void checkWiFiStatus() {
  if (millis() - lastWiFiCheck > WIFI_CHECK_INTERVAL) {
    lastWiFiCheck = millis();
    
    if (WiFi.status() != WL_CONNECTED) {
      if (wifiConnected) {
        Serial.println("⚠️  WiFi disconnected, attempting reconnect...");
        wifiConnected = false;
        timeSync = false;  // WiFi断开时重置时间同步状态
      }
      connectWiFi();
      if (wifiConnected) {
        syncTime();  // 重新连接后同步时间
      }
    } else {
      if (!wifiConnected) {
        Serial.println("✅ WiFi reconnected!");
        wifiConnected = true;
        syncTime();  // 重新连接后同步时间
      }
      
      // 定期重新同步时间（每小时一次）
      static unsigned long lastTimeSync = 0;
      if (timeSync && (millis() - lastTimeSync > 3600000)) {  // 1小时
        Serial.println("🕐 Re-syncing time...");
        syncTime();
        lastTimeSync = millis();
      }
    }
  }
}

// ===== Setup =====
void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  delay(1000);
  
  Serial.println("\n\n========================================");
  Serial.println("ESP32 NFC Cloud Access Control System");
  Serial.println("========================================");
  
  // 初始化GPIO
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(EXIT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("✅ GPIO initialized");
  
  // 初始化I2C
  Wire.begin(PN532_SDA_PIN, PN532_SCL_PIN);
  Serial.println("✅ I2C initialized (SDA:" + String(PN532_SDA_PIN) + ", SCL:" + String(PN532_SCL_PIN) + ")");
  
  // 初始化NFC
  Serial.println("🔍 Initializing PN532...");
  nfc.begin();
  
  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    Serial.println("⚠️  PN532 not found, continuing without NFC");
  } else {
    Serial.print("✅ PN532 found! Firmware ver. ");
    Serial.print((versiondata >> 16) & 0xFF, DEC);
    Serial.print('.');
    Serial.println((versiondata >> 8) & 0xFF, DEC);
    
    nfc.SAMConfig();
  }
  
  // 连接WiFi
  connectWiFi();
  
  // 同步时间
  if (wifiConnected) {
    syncTime();
  }
  
  // 启动提示音
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("\n========================================");
  Serial.println("✅ System Ready!");
  Serial.println("📋 Device ID: " + String(DEVICE_ID));
  Serial.println("🌐 API URL: " + String(API_BASE_URL));
  Serial.println("💾 Cache size: " + String(CACHE_SIZE));
  Serial.println("🕐 Time synced: " + String(timeSync ? "Yes" : "No"));
  Serial.println("========================================\n");
}

// ===== Loop =====
void loop() {
  // 检查WiFi状态
  checkWiFiStatus();
  
  // 发送心跳包
  sendHeartbeat();
  
  // 检查出门按钮
  if (digitalRead(EXIT_BUTTON_PIN) == LOW) {
    Serial.println("🚪 Exit button pressed");
    unlockDoor();
    delay(500);
  }
  
  // 扫描NFC卡片
  uint8_t uid[7];
  uint8_t uidLength;
  
  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 50)) {
    String cardUID = uidToString(uid, uidLength);
    
    Serial.println("\n📇 Card detected: " + cardUID);
    lastCard = cardUID;
    lastAccessTime = millis();
    
    // 验证卡片
    bool allowed = checkCard(cardUID);
    
    if (allowed) {
      lastResult = "ALLOWED";
      unlockDoor();
    } else {
      lastResult = "DENIED";
      beepDenied();
    }
    
    // 防止重复读取
    delay(1000);
  }
  
  delay(100);
}
