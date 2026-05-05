# ESP32固件升级指南

## 📋 概述

本指南说明如何从简化版本升级到云端版本的ESP32固件。

## 🔄 版本对比

### 简化版本（本地AP模式）
- ✅ 本地WiFi AP模式
- ✅ Web界面管理
- ✅ 本地卡片存储
- ❌ 无云端验证
- ❌ 无远程管理

### 云端版本（推荐）
- ✅ 连接到现有WiFi
- ✅ 云端权限验证
- ✅ 本地缓存（离线可用）
- ✅ 远程管理
- ✅ 访问日志记录
- ✅ 多设备统一管理

## 🚀 升级步骤

### 步骤1: 在云端注册设备

1. **登录Web管理界面**
   ```
   http://localhost:8080
   用户名: admin
   密码: admin123
   ```

2. **进入设备管理**
   - 点击左侧"设备管理"

3. **注册新设备**
   - 点击"注册设备"按钮
   - 填写信息：
     - 设备ID: `door-001`（或其他唯一ID）
     - 设备名称: `前门门禁`
     - 位置: `一楼大厅`
     - MAC地址: （可选）

4. **保存凭证**
   - 复制生成的**API Key**
   - 复制生成的**Secret Key**
   - ⚠️ Secret Key只显示一次，务必保存！

### 步骤2: 配置固件

1. **编辑config.h文件**
   ```
   打开: esp32-firmware/config.h
   ```

2. **配置WiFi**
   ```cpp
   #define WIFI_SSID "你的WiFi名称"
   #define WIFI_PASSWORD "你的WiFi密码"
   ```

3. **配置API**
   ```cpp
   // 服务器地址（根据实际情况修改）
   #define API_BASE_URL "http://192.168.31.195:3000/api"
   
   // 从Web界面复制的凭证
   #define DEVICE_ID "door-001"
   #define API_KEY "从Web界面复制的API_KEY"
   #define SECRET_KEY "从Web界面复制的SECRET_KEY"
   ```

4. **检查硬件配置**
   ```cpp
   // 确认引脚配置正确
   #define PN532_SDA_PIN 8
   #define PN532_SCL_PIN 9
   #define RELAY_PIN 4
   #define BUZZER_PIN 5
   #define EXIT_BUTTON_PIN 6
   ```

### 步骤3: 上传固件

1. **打开Arduino IDE**

2. **打开固件文件**
   ```
   文件 > 打开
   选择: esp32-firmware/esp32-firmware.ino
   ```

3. **选择开发板**
   ```
   工具 > 开发板 > ESP32 Arduino > Adafruit Metro ESP32-S3
   ```

4. **选择端口**
   ```
   工具 > 端口 > COM5（或你的端口）
   ```

5. **上传**
   ```
   点击"上传"按钮
   等待上传完成
   ```

### 步骤4: 验证运行

1. **打开串口监视器**
   ```
   工具 > 串口监视器
   波特率: 115200
   ```

2. **查看启动日志**
   ```
   ========================================
   ESP32 NFC Cloud Access Control System
   ========================================
   ✅ GPIO initialized
   ✅ I2C initialized (SDA:8, SCL:9)
   🔍 Initializing PN532...
   ✅ PN532 found! Firmware ver. 1.6
   
   🌐 Connecting to WiFi: YourWiFi
   ....
   ✅ WiFi connected!
   📍 IP address: 192.168.31.100
   📶 Signal strength: -45 dBm
   
   ========================================
   ✅ System Ready!
   📋 Device ID: door-001
   🌐 API URL: http://192.168.31.195:3000/api
   💾 Cache size: 50
   ========================================
   ```

3. **测试NFC读卡**
   ```
   靠近NFC卡片，应该看到：
   
   📇 Card detected: 04A1B2C3D4E5F6
   Checking card with cloud: 04A1B2C3D4E5F6
   Request: {"uid":"04A1B2C3D4E5F6",...}
   Response: {"success":true,...}
   ✅ Access ALLOWED (cloud)
   🔓 Unlocking door...
   🔒 Door locked
   ```

