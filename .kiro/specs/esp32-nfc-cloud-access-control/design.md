# 设计文档：ESP32 NFC 云门禁系统

## 概述

本系统是一个基于ESP32-S3和PN532 NFC模块的云端权限管理门禁系统。系统采用三层架构：ESP32硬件客户端、云端后端服务、Web管理前端。核心工作流程为：用户刷NFC卡 → ESP32读取UID → 通过WiFi请求云端API验证权限 → 云端返回允许/拒绝结果 → ESP32控制继电器开门并记录日志。系统支持离线缓存机制，在网络故障时使用本地缓存的卡片信息进行验证，确保门禁系统的可靠性。

系统设计目标：
- **可靠性**：离线缓存机制保证网络故障时仍可使用
- **可扩展性**：支持多设备、多门禁点管理
- **安全性**：API认证、请求签名防止伪造
- **易用性**：Web管理界面简化卡片和设备管理

## 系统架构

```mermaid
graph TB
    subgraph "硬件层 - ESP32客户端"
        A[PN532 NFC模块<br/>I2C: GPIO8/9]
        B[ESP32-S3<br/>Arduino框架]
        C[继电器<br/>GPIO4]
        D[磁力锁<br/>12V NC端子]
        E[出门按钮<br/>GPIO6]
        F[蜂鸣器<br/>GPIO5]
        
        A -->|读取UID| B
        E -->|按钮信号| B
        B -->|控制信号| C
        B -->|提示音| F
        C -->|NC常闭| D
    end
    
    subgraph "网络层"
        G[WiFi路由器]
        B -->|WiFi STA| G
    end
    
    subgraph "云端层 - 后端服务"
        H[API网关<br/>认证中间件]
        I[权限验证服务]
        J[设备管理服务]
        K[日志记录服务]
        L[数据库<br/>SQLite/PostgreSQL]
        
        G -->|HTTPS/HTTP| H
        H --> I
        H --> J
        H --> K
        I --> L
        J --> L
        K --> L
    end
    
    subgraph "应用层 - Web管理前端"
        M[管理后台<br/>HTML+JS/Vue]
        M -->|REST API| H
    end
    
    style B fill:#90EE90
    style H fill:#87CEEB
    style M fill:#FFB6C1
```

## 主要工作流程

```mermaid
sequenceDiagram
    participant NFC as NFC卡片
    participant PN532 as PN532模块
    participant ESP32 as ESP32-S3
    participant Cache as 本地缓存
    participant Cloud as 云端API
    participant DB as 数据库
    participant Lock as 磁力锁
    participant Buzzer as 蜂鸣器
    
    NFC->>PN532: 靠近感应区
    PN532->>ESP32: 读取UID (I2C)
    ESP32->>Buzzer: 短鸣提示
    
    alt 网络正常
        ESP32->>Cloud: POST /api/check-card<br/>{uid, device_id, timestamp, signature}
        Cloud->>Cloud: 验证API Key/Token
        Cloud->>Cloud: 验证请求签名
        Cloud->>DB: 查询卡片权限
        DB-->>Cloud: 返回权限信息
        Cloud->>DB: 记录访问日志
        Cloud-->>ESP32: {allow: true/false, cache: true/false}
        
        alt 允许缓存
            ESP32->>Cache: 更新本地缓存
        end
    else 网络故障
        ESP32->>Cache: 查询本地缓存
        Cache-->>ESP32: 返回缓存结果
    end
    
    alt 权限通过
        ESP32->>Lock: GPIO4 LOW (继电器断开)
        Lock->>Lock: NC端子断开，磁力锁断电
        ESP32->>Buzzer: 长鸣1次（成功）
        Note over Lock: 门锁打开3秒
        ESP32->>Lock: GPIO4 HIGH (继电器闭合)
        Lock->>Lock: NC端子闭合，磁力锁通电
    else 权限拒绝
        ESP32->>Buzzer: 短鸣3次（失败）
    end
```


## 组件和接口

### 组件 1: ESP32 客户端控制器

**目的**: 硬件层核心控制器，负责NFC读取、网络通信、门锁控制和本地缓存管理

**接口**:
```cpp
class AccessController {
  // 初始化硬件和网络
  void initialize();
  
  // 主循环处理
  void loop();
  
  // NFC卡片检测和处理
  bool checkNFCCard(String& uid);
  
  // 云端权限验证
  bool verifyWithCloud(String uid, AuthResponse& response);
  
  // 本地缓存验证
  bool verifyWithCache(String uid);
  
  // 更新本地缓存
  void updateCache(String uid, bool allowed, long timestamp);
  
  // 控制门锁
  void unlockDoor(int duration);
  
  // 蜂鸣器提示
  void beep(int times, int duration);
  
  // 处理出门按钮
  void handleExitButton();
};
```

**职责**:
- 初始化PN532 NFC模块（I2C通信）
- 连接WiFi网络（STA模式）
- 检测NFC卡片并读取UID
- 通过HTTP/HTTPS与云端API通信
- 管理本地缓存（最近N张卡片）
- 控制继电器和磁力锁
- 处理出门按钮事件
- 提供蜂鸣器反馈

**硬件配置**:
```cpp
// GPIO引脚定义
#define PN532_SDA_PIN 8
#define PN532_SCL_PIN 9
#define RELAY_PIN 4
#define BUZZER_PIN 5
#define EXIT_BUTTON_PIN 6

// 继电器逻辑（NC常闭端子）
#define RELAY_LOCK HIGH    // 继电器闭合，NC端子通，磁力锁通电（锁定）
#define RELAY_UNLOCK LOW   // 继电器断开，NC端子断，磁力锁断电（开锁）

// 缓存配置
#define CACHE_SIZE 50      // 缓存最近50张卡
#define CACHE_EXPIRE 86400 // 缓存有效期24小时
```

### 组件 2: 云端API服务

**目的**: 提供权限验证、设备管理、日志记录的RESTful API服务

