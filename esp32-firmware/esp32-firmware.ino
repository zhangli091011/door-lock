/**
 * ESP32 NFC 云门禁系统 - 主程序
 * 
 * 功能：
 * - NFC卡片读取（PN532模块，I2C接口）
 * - WiFi连接和管理
 * - 云端权限验证（HTTP/HTTPS API）
 * - 本地缓存机制（离线验证）
 * - 继电器控制磁力锁
 * - 出门按钮处理
 * - 蜂鸣器反馈
 * 
 * 硬件：
 * - ESP32-S3开发板
 * - PN532 NFC模块（I2C: GPIO8/9）
 * - 继电器模块（GPIO4）
 * - 磁力锁（12V，NC端子）
 * - 蜂鸣器（GPIO5）
 * - 出门按钮（GPIO6）
 * 
 * 作者：ESP32 NFC Access Control System
 * 版本：1.0.0
 */

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_PN532.h>
#include "config.h"

// ==================== 全局对象 ====================
// PN532 NFC模块（I2C接口）
Adafruit_PN532 nfc(PN532_SDA_PIN, PN532_SCL_PIN);

// HTTP客户端
HTTPClient http;

// ==================== 全局变量 ====================
// WiFi连接状态
bool wifiConnected = false;
unsigned long lastWiFiCheckTime = 0;

// NFC读取状态
bool nfcInitialized = false;
unsigned long lastNFCReadTime = 0;

// 出门按钮状态
int lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;

// 门锁状态
bool doorUnlocked = false;
unsigned long unlockStartTime = 0;

// 缓存结构
struct CacheEntry {
  String uid;
  bool allowed;
  unsigned long timestamp;
};

// 本地缓存数组
CacheEntry localCache[CACHE_SIZE];
int cacheCount = 0;

// ==================== 函数声明 ====================
void setupWiFi();
void setupNFC();
void setupHardware();
void checkWiFiConnection();
bool checkNFCCard(String& uid);
bool verifyWithCloud(String uid, bool& cacheable);
bool verifyWithCache(String uid);
void updateCache(String uid, bool allowed);
void unlockDoor();
void lockDoor();
void handleExitButton();
void beep(int times, int duration, int interval);
String generateSignature(String uid, String deviceId, unsigned long timestamp);
String uidToString(uint8_t* uid, uint8_t uidLength);

// ==================== 初始化函数 ====================
void setup() {
  // 初始化串口
  Serial.begin(SERIAL_BAUD_RATE);
  delay(1000);
  
  #ifdef DEBUG_ENABLED
  Serial.println("\n\n=================================");
  Serial.println("ESP32 NFC 云门禁系统");
  Serial.println("版本: 1.0.0");
  Serial.println("=================================\n");
  #endif
  
  // 初始化硬件
  setupHardware();
  
  // 初始化WiFi
  setupWiFi();
  
  // 初始化NFC模块
  setupNFC();
  
  #ifdef DEBUG_ENABLED
  Serial.println("\n系统初始化完成！");
  Serial.println("等待刷卡...\n");
  #endif
  
  // 启动提示音
  beep(2, BEEP_SHORT_DURATION, BEEP_INTERVAL);
}

