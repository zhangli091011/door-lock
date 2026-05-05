# 设备注册指南

本文档介绍如何在云端注册ESP32 NFC门禁设备。

## 功能概述

云端设备注册功能允许管理员通过Web管理界面注册新的ESP32设备，并获取设备认证所需的API密钥和Secret密钥。

## 注册流程

### 1. 登录管理后台

访问Web管理界面并使用管理员账号登录：
- URL: `https://your-domain.com` 或 `http://localhost:8080`（本地开发）
- 默认账号: `admin`
- 默认密码: `admin123`

### 2. 进入设备管理页面

在左侧导航栏点击 **"设备管理"** 进入设备管理页面。

### 3. 注册新设备

1. 点击页面右上角的 **"注册设备"** 按钮
2. 在弹出的对话框中填写设备信息：

   - **设备ID** (必填): 设备的唯一标识符
     - 只能包含字母、数字、下划线和连字符
     - 例如: `door-001`, `gate_main`, `entrance-1`
     - 最大长度: 50个字符
   
   - **设备名称** (必填): 设备的友好名称
     - 例如: `前门门禁`, `后门闸机`, `一楼入口`
     - 最大长度: 100个字符
   
   - **位置** (可选): 设备的物理位置
     - 例如: `一楼大厅`, `二楼办公区`, `地下停车场`
     - 最大长度: 200个字符
   
   - **MAC地址** (可选): 设备的网络MAC地址
     - 格式: `XX:XX:XX:XX:XX:XX`
     - 例如: `AA:BB:CC:DD:EE:FF`
     - 用于设备识别和管理

3. 点击 **"注册设备"** 按钮提交

### 4. 保存设备凭证

注册成功后，系统会显示设备凭证信息：

- **设备ID**: 设备的唯一标识符
- **设备名称**: 设备的友好名称
- **API Key**: 设备认证密钥（32字符）
- **Secret Key**: 设备签名密钥（32字符）

**⚠️ 重要提示：**
- Secret Key只会显示一次，关闭窗口后无法再次查看
- 请立即复制并妥善保存这些凭证
- 每个字段旁边都有"复制"按钮，方便快速复制

### 5. 配置ESP32设备

将获取的凭证配置到ESP32设备中：

1. 打开 `esp32-firmware/config.h` 文件
2. 找到以下配置项并填入对应的值：

```cpp
// Device Configuration
#define DEVICE_ID "door-001"           // 填入设备ID
#define API_KEY "your-api-key-here"    // 填入API Key
#define SECRET_KEY "your-secret-key"   // 填入Secret Key

// Server Configuration
#define SERVER_URL "https://your-domain.com"  // 服务器地址
```

3. 保存文件并重新编译上传到ESP32设备

## 设备管理

### 查看设备列表

在设备管理页面可以查看所有已注册的设备：

- **设备ID**: 设备的唯一标识符
- **名称**: 设备的友好名称
- **位置**: 设备的物理位置
- **状态**: 在线/离线（基于最后在线时间）
- **最后在线**: 设备最后一次连接服务器的时间

设备在线状态判断：
- **在线**: 最后在线时间在5分钟以内
- **离线**: 最后在线时间超过5分钟或从未连接

### 编辑设备信息

1. 在设备列表中找到要编辑的设备
2. 点击该设备行的 **"编辑"** 按钮（铅笔图标）
3. 在弹出的对话框中修改设备信息：
   - 设备名称
   - 位置
   - MAC地址
   - 启用/禁用状态
4. 点击 **"保存更改"** 按钮

**注意：**
- 设备ID不可修改
- 禁用设备后，该设备将无法进行访问控制验证
- API Key和Secret Key不可通过编辑界面查看或修改

### 设备状态监控

在 **"实时状态"** 页面可以查看：
- 在线设备数量 / 总设备数量
- 设备的实时连接状态
- 设备的访问记录

## API接口

### 注册设备

**端点**: `POST /api/devices`

**请求头**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**请求体**:
```json
{
  "device_id": "door-001",
  "name": "前门门禁",
  "location": "一楼大厅",
  "mac_address": "AA:BB:CC:DD:EE:FF"
}
```