**接口**:
```pascal
INTERFACE CloudAPIService
  // 权限验证接口
  METHOD checkCardAccess(request: CheckCardRequest): CheckCardResponse
  
  // 卡片管理接口
  METHOD addCard(card: CardInfo): Result
  METHOD updateCard(uid: String, card: CardInfo): Result
  METHOD deleteCard(uid: String): Result
  METHOD listCards(filter: CardFilter): CardList
  
  // 设备管理接口
  METHOD registerDevice(device: DeviceInfo): Result
  METHOD updateDevice(deviceId: String, device: DeviceInfo): Result
  METHOD listDevices(): DeviceList
  
  // 日志查询接口
  METHOD getAccessLogs(filter: LogFilter): LogList
  METHOD getRealtimeStatus(): StatusInfo
END INTERFACE
```

**职责**:
- 接收并验证ESP32设备的权限查询请求
- 验证API Key/Token认证
- 验证请求签名防止伪造
- 查询数据库判断卡片权限
- 记录所有访问日志
- 提供Web管理界面的后端API
- 管理多个门禁设备
- 支持时间段权限控制

### 组件 3: 数据库服务

**目的**: 持久化存储卡片信息、设备信息和访问日志

**接口**:
```pascal
INTERFACE DatabaseService
  // 卡片数据访问
  METHOD findCardByUID(uid: String): Card
  METHOD insertCard(card: Card): Boolean
  METHOD updateCard(uid: String, card: Card): Boolean
  METHOD deleteCard(uid: String): Boolean
  
  // 设备数据访问
  METHOD findDeviceById(deviceId: String): Device
  METHOD insertDevice(device: Device): Boolean
  METHOD updateDevice(deviceId: String, device: Device): Boolean
  
  // 日志数据访问
  METHOD insertAccessLog(log: AccessLog): Boolean
  METHOD queryAccessLogs(filter: LogFilter): AccessLogList
END INTERFACE
```

**职责**:
- 存储和查询卡片权限信息
- 存储设备注册信息
- 记录所有访问日志
- 支持SQLite（本地部署）或PostgreSQL（云部署）
- 提供数据库初始化脚本

### 组件 4: Web管理前端

**目的**: 提供可视化的卡片和设备管理界面

**接口**:
```pascal
INTERFACE WebAdminUI
  // 卡片管理页面
  METHOD renderCardManagement(): HTMLPage
  METHOD handleAddCard(cardData: FormData): void
  METHOD handleDeleteCard(uid: String): void
  METHOD handleToggleCard(uid: String): void
  
  // 设备管理页面
  METHOD renderDeviceManagement(): HTMLPage
  METHOD handleAddDevice(deviceData: FormData): void
  
  // 日志查看页面
  METHOD renderAccessLogs(filter: LogFilter): HTMLPage
  METHOD renderRealtimeStatus(): HTMLPage
END INTERFACE
```

**职责**:
- 提供卡片CRUD操作界面
- 显示实时刷卡状态
- 查看和筛选访问日志
- 管理设备信息
- 启用/禁用卡片权限
- 响应式设计支持移动端访问


## 数据模型

### 模型 1: Card（卡片信息）

```pascal
STRUCTURE Card
  uid: String              // NFC卡片UID（主键，8-14位十六进制）
  name: String             // 卡片持有人姓名
  enabled: Boolean         // 是否启用（true=启用，false=禁用）
  access_start: Time       // 权限开始时间（可选，NULL表示无限制）
  access_end: Time         // 权限结束时间（可选，NULL表示无限制）
  time_slots: String       // 允许访问的时间段（JSON格式，如"09:00-18:00"）
  allowed_devices: String  // 允许访问的设备列表（JSON数组，空表示全部）
  cacheable: Boolean       // 是否允许ESP32缓存（true=允许离线验证）
  created_at: Timestamp    // 创建时间
  updated_at: Timestamp    // 最后更新时间
END STRUCTURE
```

**验证规则**:
- `uid` 必须唯一，长度8-14字符，仅包含十六进制字符（0-9, A-F）
- `name` 不能为空，最大长度100字符
- `enabled` 默认为true
- `access_start` 和 `access_end` 必须符合逻辑（开始时间 < 结束时间）
- `time_slots` 必须是有效的JSON格式
- `cacheable` 默认为true

**示例数据**:
```json
{
  "uid": "04A1B2C3D4E5F6",
  "name": "张三",
  "enabled": true,
  "access_start": "2024-01-01T00:00:00Z",
  "access_end": "2024-12-31T23:59:59Z",
  "time_slots": "[\"09:00-12:00\", \"14:00-18:00\"]",
  "allowed_devices": "[\"door_1\", \"door_2\"]",
  "cacheable": true,
  "created_at": "2024-01-01T10:00:00Z",
  "updated_at": "2024-01-01T10:00:00Z"
}
```

### 模型 2: Device（设备信息）

```pascal
STRUCTURE Device
  device_id: String        // 设备唯一标识（主键，如"door_1"）
  name: String             // 设备名称（如"前门"）
  location: String         // 设备位置描述
  mac_address: String      // ESP32 MAC地址（用于设备识别）
  api_key: String          // 设备专用API Key（用于认证）
  enabled: Boolean         // 是否启用
  last_seen: Timestamp     // 最后在线时间
  firmware_version: String // 固件版本号
  created_at: Timestamp    // 注册时间
  updated_at: Timestamp    // 最后更新时间
END STRUCTURE
```

**验证规则**:
- `device_id` 必须唯一，仅包含字母、数字、下划线、连字符
- `name` 不能为空
- `mac_address` 必须符合MAC地址格式（XX:XX:XX:XX:XX:XX）
- `api_key` 必须是强随机字符串（至少32字符）
- `enabled` 默认为true

**示例数据**:
```json
{
  "device_id": "door_1",
  "name": "前门门禁",
  "location": "一楼大厅",
  "mac_address": "A4:CF:12:34:56:78",
  "api_key": "EXAMPLE_API_KEY_32_CHARS_LONG_PLACEHOLDER",
  "enabled": true,
  "last_seen": "2024-01-15T14:30:00Z",
  "firmware_version": "1.0.0",
  "created_at": "2024-01-01T10:00:00Z",
  "updated_at": "2024-01-15T14:30:00Z"
}
```