// ==================== 主循环 ====================
void loop() {
  // 检查WiFi连接
  checkWiFiConnection();
  
  // 处理出门按钮
  handleExitButton();
  
  // 检查门锁状态（自动重新锁门）
  if (doorUnlocked && (millis() - unlockStartTime >= UNLOCK_DURATION)) {
    lockDoor();
  }
  
  // NFC卡片检测（限制读取频率）
  if (millis() - lastNFCReadTime >= NFC_READ_INTERVAL) {
    lastNFCReadTime = millis();
    
    String uid;
    if (checkNFCCard(uid)) {
      #ifdef DEBUG_ENABLED
      Serial.println("检测到卡片: " + uid);
      #endif
      
      // 读卡提示音
      beep(1, BEEP_SHORT_DURATION, 0);
      
      // 验证权限
      bool allowed = false;
      bool cacheable = false;
      
      if (wifiConnected) {
        // 云端验证
        allowed = verifyWithCloud(uid, cacheable);
        
        // 更新缓存
        if (cacheable) {
          updateCache(uid, allowed);
        }
      } else {
        // 离线缓存验证
        #ifdef DEBUG_ENABLED
        Serial.println("网络离线，使用本地缓存验证");
        #endif
        allowed = verifyWithCache(uid);
        
        // 离线模式提示音（短鸣2次）
        beep(2, BEEP_SHORT_DURATION, BEEP_INTERVAL);
      }
      
      // 根据验证结果控制门锁
      if (allowed) {
        #ifdef DEBUG_ENABLED
        Serial.println("权限验证通过，开门");
        #endif
        unlockDoor();
        beep(1, BEEP_LONG_DURATION, 0);  // 成功提示音（长鸣1次）
      } else {
        #ifdef DEBUG_ENABLED
        Serial.println("权限验证失败，拒绝访问");
        #endif
        beep(3, BEEP_SHORT_DURATION, BEEP_INTERVAL);  // 失败提示音（短鸣3次）
      }
      
      // 防止重复读取同一张卡
      delay(2000);
    }
  }
  
  // 短暂延迟
  delay(10);
}

// ==================== 硬件初始化 ====================
void setupHardware() {
  #ifdef DEBUG_ENABLED
  Serial.println("初始化硬件...");
  #endif
  
  // 配置继电器引脚
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_LOCK);  // 初始状态：锁定
  
  // 配置蜂鸣器引脚
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  // 配置出门按钮引脚（内部上拉）
  pinMode(EXIT_BUTTON_PIN, INPUT_PULLUP);
  
  #ifdef DEBUG_ENABLED
  Serial.println("硬件初始化完成");
  #endif
}

// ==================== WiFi初始化 ====================
void setupWiFi() {
  #ifdef DEBUG_ENABLED
  Serial.println("连接WiFi...");
  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);
  #endif
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < WIFI_CONNECT_TIMEOUT) {
    delay(500);
    #ifdef DEBUG_ENABLED
    Serial.print(".");
    #endif
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    #ifdef DEBUG_ENABLED
    Serial.println("\nWiFi连接成功！");
    Serial.print("IP地址: ");
    Serial.println(WiFi.localIP());
    Serial.print("信号强度: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    #endif
  } else {
    wifiConnected = false;
    #ifdef DEBUG_ENABLED
    Serial.println("\nWiFi连接失败，将使用离线模式");
    #endif
  }
}

// ==================== NFC初始化 ====================
void setupNFC() {
  #ifdef DEBUG_ENABLED
  Serial.println("初始化PN532 NFC模块...");
  #endif
  
  nfc.begin();
  
  int retryCount = 0;
  while (retryCount < NFC_INIT_RETRY) {
    uint32_t versiondata = nfc.getFirmwareVersion();
    if (versiondata) {
      nfcInitialized = true;
      #ifdef DEBUG_ENABLED
      Serial.print("找到PN532芯片，固件版本: ");
      Serial.print((versiondata >> 24) & 0xFF, HEX);
      Serial.print(".");
      Serial.println((versiondata >> 16) & 0xFF, HEX);
      #endif
      
      // 配置PN532读取ISO14443A卡片
      nfc.SAMConfig();
      
      #ifdef DEBUG_ENABLED
      Serial.println("PN532初始化完成");
      #endif
      return;
    }
    
    retryCount++;
    #ifdef DEBUG_ENABLED
    Serial.print("PN532初始化失败，重试 ");
    Serial.print(retryCount);
    Serial.print("/");
    Serial.println(NFC_INIT_RETRY);
    #endif
    delay(1000);
  }
  
  // 初始化失败
  nfcInitialized = false;
  #ifdef DEBUG_ENABLED
  Serial.println("错误：PN532初始化失败！");
  Serial.println("请检查：");
  Serial.println("1. I2C接线是否正确（SDA=GPIO8, SCL=GPIO9）");
  Serial.println("2. PN532供电是否正常");
  Serial.println("3. PN532是否设置为I2C模式");
  #endif
  
  // 故障提示音（持续鸣叫）
  while (true) {
    beep(3, BEEP_LONG_DURATION, BEEP_INTERVAL);
    delay(2000);
  }
}

