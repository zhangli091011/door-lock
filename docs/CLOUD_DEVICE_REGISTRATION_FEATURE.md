# 云端设备注册功能说明

## 功能概述

云端设备注册功能允许管理员通过Web管理界面在云端注册ESP32 NFC门禁设备，系统会自动生成设备认证所需的API密钥和Secret密钥。

## 新增功能

### 1. 设备注册界面

**位置**: Web管理界面 > 设备管理 > 注册设备

**功能特性**:
- ✅ 友好的表单界面，支持输入设备信息
- ✅ 实时表单验证（设备ID格式、MAC地址格式）
- ✅ 自动生成32位API Key和Secret Key
- ✅ 设备凭证展示模态框，支持一键复制
- ✅ 安全提示：Secret Key只显示一次

**输入字段**:
- **设备ID** (必填): 唯一标识符，只能包含字母、数字、下划线和连字符
- **设备名称** (必填): 友好名称，最多100字符
- **位置** (可选): 物理位置描述，最多200字符
- **MAC地址** (可选): 网络MAC地址，格式 XX:XX:XX:XX:XX:XX

### 2. 设备编辑界面

**位置**: Web管理界面 > 设备管理 > 编辑按钮

**功能特性**:
- ✅ 修改设备名称、位置、MAC地址
- ✅ 启用/禁用设备开关
- ✅ 实时表单验证
- ✅ 设备ID不可修改（保证唯一性）

**可编辑字段**:
- 设备名称
- 位置
- MAC地址
- 启用状态

### 3. 设备凭证展示

**功能特性**:
- ✅ 注册成功后自动弹出凭证窗口
- ✅ 显示设备ID、名称、API Key、Secret Key
- ✅ 每个字段都有"复制"按钮
- ✅ 醒目的安全警告提示
- ✅ 配置说明和使用指南

**安全设计**:
- Secret Key只在注册时显示一次
- 关闭窗口后无法再次查看
- 强制用户确认已保存凭证

### 4. 设备列表展示

**功能特性**:
- ✅ 显示所有已注册设备
- ✅ 实时在线状态（基于最后在线时间）
- ✅ 设备信息一览（ID、名称、位置、状态）
- ✅ 快速编辑按钮

**在线状态判断**:
- 在线：最后在线时间 < 5分钟
- 离线：最后在线时间 ≥ 5分钟

## 技术实现

### 后端API

#### 1. 注册设备 API

**端点**: `POST /api/devices`

**认证**: 需要JWT Token（管理员权限）

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

**验证规则**:
- 设备ID唯一性检查
- 设备ID格式验证（字母、数字、下划线、连字符）
- MAC地址格式验证（XX:XX:XX:XX:XX:XX）
- MAC地址唯一性检查
- 设备名称长度验证（1-100字符）

**密钥生成**:
- API Key: 32位随机十六进制字符串
- Secret Key: 32位随机十六进制字符串
- 使用 `crypto.randomBytes()` 生成

#### 2. 更新设备 API

**端点**: `PUT /api/devices/:deviceId`

**认证**: 需要JWT Token（管理员权限）

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

#### 3. 获取设备列表 API

**端点**: `GET /api/devices`

**认证**: 需要JWT Token（管理员权限）

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

### 前端实现

#### 1. 模态框组件

**添加设备模态框** (`#addDeviceModal`):
- 表单输入验证
- 实时格式检查
- 提交处理

**编辑设备模态框** (`#editDeviceModal`):
- 加载现有设备数据
- 表单验证
- 更新处理

**设备凭证模态框** (`#deviceCredentialsModal`):
- 显示生成的凭证
- 一键复制功能
- 安全提示

#### 2. JavaScript函数

**`App.showAddDeviceModal()`**:
- 重置表单
- 显示添加设备模态框

**`App.submitAddDevice()`**:
- 验证表单数据
- 调用注册API
- 显示凭证模态框
- 刷新设备列表

**`App.showDeviceCredentials(deviceData)`**:
- 填充凭证信息
- 显示凭证模态框

**`App.showEditDeviceModal(deviceId)`**:
- 获取设备详情
- 填充表单
- 显示编辑模态框

**`App.submitEditDevice()`**:
- 验证表单数据
- 调用更新API
- 刷新设备列表

**`App.copyToClipboard(elementId)`**:
- 复制文本到剪贴板
- 显示成功提示

#### 3. CSS样式

**设备凭证模态框样式**:
- 成功主题（绿色头部）
- 等宽字体显示密钥
- 醒目的警告和提示框
- 响应式布局

### 数据库

设备表已存在，无需修改：