### 模型 3: AccessLog（访问日志）

```pascal
STRUCTURE AccessLog
  id: Integer              // 自增主键
  uid: String              // 刷卡UID
  device_id: String        // 设备ID
  timestamp: Timestamp     // 刷卡时间
  allowed: Boolean         // 是否允许通过（true=通过，false=拒绝）
  reason: String           // 拒绝原因（如"卡片已禁用"、"不在时间段内"）
  source: String           // 验证来源（"cloud"=云端验证，"cache"=本地缓存）
  card_name: String        // 卡片持有人姓名（冗余字段，便于查询）
  device_name: String      // 设备名称（冗余字段，便于查询）
END STRUCTURE
```

**验证规则**:
- `id` 自动生成
- `uid` 和 `device_id` 不能为空
- `timestamp` 默认为当前时间
- `source` 必须是 "cloud" 或 "cache"
- `reason` 在 `allowed=false` 时必须提供

**示例数据**:
```json
{
  "id": 1001,
  "uid": "04A1B2C3D4E5F6",
  "device_id": "door_1",
  "timestamp": "2024-01-15T14:30:25Z",
  "allowed": true,
  "reason": null,
  "source": "cloud",
  "card_name": "张三",
  "device_name": "前门门禁"
}
```


## API规范

### API 1: 权限验证接口

**端点**: `POST /api/check-card`

**用途**: ESP32设备请求验证NFC卡片权限

**请求头**:
```
Content-Type: application/json
X-API-Key: {device_api_key}
X-Device-ID: {device_id}
```

**请求体**:
```json
{
  "uid": "04A1B2C3D4E5F6",
  "device_id": "door_1",
  "timestamp": 1705329025,
  "signature": "a1b2c3d4e5f6..."
}
```

**请求字段说明**:
- `uid`: NFC卡片UID（必填，8-14位十六进制字符串）
- `device_id`: 设备ID（必填）
- `timestamp`: Unix时间戳（必填，用于防重放攻击）
- `signature`: 请求签名（必填，HMAC-SHA256签名）

**响应体（成功）**:
```json
{
  "success": true,
  "allow": true,
  "cacheable": true,
  "card_name": "张三",
  "message": "访问允许"
}
```

**响应体（拒绝）**:
```json
{
  "success": true,
  "allow": false,
  "cacheable": false,
  "reason": "卡片已禁用",
  "message": "访问拒绝"
}
```

**响应体（错误）**:
```json
{
  "success": false,
  "error": "Invalid API key",
  "message": "认证失败"
}
```

**状态码**:
- `200 OK`: 请求成功（无论权限通过或拒绝）
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: API Key无效或签名验证失败
- `429 Too Many Requests`: 请求频率超限
- `500 Internal Server Error`: 服务器内部错误

### API 2: 添加卡片

**端点**: `POST /api/cards`

**用途**: Web管理界面添加新卡片

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {admin_token}
```

**请求体**:
```json
{
  "uid": "04A1B2C3D4E5F6",
  "name": "张三",
  "enabled": true,
  "access_start": "2024-01-01T00:00:00Z",
  "access_end": "2024-12-31T23:59:59Z",
  "time_slots": ["09:00-12:00", "14:00-18:00"],
  "allowed_devices": ["door_1", "door_2"],
  "cacheable": true
}
```

**响应体（成功）**:
```json
{
  "success": true,
  "message": "卡片添加成功",
  "data": {
    "uid": "04A1B2C3D4E5F6",
    "name": "张三",
    "created_at": "2024-01-15T14:30:00Z"
  }
}
```

**状态码**:
- `201 Created`: 卡片创建成功
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未授权
- `409 Conflict`: UID已存在

### API 3: 更新卡片

**端点**: `PUT /api/cards/{uid}`

**用途**: 更新卡片信息或启用/禁用卡片

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {admin_token}
```

**请求体**:
```json
{
  "name": "张三",
  "enabled": false,
  "access_start": "2024-01-01T00:00:00Z",
  "access_end": "2024-12-31T23:59:59Z",
  "time_slots": ["09:00-18:00"],
  "allowed_devices": ["door_1"],
  "cacheable": false
}
```

**响应体（成功）**:
```json
{
  "success": true,
  "message": "卡片更新成功"
}
```

**状态码**:
- `200 OK`: 更新成功
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未授权
- `404 Not Found`: 卡片不存在

### API 4: 删除卡片

**端点**: `DELETE /api/cards/{uid}`

**用途**: 删除卡片

**请求头**:
```
Authorization: Bearer {admin_token}
```

**响应体（成功）**:
```json
{
  "success": true,
  "message": "卡片删除成功"
}
```

**状态码**:
- `200 OK`: 删除成功
- `401 Unauthorized`: 未授权
- `404 Not Found`: 卡片不存在

### API 5: 查询卡片列表

**端点**: `GET /api/cards`

**用途**: 获取卡片列表（支持分页和筛选）

**请求头**:
```
Authorization: Bearer {admin_token}
```

**查询参数**:
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）
- `enabled`: 筛选启用状态（true/false）
- `search`: 搜索关键词（匹配UID或姓名）

**响应体（成功）**:
```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "uid": "04A1B2C3D4E5F6",
        "name": "张三",
        "enabled": true,
        "created_at": "2024-01-01T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

### API 6: 查询访问日志

**端点**: `GET /api/logs`

**用途**: 获取访问日志（支持分页和筛选）

**请求头**:
```
Authorization: Bearer {admin_token}
```

**查询参数**:
- `page`: 页码（默认1）
- `limit`: 每页数量（默认50）
- `device_id`: 筛选设备
- `uid`: 筛选卡片UID
- `allowed`: 筛选通过状态（true/false）
- `start_time`: 开始时间（ISO 8601格式）
- `end_time`: 结束时间（ISO 8601格式）

**响应体（成功）**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1001,
        "uid": "04A1B2C3D4E5F6",
        "card_name": "张三",
        "device_id": "door_1",
        "device_name": "前门门禁",
        "timestamp": "2024-01-15T14:30:25Z",
        "allowed": true,
        "source": "cloud"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 500,
      "pages": 10
    }
  }
}
```