**响应**:
```json
{
  "success": true,
  "message": "设备注册成功",
  "data": {
    "device_id": "door-001",
    "name": "前门门禁",
    "api_key": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "secret_key": "p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### 更新设备

**端点**: `PUT /api/devices/:deviceId`

**请求头**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "前门门禁（已更新）",
  "location": "一楼大厅入口",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "enabled": true
}
```

**响应**:
```json
{
  "success": true,
  "message": "设备更新成功",
  "data": {
    "device_id": "door-001",
    "name": "前门门禁（已更新）",
    "location": "一楼大厅入口",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "enabled": true,
    "updated_at": "2024-01-15T11:00:00.000Z"
  }
}
```

### 获取设备列表

**端点**: `GET /api/devices`

**请求头**:
```
Authorization: Bearer <JWT_TOKEN>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "device_id": "door-001",
        "name": "前门门禁",
        "location": "一楼大厅",
        "mac_address": "AA:BB:CC:DD:EE:FF",
        "enabled": true,
        "is_online": true,
        "last_seen": "2024-01-15T11:00:00.000Z",
        "firmware_version": "1.0.0",
        "created_at": "2024-01-15T10:30:00.000Z",
        "updated_at": "2024-01-15T11:00:00.000Z"
      }
    ]
  }
}
```

## 安全注意事项

1. **保护Secret Key**
   - Secret Key用于生成请求签名，必须妥善保管
   - 不要将Secret Key提交到版本控制系统
   - 不要在日志或错误信息中输出Secret Key

2. **设备ID唯一性**
   - 每个设备必须有唯一的设备ID
   - 设备ID一旦创建不可修改
   - 建议使用有意义的命名规则

3. **MAC地址验证**
   - MAC地址可用于额外的设备识别
   - 系统会验证MAC地址的唯一性
   - MAC地址格式必须为 `XX:XX:XX:XX:XX:XX`

4. **访问控制**
   - 只有已认证的管理员可以注册和管理设备
   - 所有API请求都需要有效的JWT令牌
   - 建议定期更换管理员密码

## 故障排查

### 设备注册失败

**问题**: 提示"设备ID已存在"
- **原因**: 该设备ID已被使用
- **解决**: 使用不同的设备ID

**问题**: 提示"MAC地址已存在"
- **原因**: 该MAC地址已被其他设备使用
- **解决**: 检查MAC地址是否正确，或使用不同的MAC地址

**问题**: 提示"设备ID格式不正确"
- **原因**: 设备ID包含非法字符
- **解决**: 只使用字母、数字、下划线和连字符

### 设备显示离线

**问题**: 设备注册后一直显示离线
- **原因**: 设备未成功连接到服务器
- **解决**: 
  1. 检查ESP32设备的网络连接
  2. 确认config.h中的服务器地址正确
  3. 确认API Key和Secret Key配置正确
  4. 查看ESP32串口输出的错误信息

### 无法查看Secret Key

**问题**: 关闭凭证窗口后想再次查看Secret Key
- **原因**: Secret Key只在注册时显示一次
- **解决**: 
  - 如果已保存，使用已保存的Secret Key
  - 如果未保存，需要删除设备并重新注册（注意：这会导致设备ID变化）

## 最佳实践

1. **设备命名规范**
   - 使用有意义的设备ID，如 `door-floor1-main`
   - 设备名称应清晰描述设备位置和用途
   - 位置信息应详细，便于维护

2. **凭证管理**
   - 注册设备后立即保存凭证到安全的位置
   - 使用密码管理器或加密文档存储凭证
   - 定期审查设备列表，删除不再使用的设备

3. **设备监控**
   - 定期检查设备在线状态
   - 关注设备的最后在线时间
   - 及时处理离线设备

4. **批量部署**
   - 对于多个设备，建议使用统一的命名规则
   - 准备设备信息清单，包括设备ID、名称、位置等
   - 注册后立即记录每个设备的凭证信息

## 相关文档

- [快速开始指南](../QUICK_START.md)
- [部署指南](../DEPLOYMENT.md)
- [ESP32固件配置](../esp32-firmware/README.md)
- [API文档](./API.md)