// ==================== WiFi连接检查 ====================
void checkWiFiConnection() {
  // 每10秒检查一次WiFi状态
  if (millis() - lastWiFiCheckTime >= WIFI_RECONNECT_INTERVAL) {
    lastWiFiCheckTime = millis();
    
    if (WiFi.status() != WL_CONNECTED) {
      if (wifiConnected) {
        #ifdef DEBUG_ENABLED
        Serial.println("WiFi连接断开，尝试重连...");
        #endif
        wifiConnected = false;
      }
      
      WiFi.reconnect();
      delay(1000);
      
      if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        #ifdef DEBUG_ENABLED
        Serial.println("WiFi重连成功！");
        Serial.print("IP地址: ");
        Serial.println(WiFi.localIP());
        #endif
      }
    } else {
      if (!wifiConnected) {
        wifiConnected = true;
        #ifdef DEBUG_ENABLED
        Serial.println("WiFi连接已恢复");
        #endif
      }
    }
  }
}

// ==================== NFC卡片检测 ====================
bool checkNFCCard(String& uid) {
  if (!nfcInitialized) {
    return false;
  }
  
  uint8_t uidBytes[7];
  uint8_t uidLength;
  
  // 检测卡片（非阻塞模式，超时100ms）
  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uidBytes, &uidLength, 100);
  
  if (success) {
    uid = uidToString(uidBytes, uidLength);
    return true;
  }
  
  return false;
}

// ==================== UID转字符串 ====================
String uidToString(uint8_t* uid, uint8_t uidLength) {
  String uidStr = "";
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) {
      uidStr += "0";
    }
    uidStr += String(uid[i], HEX);
  }
  uidStr.toUpperCase();
  return uidStr;
}

// ==================== 云端权限验证 ====================
bool verifyWithCloud(String uid, bool& cacheable) {
  #ifdef DEBUG_ENABLED
  Serial.println("向云端请求权限验证...");
  #endif
  
  // 生成时间戳
  unsigned long timestamp = millis() / 1000;  // 简化版时间戳（实际应使用NTP）
  
  // 生成签名
  String signature = generateSignature(uid, DEVICE_ID, timestamp);
  
  // 构建JSON请求体
  StaticJsonDocument<256> requestDoc;
  requestDoc["uid"] = uid;
  requestDoc["device_id"] = DEVICE_ID;
  requestDoc["timestamp"] = timestamp;
  requestDoc["signature"] = signature;
  
  String requestBody;
  serializeJson(requestDoc, requestBody);
  
  // 发送HTTP请求
  String url = String(API_BASE_URL) + "/check-card";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.setTimeout(API_TIMEOUT);
  
  int httpCode = http.POST(requestBody);
  
  #ifdef DEBUG_ENABLED
  Serial.print("HTTP状态码: ");
  Serial.println(httpCode);
  #endif
  
  if (httpCode == 200) {
    String response = http.getString();
    
    #ifdef DEBUG_ENABLED
    Serial.print("响应: ");
    Serial.println(response);
    #endif
    
    // 解析JSON响应
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error) {
      bool success = responseDoc["success"] | false;
      bool allow = responseDoc["allow"] | false;
      cacheable = responseDoc["cacheable"] | false;
      
      http.end();
      return success && allow;
    } else {
      #ifdef DEBUG_ENABLED
      Serial.println("JSON解析失败");
      #endif
    }
  } else {
    #ifdef DEBUG_ENABLED
    Serial.print("HTTP请求失败，错误码: ");
    Serial.println(httpCode);
    #endif
  }
  
  http.end();
  
  // 请求失败，使用缓存
  return verifyWithCache(uid);
}