### API 7: 注册设备

**端点**: `POST /api/devices`

**用途**: 注册新的ESP32设备

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {admin_token}
```

**请求体**:
```json
{
  "device_id": "door_2",
  "name": "后门门禁",
  "location": "一楼后门",
  "mac_address": "A4:CF:12:34:56:79"
}
```

**响应体（成功）**:
```json
{
  "success": true,
  "message": "设备注册成功",
  "data": {
    "device_id": "door_2",
    "api_key": "EXAMPLE_API_KEY_32_CHARS_LONG_PLACEHOLDER",
    "created_at": "2024-01-15T14:30:00Z"
  }
}
```

**状态码**:
- `201 Created`: 设备创建成功
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未授权
- `409 Conflict`: 设备ID已存在

### API 8: 获取实时状态

**端点**: `GET /api/status`

**用途**: 获取系统实时状态（最近刷卡记录、设备在线状态）

**请求头**:
```
Authorization: Bearer {admin_token}
```

**响应体（成功）**:
```json
{
  "success": true,
  "data": {
    "recent_access": [
      {
        "uid": "04A1B2C3D4E5F6",
        "card_name": "张三",
        "device_name": "前门门禁",
        "timestamp": "2024-01-15T14:30:25Z",
        "allowed": true
      }
    ],
    "devices_status": [
      {
        "device_id": "door_1",
        "name": "前门门禁",
        "online": true,
        "last_seen": "2024-01-15T14:30:00Z"
      }
    ],
    "statistics": {
      "total_cards": 50,
      "active_cards": 45,
      "total_devices": 2,
      "online_devices": 2,
      "today_access": 120,
      "today_denied": 5
    }
  }
}
```


## 通信协议

### 协议 1: ESP32 与云端通信

**传输协议**: HTTP/HTTPS over WiFi

**数据格式**: JSON

**通信流程**:
```pascal
PROCEDURE ESP32CloudCommunication
  INPUT: uid (卡片UID), device_id (设备ID)
  OUTPUT: allowed (是否允许通过)
  
  SEQUENCE
    // 步骤1: 准备请求数据
    timestamp ← getCurrentUnixTimestamp()
    payload ← createJSON(uid, device_id, timestamp)
    
    // 步骤2: 生成签名
    signature ← HMAC_SHA256(payload, device_secret_key)
    payload.signature ← signature
    
    // 步骤3: 发送HTTP请求
    request ← createHTTPRequest("POST", "/api/check-card")
    request.headers["Content-Type"] ← "application/json"
    request.headers["X-API-Key"] ← device_api_key
    request.headers["X-Device-ID"] ← device_id
    request.body ← payload
    
    // 步骤4: 发送请求并处理响应
    TRY
      response ← sendHTTPRequest(request, timeout=5000ms)
      
      IF response.status = 200 THEN
        data ← parseJSON(response.body)
        
        IF data.success = true THEN
          allowed ← data.allow
          
          // 步骤5: 更新本地缓存
          IF data.cacheable = true THEN
            updateLocalCache(uid, allowed, timestamp)
          END IF
          
          RETURN allowed
        ELSE
          logError("API返回错误: " + data.error)
          RETURN verifyWithCache(uid)
        END IF
      ELSE
        logError("HTTP状态码错误: " + response.status)
        RETURN verifyWithCache(uid)
      END IF
      
    CATCH NetworkError
      logError("网络连接失败")
      RETURN verifyWithCache(uid)
    END TRY
  END SEQUENCE
END PROCEDURE
```

**超时设置**:
- 连接超时: 3秒
- 读取超时: 5秒
- 总超时: 8秒

**重试机制**:
- 失败后不重试，直接使用本地缓存
- 避免用户等待时间过长

### 协议 2: Web前端与云端通信

**传输协议**: HTTPS

**数据格式**: JSON

**认证方式**: Bearer Token (JWT)

**通信流程**:
```pascal
PROCEDURE WebAdminCommunication
  INPUT: action (操作类型), data (请求数据)
  OUTPUT: result (操作结果)
  
  SEQUENCE
    // 步骤1: 检查认证状态
    token ← getStoredToken()
    
    IF token = NULL OR isTokenExpired(token) THEN
      redirectToLogin()
      RETURN
    END IF
    
    // 步骤2: 准备请求
    request ← createHTTPRequest(action.method, action.endpoint)
    request.headers["Authorization"] ← "Bearer " + token
    request.headers["Content-Type"] ← "application/json"
    request.body ← toJSON(data)
    
    // 步骤3: 发送请求
    TRY
      response ← sendHTTPRequest(request)
      
      IF response.status = 401 THEN
        // Token过期，重新登录
        clearStoredToken()
        redirectToLogin()
        RETURN
      END IF
      
      IF response.status >= 200 AND response.status < 300 THEN
        result ← parseJSON(response.body)
        RETURN result
      ELSE
        showError("请求失败: " + response.status)
        RETURN NULL
      END IF
      
    CATCH NetworkError
      showError("网络连接失败")
      RETURN NULL
    END TRY
  END SEQUENCE