```sql
CREATE TABLE devices (
    device_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    mac_address TEXT UNIQUE,
    api_key TEXT UNIQUE NOT NULL,
    secret_key TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    last_seen TIMESTAMP,
    firmware_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 使用流程

### 管理员操作流程

1. **登录管理后台**
   - 访问 Web 管理界面
   - 使用管理员账号登录

2. **进入设备管理**
   - 点击左侧导航"设备管理"

3. **注册新设备**
   - 点击"注册设备"按钮
   - 填写设备信息
   - 提交表单

4. **保存设备凭证**
   - 复制 API Key
   - 复制 Secret Key
   - 保存到安全位置

5. **配置ESP32设备**
   - 打开 `esp32-firmware/config.h`
   - 填入设备ID、API Key、Secret Key
   - 编译并上传固件

### ESP32设备配置

在 `config.h` 中配置：

```cpp
// Device Configuration
#define DEVICE_ID "door-001"
#define API_KEY "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
#define SECRET_KEY "p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1"

// Server Configuration
#define SERVER_URL "https://your-domain.com"
```

## 安全特性

### 1. 密钥生成

- 使用 `crypto.randomBytes()` 生成高强度随机密钥
- API Key 和 Secret Key 各32位十六进制字符
- 密钥唯一性保证

### 2. 访问控制

- 所有设备管理API需要JWT认证
- 只有管理员可以注册和管理设备
- Secret Key只在注册时返回一次

### 3. 数据验证

- 设备ID格式验证
- MAC地址格式验证
- 唯一性约束检查
- 输入长度限制

### 4. 前端安全

- XSS防护（HTML转义）
- CSRF防护（JWT Token）
- 安全提示和警告

## 错误处理

### 常见错误

**设备ID已存在**:
```json
{
  "success": false,
  "error": "Device ID already exists",
  "message": "A device with this ID already exists"
}
```

**MAC地址已存在**:
```json
{
  "success": false,
  "error": "MAC address already exists",
  "message": "A device with this MAC address already exists"
}
```

**设备ID格式错误**:
```json
{
  "success": false,
  "error": "Invalid device_id format",
  "message": "device_id must contain only letters, numbers, underscores, and hyphens"
}
```

**MAC地址格式错误**:
```json
{
  "success": false,
  "error": "Invalid MAC address format",
  "message": "MAC address must be in format XX:XX:XX:XX:XX:XX"
}
```

## 测试

### 手动测试

1. 访问 Web 管理界面
2. 登录管理员账号
3. 进入设备管理页面
4. 点击"注册设备"
5. 填写测试设备信息
6. 验证凭证显示
7. 检查设备列表

### API测试

使用提供的测试脚本：

```bash
# PowerShell
pwsh test-device-registration.ps1

# 或使用curl
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 文件清单

### 新增文件

- `docs/DEVICE_REGISTRATION.md` - 设备注册用户指南
- `docs/CLOUD_DEVICE_REGISTRATION_FEATURE.md` - 功能技术文档
- `test-device-registration.js` - Node.js测试脚本
- `test-device-registration.sh` - Bash测试脚本

### 修改文件

- `web-admin/index.html` - 添加设备注册和编辑模态框
- `web-admin/js/app.js` - 实现设备管理功能
- `web-admin/css/styles.css` - 添加设备凭证模态框样式
- `README.md` - 更新功能列表和使用说明

### 已存在文件（无需修改）

- `server/src/controllers/deviceController.ts` - 设备控制器
- `server/src/routes/deviceRoutes.ts` - 设备路由
- `server/src/repositories/DeviceRepository.ts` - 设备数据访问层
- `web-admin/js/api.js` - API客户端

## 后续优化建议

### 功能增强

1. **批量导入设备**
   - 支持CSV文件导入
   - 批量生成设备凭证

2. **设备分组管理**
   - 按位置或功能分组
   - 分组权限控制

3. **设备监控增强**
   - 设备健康状态检查
   - 离线告警通知
   - 设备性能统计

4. **凭证管理**
   - 重新生成API密钥
   - 密钥轮换机制
   - 密钥过期策略

### 安全增强

1. **双因素认证**
   - 管理员登录2FA
   - 敏感操作二次确认

2. **审计日志**
   - 记录设备注册操作
   - 记录凭证查看历史
   - 操作人员追踪

3. **IP白名单**
   - 限制设备访问IP
   - 地理位置验证

### 用户体验

1. **设备配置向导**
   - 分步引导注册流程
   - 自动生成配置文件
   - 固件配置模板下载

2. **设备状态仪表板**
   - 实时设备地图
   - 设备健康度评分
   - 快速故障诊断

3. **移动端适配**
   - 响应式设计优化
   - 移动端专用界面
   - 扫码配置设备

## 总结

云端设备注册功能为ESP32 NFC门禁系统提供了完整的设备生命周期管理能力：

✅ **简化部署**: 通过Web界面快速注册设备，无需手动生成密钥
✅ **安全可靠**: 自动生成高强度密钥，确保设备通信安全
✅ **易于管理**: 集中管理所有设备，实时监控设备状态
✅ **用户友好**: 直观的界面设计，清晰的操作流程

该功能已完全集成到现有系统中，可立即投入使用。