// ==================== 本地缓存验证 ====================
bool verifyWithCache(String uid) {
  unsigned long currentTime = millis() / 1000;
  
  for (int i = 0; i < cacheCount; i++) {
    if (localCache[i].uid == uid) {
      // 检查缓存是否过期
      if (currentTime - localCache[i].timestamp < CACHE_EXPIRE) {
        #ifdef DEBUG_ENABLED
        Serial.println("缓存命中: " + uid);
        Serial.print("允许访问: ");
        Serial.println(localCache[i].allowed ? "是" : "否");
        #endif
        return localCache[i].allowed;
      } else {
        #ifdef DEBUG_ENABLED
        Serial.println("缓存已过期: " + uid);
        #endif
      }
    }
  }
  
  #ifdef DEBUG_ENABLED
  Serial.println("缓存未命中: " + uid);
  #endif
  return false;
}

// ==================== 更新本地缓存 ====================
void updateCache(String uid, bool allowed) {
  unsigned long currentTime = millis() / 1000;
  
  // 查找是否已存在
  for (int i = 0; i < cacheCount; i++) {
    if (localCache[i].uid == uid) {
      localCache[i].allowed = allowed;
      localCache[i].timestamp = currentTime;
      #ifdef DEBUG_ENABLED
      Serial.println("更新缓存: " + uid);
      #endif
      return;
    }
  }
  
  // 添加新条目
  if (cacheCount < CACHE_SIZE) {
    localCache[cacheCount].uid = uid;
    localCache[cacheCount].allowed = allowed;
    localCache[cacheCount].timestamp = currentTime;
    cacheCount++;
    #ifdef DEBUG_ENABLED
    Serial.println("添加缓存: " + uid);
    #endif
  } else {
    // 缓存已满，删除最旧的条目（FIFO）
    for (int i = 0; i < CACHE_SIZE - 1; i++) {
      localCache[i] = localCache[i + 1];
    }
    localCache[CACHE_SIZE - 1].uid = uid;
    localCache[CACHE_SIZE - 1].allowed = allowed;
    localCache[CACHE_SIZE - 1].timestamp = currentTime;
    #ifdef DEBUG_ENABLED
    Serial.println("缓存已满，替换最旧条目: " + uid);
    #endif
  }
}

// ==================== 开门 ====================
void unlockDoor() {
  digitalWrite(RELAY_PIN, RELAY_UNLOCK);
  doorUnlocked = true;
  unlockStartTime = millis();
  
  #ifdef DEBUG_ENABLED
  Serial.println("门锁已打开");
  #endif
}

// ==================== 锁门 ====================
void lockDoor() {
  digitalWrite(RELAY_PIN, RELAY_LOCK);
  doorUnlocked = false;
  
  #ifdef DEBUG_ENABLED
  Serial.println("门锁已关闭");
  #endif
}

// ==================== 出门按钮处理 ====================
void handleExitButton() {
  int reading = digitalRead(EXIT_BUTTON_PIN);
  
  // 防抖处理
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }
  
  if ((millis() - lastDebounceTime) > BUTTON_DEBOUNCE_DELAY) {
    if (reading == LOW && lastButtonState == HIGH) {
      // 按钮按下
      #ifdef DEBUG_ENABLED
      Serial.println("出门按钮按下");
      #endif
      
      unlockDoor();
      beep(1, BEEP_SHORT_DURATION, 0);  // 按钮确认提示音
    }
  }
  
  lastButtonState = reading;
}

// ==================== 蜂鸣器控制 ====================
void beep(int times, int duration, int interval) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duration);
    digitalWrite(BUZZER_PIN, LOW);
    
    if (i < times - 1) {
      delay(interval);
    }
  }
}

// ==================== 生成HMAC-SHA256签名 ====================
String generateSignature(String uid, String deviceId, unsigned long timestamp) {
  // 构建待签名字符串
  String signString = uid + "|" + deviceId + "|" + String(timestamp);
  
  // 注意：这里需要实现HMAC-SHA256算法
  // ESP32可以使用mbedtls库或第三方库
  // 简化版本：返回占位符（实际部署时需要实现真实签名）
  
  // TODO: 实现真实的HMAC-SHA256签名
  // 可以使用: https://github.com/h2zero/ESP32-BLE-Keyboard/blob/master/examples/SendKeyStrokes/SendKeyStrokes.ino
  
  #ifdef DEBUG_ENABLED
  Serial.println("警告：使用简化版签名（生产环境需实现HMAC-SHA256）");
  #endif
  
  return "simplified_signature_placeholder";
}