END PROCEDURE
```

## 安全机制

### 机制 1: API认证

**设备认证（ESP32）**:
- 每个设备拥有唯一的API Key
- API Key在设备注册时生成（32字符随机字符串）
- 请求时通过 `X-API-Key` 头部传递
- 服务器验证API Key与设备ID的对应关系

**管理员认证（Web）**:
- 使用JWT (JSON Web Token)
- Token有效期: 24小时
- Token包含用户ID、角色、过期时间
- 请求时通过 `Authorization: Bearer {token}` 头部传递

**认证流程**:
```pascal
PROCEDURE AuthenticateRequest
  INPUT: request (HTTP请求)
  OUTPUT: authenticated (是否认证成功), device_id (设备ID)
  
  SEQUENCE
    // 检查API Key
    api_key ← request.headers["X-API-Key"]
    device_id ← request.headers["X-Device-ID"]
    
    IF api_key = NULL OR device_id = NULL THEN
      RETURN (false, NULL)
    END IF
    
    // 查询数据库验证
    device ← database.findDeviceById(device_id)
    
    IF device = NULL THEN
      logWarning("设备不存在: " + device_id)
      RETURN (false, NULL)
    END IF
    
    IF device.api_key ≠ api_key THEN
      logWarning("API Key不匹配: " + device_id)
      RETURN (false, NULL)
    END IF
    
    IF device.enabled = false THEN
      logWarning("设备已禁用: " + device_id)
      RETURN (false, NULL)
    END IF
    
    // 更新设备最后在线时间
    database.updateDevice(device_id, {last_seen: now()})
    
    RETURN (true, device_id)
  END SEQUENCE
END PROCEDURE
```

### 机制 2: 请求签名

**目的**: 防止请求被篡改和重放攻击

**签名算法**: HMAC-SHA256

**签名流程**:
```pascal
PROCEDURE GenerateSignature
  INPUT: payload (请求数据), secret_key (设备密钥)
  OUTPUT: signature (签名字符串)
  
  SEQUENCE
    // 步骤1: 构建待签名字符串
    sign_string ← payload.uid + "|" + 
                   payload.device_id + "|" + 
                   payload.timestamp
    
    // 步骤2: 计算HMAC-SHA256
    signature ← HMAC_SHA256(sign_string, secret_key)
    
    // 步骤3: 转换为十六进制字符串
    signature_hex ← toHexString(signature)
    
    RETURN signature_hex
  END SEQUENCE
END PROCEDURE
```

**签名验证流程**:
```pascal
PROCEDURE VerifySignature
  INPUT: request (HTTP请求), device (设备信息)
  OUTPUT: valid (签名是否有效)
  
  SEQUENCE
    // 步骤1: 提取请求数据
    payload ← parseJSON(request.body)
    received_signature ← payload.signature
    
    // 步骤2: 检查时间戳（防重放攻击）
    current_time ← getCurrentUnixTimestamp()
    time_diff ← abs(current_time - payload.timestamp)
    
    IF time_diff > 300 THEN  // 5分钟有效期
      logWarning("请求时间戳过期: " + time_diff + "秒")
      RETURN false
    END IF
    
    // 步骤3: 重新计算签名
    expected_signature ← GenerateSignature(payload, device.secret_key)
    
    // 步骤4: 比较签名
    IF received_signature = expected_signature THEN
      RETURN true
    ELSE
      logWarning("签名验证失败")
      RETURN false
    END IF
  END SEQUENCE
END PROCEDURE
```

**密钥管理**:
- 每个设备有两个密钥：
  - `api_key`: 用于设备认证（存储在数据库）
  - `secret_key`: 用于签名计算（存储在数据库，不通过API返回）
- 密钥在设备注册时生成
- ESP32固件中硬编码或通过安全配置文件存储

### 机制 3: 防重放攻击

**时间戳验证**:
- 每个请求必须包含Unix时间戳
- 服务器验证时间戳在当前时间±5分钟内
- 超出范围的请求被拒绝

**Nonce机制（可选增强）**:
- 每个请求包含唯一的nonce值
- 服务器缓存最近5分钟的nonce
- 重复的nonce被拒绝

### 机制 4: 速率限制

**设备请求限制**:
- 每个设备每分钟最多60次请求
- 超出限制返回 `429 Too Many Requests`

**IP限制**:
- 每个IP每分钟最多100次请求
- 防止DDoS攻击

**实现方式**:
```pascal
PROCEDURE CheckRateLimit
  INPUT: device_id (设备ID), ip_address (IP地址)
  OUTPUT: allowed (是否允许请求)
  
  SEQUENCE
    // 检查设备级别限制
    device_count ← redis.get("rate_limit:device:" + device_id)
    
    IF device_count ≥ 60 THEN
      RETURN false
    END IF
    
    // 检查IP级别限制
    ip_count ← redis.get("rate_limit:ip:" + ip_address)
    
    IF ip_count ≥ 100 THEN
      RETURN false
    END IF
    
    // 增加计数器
    redis.incr("rate_limit:device:" + device_id, expire=60)
    redis.incr("rate_limit:ip:" + ip_address, expire=60)
    
    RETURN true
  END SEQUENCE