4. **检查Web界面**
   - 进入"设备管理"页面
   - 设备状态应显示"在线"
   - 进入"访问日志"页面
   - 应该能看到刚才的访问记录

## 🔧 功能说明

### 云端验证流程

```
1. 读取NFC卡片
   ↓
2. 检查本地缓存
   ├─ 命中 → 使用缓存结果
   └─ 未命中 ↓
3. 发送到云端验证
   ├─ 成功 → 保存到缓存
   └─ 失败 ↓
4. 拒绝访问
```

### 离线模式

当WiFi断开时：
- ✅ 使用本地缓存验证
- ✅ 缓存有效期24小时
- ✅ 最多缓存50张卡片
- ⚠️ 新卡片无法验证

### 自动重连

- 每30秒检查WiFi状态
- 断开后自动尝试重连
- 重连成功后恢复云端验证

## 📊 串口输出说明

### 正常输出

```
📇 Card detected: 04A1B2C3D4E5F6
Found in cache: 04A1B2C3D4E5F6
✅ Access ALLOWED (cache)
🔓 Unlocking door...
🔒 Door locked
```

### 云端验证

```
📇 Card detected: 04A1B2C3D4E5F6
Checking card with cloud: 04A1B2C3D4E5F6
Request: {"uid":"04A1B2C3D4E5F6","device_id":"door-001",...}
Response: {"success":true,"data":{"allowed":true}}
✅ Access ALLOWED (cloud)
🔓 Unlocking door...
🔒 Door locked
```

### 拒绝访问

```
📇 Card detected: 04A1B2C3D4E5F6
Checking card with cloud: 04A1B2C3D4E5F6
Response: {"success":true,"data":{"allowed":false}}
❌ Access DENIED (cloud)
```

### WiFi断开

```
⚠️  WiFi disconnected, attempting reconnect...
🌐 Connecting to WiFi: YourWiFi
....
✅ WiFi reconnected!
```

## 🐛 故障排查

### 问题1: WiFi无法连接

**症状**:
```
🌐 Connecting to WiFi: YourWiFi
....................
❌ WiFi connection failed
⚠️  Running in offline mode (cache only)
```

**解决**:
1. 检查WiFi名称和密码
2. 确认WiFi信号强度
3. 检查路由器设置

### 问题2: PN532未检测到

**症状**:
```
🔍 Initializing PN532...
⚠️  PN532 not found, continuing without NFC
```

**解决**:
1. 检查I2C接线
2. 检查PN532模式开关（SW1=OFF, SW2=ON）
3. 检查5V供电
4. 运行I2C扫描程序诊断

### 问题3: API连接失败

**症状**:
```
Checking card with cloud: 04A1B2C3D4E5F6
HTTP error: -1
```

**解决**:
1. 检查API_BASE_URL配置
2. 确认服务器正在运行
3. 测试: `curl http://192.168.31.195:3000/api/status`
4. 检查防火墙设置

### 问题4: 签名验证失败

**症状**:
```
Response: {"success":false,"error":"Invalid signature"}
```

**解决**:
1. 检查SECRET_KEY是否正确
2. 确认设备时间同步
3. 重新注册设备获取新凭证

## 📈 性能优化

### 缓存策略

- 首次验证后自动缓存
- 缓存有效期24小时
- 最多缓存50张卡片
- LRU替换策略

### 网络优化

- HTTP超时5秒
- 自动重连机制
- 离线模式支持

### 响应速度

- 缓存命中: <100ms
- 云端验证: 200-500ms
- 开门延迟: 3秒

## 🔐 安全建议

1. **保护Secret Key**
   - 不要提交到Git
   - 不要在日志中输出
   - 定期更换

2. **使用HTTPS**
   - 生产环境使用HTTPS
   - 配置SSL证书

3. **网络隔离**
   - 使用独立VLAN
   - 限制访问端口

4. **定期更新**
   - 更新固件
   - 更新服务器
   - 更新凭证

## 📚 相关文档

- [设备注册指南](DEVICE_REGISTRATION.md)
- [PN532故障排查](PN532_TROUBLESHOOTING.md)
- [API文档](../README.md#api文档)
- [快速开始](../QUICK_START.md)

---

**最后更新**: 2026-05-03