END PROCEDURE
```

### 机制 5: HTTPS加密

**生产环境要求**:
- 必须使用HTTPS（TLS 1.2+）
- 使用有效的SSL证书（Let's Encrypt免费证书）
- 禁用不安全的加密套件

**开发环境**:
- 可使用HTTP（仅限本地网络）
- ESP32固件支持HTTP/HTTPS切换配置

### 机制 6: 数据库安全

**SQL注入防护**:
- 使用参数化查询（Prepared Statements）
- 禁止拼接SQL字符串

**密码存储**:
- 管理员密码使用bcrypt哈希（cost=10）
- 不存储明文密码

**数据库访问控制**:
- 应用程序使用专用数据库用户
- 最小权限原则（只授予必要的权限）
- 禁止root用户访问

### 机制 7: 本地缓存安全

**缓存加密（可选）**:
- ESP32本地缓存可使用AES-128加密
- 密钥存储在安全区域（SPIFFS加密分区）

**缓存有效期**:
- 缓存条目有效期24小时
- 过期自动清除

**缓存更新策略**:
- 云端可控制哪些卡片允许缓存
- 敏感卡片（如管理员卡）不缓存


## 部署架构

### 架构 1: 本地部署（家庭/小型办公室）

**硬件要求**:
- 服务器: Raspberry Pi 4 / 旧电脑 / NAS
- 最低配置: 1GB RAM, 10GB存储
- 网络: 局域网连接

**软件栈**:
```
┌─────────────────────────────────┐
│   Web浏览器（管理界面）          │
└─────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────┐
│   Nginx（反向代理 + SSL）        │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│   Node.js/Python后端服务         │
│   (PM2进程管理)                  │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│   SQLite数据库                   │
└─────────────────────────────────┘
```

**部署步骤**:
```pascal
PROCEDURE DeployLocalServer
  SEQUENCE
    // 步骤1: 安装依赖
    EXECUTE "sudo apt update"
    EXECUTE "sudo apt install nodejs npm nginx sqlite3"
    EXECUTE "sudo npm install -g pm2"
    
    // 步骤2: 克隆代码
    EXECUTE "git clone https://github.com/your-repo/nfc-access-control.git"
    EXECUTE "cd nfc-access-control/server"
    
    // 步骤3: 安装依赖
    EXECUTE "npm install"
    
    // 步骤4: 初始化数据库
    EXECUTE "npm run db:init"
    
    // 步骤5: 配置环境变量
    CREATE_FILE ".env" WITH CONTENT:
      DATABASE_PATH=./data/access_control.db
      PORT=3000
      JWT_SECRET=your_random_secret_key
      NODE_ENV=production
    
    // 步骤6: 启动服务
    EXECUTE "pm2 start server.js --name nfc-access-api"
    EXECUTE "pm2 save"
    EXECUTE "pm2 startup"
    
    // 步骤7: 配置Nginx
    CREATE_FILE "/etc/nginx/sites-available/nfc-access" WITH CONTENT:
      server {
        listen 80;
        server_name your-local-ip;
        
        location / {
          proxy_pass http://localhost:3000;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_cache_bypass $http_upgrade;
        }
      }
    
    EXECUTE "sudo ln -s /etc/nginx/sites-available/nfc-access /etc/nginx/sites-enabled/"
    EXECUTE "sudo nginx -t"
    EXECUTE "sudo systemctl restart nginx"
    
    DISPLAY "部署完成！访问 http://your-local-ip 进行管理"
  END SEQUENCE
END PROCEDURE
```

### 架构 2: 云服务器部署（生产环境）

**云服务商选择**:
- AWS EC2 / Lightsail
- 阿里云ECS
- 腾讯云CVM
- DigitalOcean Droplet

**推荐配置**:
- CPU: 1核
- 内存: 2GB
- 存储: 20GB SSD
- 带宽: 1Mbps（足够门禁系统使用）

**软件栈**:
```
┌─────────────────────────────────┐
│   CDN（可选，加速静态资源）      │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│   Nginx + Let's Encrypt SSL      │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│   Node.js/Python后端服务         │
│   (PM2 / Systemd)                │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│   PostgreSQL数据库               │
└─────────────────────────────────┘
```

**部署步骤**:
```pascal
PROCEDURE DeployCloudServer
  SEQUENCE
    // 步骤1: 创建云服务器实例
    CREATE_INSTANCE:
      OS: Ubuntu 22.04 LTS
      Region: 选择离用户最近的区域
      Security_Group: 开放22(SSH), 80(HTTP), 443(HTTPS)端口
    
    // 步骤2: SSH连接服务器
    EXECUTE "ssh root@your-server-ip"
    
    // 步骤3: 安装依赖
    EXECUTE "apt update && apt upgrade -y"
    EXECUTE "apt install -y nodejs npm nginx postgresql certbot python3-certbot-nginx"
    EXECUTE "npm install -g pm2"
    
    // 步骤4: 配置PostgreSQL
    EXECUTE "sudo -u postgres psql"
    EXECUTE_SQL:
      CREATE DATABASE access_control;
      CREATE USER access_user WITH PASSWORD 'strong_password';
      GRANT ALL PRIVILEGES ON DATABASE access_control TO access_user;
    
    // 步骤5: 部署应用
    EXECUTE "git clone https://github.com/your-repo/nfc-access-control.git /var/www/nfc-access"
    EXECUTE "cd /var/www/nfc-access/server"
    EXECUTE "npm install --production"
    
    // 步骤6: 配置环境变量
    CREATE_FILE ".env" WITH CONTENT:
      DATABASE_URL=postgresql://access_user:strong_password@localhost:5432/access_control
      PORT=3000
      JWT_SECRET=your_random_secret_key_min_32_chars
      NODE_ENV=production
      ALLOWED_ORIGINS=https://yourdomain.com
    
    // 步骤7: 初始化数据库
    EXECUTE "npm run db:migrate"
    EXECUTE "npm run db:seed"
    
    // 步骤8: 启动服务
    EXECUTE "pm2 start server.js --name nfc-access-api"
    EXECUTE "pm2 startup systemd"
    EXECUTE "pm2 save"
    
    // 步骤9: 配置Nginx + SSL
    CREATE_FILE "/etc/nginx/sites-available/nfc-access" WITH CONTENT:
      server {
        listen 80;
        server_name yourdomain.com;
        
        location / {
          return 301 https://$server_name$request_uri;
        }
      }
      
      server {
        listen 443 ssl http2;
        server_name yourdomain.com;
        
        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
        
        location / {
          proxy_pass http://localhost:3000;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_cache_bypass $http_upgrade;
        }
      }
    
    EXECUTE "ln -s /etc/nginx/sites-available/nfc-access /etc/nginx/sites-enabled/"
    
    // 步骤10: 获取SSL证书
    EXECUTE "certbot --nginx -d yourdomain.com"
    
    // 步骤11: 配置自动续期
    EXECUTE "certbot renew --dry-run"
    
    // 步骤12: 重启服务
    EXECUTE "nginx -t"
    EXECUTE "systemctl restart nginx"
    
    DISPLAY "部署完成！访问 https://yourdomain.com 进行管理"
  END SEQUENCE
END PROCEDURE
```

### 架构 3: Docker容器化部署

**Docker Compose配置**:
```yaml
version: '3.8'

services:
  # 后端API服务
  api:
    build: ./server
    container_name: nfc-access-api
    restart: always
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://access_user:password@db:5432/access_control
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    depends_on:
      - db
    volumes:
      - ./server/logs:/app/logs
    networks:
      - nfc-network

  # PostgreSQL数据库
  db:
    image: postgres:15-alpine
    container_name: nfc-access-db
    restart: always
    environment:
      - POSTGRES_DB=access_control
      - POSTGRES_USER=access_user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - nfc-network

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    container_name: nfc-access-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./web:/usr/share/nginx/html
    depends_on:
      - api
    networks:
      - nfc-network

volumes:
  postgres_data:

networks:
  nfc-network:
    driver: bridge
```

**部署命令**:
```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

### 架构 4: ESP32固件配置

**WiFi配置**:
```cpp
// config.h
#define WIFI_SSID "Your_WiFi_SSID"
#define WIFI_PASSWORD "Your_WiFi_Password"

// 云端API配置
#define API_BASE_URL "https://yourdomain.com/api"
#define DEVICE_ID "door_1"
#define API_KEY "EXAMPLE_API_KEY_32_CHARS_LONG_PLACEHOLDER"
#define SECRET_KEY "your_device_secret_key"

// 硬件配置
#define PN532_SDA_PIN 8
#define PN532_SCL_PIN 9
#define RELAY_PIN 4
#define BUZZER_PIN 5
#define EXIT_BUTTON_PIN 6

// 门锁配置
#define UNLOCK_DURATION 3000  // 开锁持续时间（毫秒）

// 缓存配置
#define CACHE_SIZE 50
#define CACHE_EXPIRE 86400  // 24小时
```

**固件烧录步骤**:
```pascal
PROCEDURE FlashESP32Firmware
  SEQUENCE
    // 步骤1: 安装Arduino IDE和ESP32支持
    INSTALL "Arduino IDE"
    ADD_BOARD_URL "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json"
    INSTALL_BOARD "ESP32 by Espressif Systems"
    
    // 步骤2: 安装依赖库
    INSTALL_LIBRARY "Adafruit PN532"
    INSTALL_LIBRARY "ArduinoJson"
    INSTALL_LIBRARY "WiFi"
    INSTALL_LIBRARY "HTTPClient"
    
    // 步骤3: 配置参数
    EDIT "config.h" WITH:
      - WiFi SSID和密码
      - API Base URL
      - Device ID和API Key
      - Secret Key
    
    // 步骤4: 编译和上传
    SELECT_BOARD "ESP32-S3 Dev Module"
    SELECT_PORT "COM3" (或 /dev/ttyUSB0)
    SET_UPLOAD_SPEED "115200"
    CLICK "Upload"
    
    // 步骤5: 验证
    OPEN "Serial Monitor"
    SET_BAUD_RATE "115200"
    VERIFY_OUTPUT:
      - "WiFi connected"
      - "IP address: xxx.xxx.xxx.xxx"
      - "PN532 initialized"
      - "System ready"
    
    DISPLAY "固件烧录完成！"
  END SEQUENCE
END PROCEDURE
```

## 数据库初始化

### SQLite初始化脚本

```sql
-- 创建卡片表
CREATE TABLE IF NOT EXISTS cards (
  uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  access_start DATETIME,
  access_end DATETIME,
  time_slots TEXT,
  allowed_devices TEXT,
  cacheable BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建设备表
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  mac_address TEXT UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  secret_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  last_seen DATETIME,
  firmware_version TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建访问日志表
CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  device_id TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  allowed BOOLEAN NOT NULL,
  reason TEXT,
  source TEXT NOT NULL,
  card_name TEXT,
  device_name TEXT,
  FOREIGN KEY (uid) REFERENCES cards(uid),
  FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- 创建管理员表
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_access_logs_timestamp ON access_logs(timestamp DESC);
CREATE INDEX idx_access_logs_uid ON access_logs(uid);
CREATE INDEX idx_access_logs_device_id ON access_logs(device_id);
CREATE INDEX idx_cards_enabled ON cards(enabled);

-- 插入默认管理员（密码: admin123）
INSERT INTO admins (username, password_hash, email) 
VALUES ('admin', '$2b$10$rBV2kHYgLcIGxY4x8W1rXeJ7Z8QZ9X0Y1Z2Y3Z4Z5Z6Z7Z8Z9Z0Z1', 'admin@example.com');

-- 插入示例设备
INSERT INTO devices (device_id, name, location, mac_address, api_key, secret_key) 
VALUES (
  'door_1', 
  '前门门禁', 
  '一楼大厅', 
  'A4:CF:12:34:56:78',
  'EXAMPLE_API_KEY_32_CHARS_LONG_PLACEHOLDER',
  'secret_example_key_32chars_long_too'
);

-- 插入示例卡片
INSERT INTO cards (uid, name, enabled, cacheable) 
VALUES ('04A1B2C3D4E5F6', '张三', 1, 1);
```

### PostgreSQL初始化脚本

```sql
-- 创建卡片表
CREATE TABLE IF NOT EXISTS cards (
  uid VARCHAR(14) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  access_start TIMESTAMP,
  access_end TIMESTAMP,
  time_slots JSONB,
  allowed_devices JSONB,
  cacheable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建设备表
CREATE TABLE IF NOT EXISTS devices (
  device_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(200),
  mac_address VARCHAR(17) UNIQUE,
  api_key VARCHAR(64) NOT NULL UNIQUE,
  secret_key VARCHAR(64) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMP,
  firmware_version VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建访问日志表
CREATE TABLE IF NOT EXISTS access_logs (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(14) NOT NULL,
  device_id VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  allowed BOOLEAN NOT NULL,
  reason TEXT,
  source VARCHAR(10) NOT NULL,
  card_name VARCHAR(100),
  device_name VARCHAR(100),
  FOREIGN KEY (uid) REFERENCES cards(uid) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- 创建管理员表
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_access_logs_timestamp ON access_logs(timestamp DESC);
CREATE INDEX idx_access_logs_uid ON access_logs(uid);
CREATE INDEX idx_access_logs_device_id ON access_logs(device_id);
CREATE INDEX idx_cards_enabled ON cards(enabled);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 错误处理

### 错误场景 1: 网络连接失败

**条件**: ESP32无法连接到云端API

**响应**: 
- 记录错误日志到本地
- 自动切换到本地缓存验证
- 蜂鸣器短鸣2次提示离线模式
- 继续正常工作

**恢复**: 
- 后台持续尝试重连WiFi
- 连接恢复后自动切换回云端验证
- 同步离线期间的日志（可选）

### 错误场景 2: API认证失败

**条件**: API Key无效或设备被禁用

**响应**:
- 返回401 Unauthorized
- ESP32记录错误并停止请求
- 蜂鸣器长鸣3次提示错误
- LED指示灯闪烁红色

**恢复**:
- 管理员检查设备配置
- 更新API Key或启用设备
- 重启ESP32重新连接

### 错误场景 3: 数据库连接失败

**条件**: 云端服务无法连接数据库

**响应**:
- 返回500 Internal Server Error
- 记录详细错误日志
- 发送告警通知（邮件/短信）
- 服务自动重启尝试恢复

**恢复**:
- 检查数据库服务状态
- 检查连接配置
- 恢复数据库服务

### 错误场景 4: PN532模块故障

**条件**: ESP32无法初始化PN532或读取失败

**响应**:
- 串口输出错误信息
- LED指示灯常亮红色
- 蜂鸣器持续鸣叫
- 系统进入故障模式

**恢复**:
- 检查I2C接线（SDA/SCL）
- 检查PN532供电
- 重启ESP32
- 更换PN532模块

## 测试策略

### 单元测试

**ESP32客户端测试**:
- NFC读取功能测试
- HTTP请求构建测试
- 签名生成测试
- 缓存管理测试
- 继电器控制测试

**云端API测试**:
- 权限验证逻辑测试
- 签名验证测试
- 数据库操作测试
- JWT认证测试
- 速率限制测试

**测试框架**:
- ESP32: Unity Test Framework
- Node.js: Jest / Mocha
- Python: pytest

### 集成测试

**端到端测试流程**:
```pascal
PROCEDURE IntegrationTest
  SEQUENCE
    // 测试1: 正常刷卡流程
    TEST "正常刷卡开门":
      GIVEN 卡片已添加且启用
      WHEN ESP32读取卡片UID
      THEN 云端返回allow=true
      AND 继电器控制门锁打开
      AND 日志记录成功
    
    // 测试2: 禁用卡片
    TEST "禁用卡片拒绝":
      GIVEN 卡片已禁用
      WHEN ESP32读取卡片UID
      THEN 云端返回allow=false
      AND 蜂鸣器短鸣3次
      AND 日志记录拒绝原因
    
    // 测试3: 离线缓存
    TEST "网络故障使用缓存":
      GIVEN 卡片已缓存
      AND 网络连接断开
      WHEN ESP32读取卡片UID
      THEN 使用本地缓存验证
      AND 门锁正常工作
    
    // 测试4: 签名验证
    TEST "签名错误拒绝请求":
      GIVEN 请求签名不正确
      WHEN ESP32发送请求
      THEN 云端返回401错误
      AND ESP32切换到缓存模式
    
    // 测试5: 时间段权限
    TEST "非时间段内拒绝":
      GIVEN 卡片仅允许09:00-18:00访问
      AND 当前时间为20:00
      WHEN ESP32读取卡片UID
      THEN 云端返回allow=false
      AND 拒绝原因为"不在允许时间段内"
  END SEQUENCE
END PROCEDURE
```

### 性能测试

**负载测试**:
- 模拟100个设备同时请求
- 每秒1000次刷卡请求
- 数据库查询响应时间 < 50ms
- API响应时间 < 200ms

**压力测试**:
- 持续高负载运行24小时
- 内存使用稳定不泄漏
- CPU使用率 < 80%

## 性能考虑

**ESP32性能优化**:
- 使用WiFi省电模式（空闲时）
- 缓存使用SPIFFS文件系统
- 减少不必要的日志输出
- 优化NFC读取频率（500ms轮询）

**云端性能优化**:
- 数据库连接池（最大10个连接）
- Redis缓存热点数据（卡片权限）
- API响应压缩（gzip）
- 静态资源CDN加速

**数据库优化**:
- 合理使用索引
- 定期清理旧日志（保留3个月）
- 分表存储（按月分表）

## 安全考虑

**物理安全**:
- ESP32设备放置在安全位置
- 防止USB调试端口被访问
- 继电器和磁力锁防拆保护

**网络安全**:
- 使用HTTPS加密通信
- 定期更新SSL证书
- 防火墙限制访问端口

**数据安全**:
- 定期备份数据库
- 敏感数据加密存储
- 访问日志保留审计

## 依赖项

**ESP32固件依赖**:
- Arduino ESP32 Core (v2.0.0+)
- Adafruit PN532 Library (v1.3.0+)
- ArduinoJson (v6.21.0+)
- WiFi (内置)
- HTTPClient (内置)

**Node.js后端依赖**:
- express (v4.18.0+)
- jsonwebtoken (v9.0.0+)
- bcrypt (v5.1.0+)
- pg / sqlite3 (数据库驱动)
- dotenv (v16.0.0+)
- cors (v2.8.5+)

**Python后端依赖**:
- fastapi (v0.100.0+)
- uvicorn (v0.23.0+)
- sqlalchemy (v2.0.0+)
- pydantic (v2.0.0+)
- python-jose (v3.3.0+)
- passlib (v1.7.4+)
- python-multipart (v0.0.6+)

**Web前端依赖**:
- Vue.js 3 / React 18 (可选)
- Axios (v1.4.0+)
- Tailwind CSS / Bootstrap 5 (可选)
