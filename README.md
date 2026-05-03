# ESP32 NFC 云门禁系统

基于ESP32-S3和PN532 NFC模块的智能门禁解决方案，支持云端权限管理、离线缓存和Web管理界面。

## 系统概述

ESP32 NFC 云门禁系统是一个完整的物联网门禁解决方案，包含三个主要组件：

- **ESP32硬件客户端**：负责NFC读卡、网络通信和门锁控制
- **云端后端服务**：提供权限验证、设备管理和日志记录
- **Web管理前端**：可视化的卡片和设备管理界面

## 主要特性

- ✅ NFC卡片读取（PN532模块，I2C接口）
- ✅ 云端权限验证（HMAC-SHA256签名）
- ✅ 离线缓存机制（网络故障时仍可使用）
- ✅ 磁力锁控制（继电器NC端子）
- ✅ 出门按钮功能
- ✅ Web管理界面（卡片、设备、日志管理）
- ✅ 时间段权限控制
- ✅ 设备权限控制
- ✅ 访问日志记录
- ✅ 实时状态监控

## 项目结构

```
esp32-nfc-cloud-access-control/
├── server/                 # 后端服务（TypeScript/Node.js）
│   ├── src/
│   │   ├── controllers/   # 路由控制器
│   │   ├── services/      # 业务逻辑
│   │   ├── repositories/  # 数据访问层
│   │   ├── middleware/    # 中间件（认证、速率限制）
│   │   ├── utils/         # 工具函数
│   │   └── server.ts      # 主入口文件
│   ├── database/          # 数据库脚本
│   │   ├── schema.sqlite.sql
│   │   └── schema.postgresql.sql
│   ├── tests/             # 测试文件
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── esp32-firmware/        # ESP32固件（Arduino C++）
│   ├── esp32-firmware.ino # 主程序
│   ├── config.h           # 配置文件
│   ├── wifi_manager.cpp/h # WiFi管理
│   ├── nfc_manager.cpp/h  # NFC读取
│   ├── cache_manager.cpp/h # 本地缓存
│   ├── api_client.cpp/h   # HTTP客户端
│   ├── lock_controller.cpp/h # 门锁控制
│   ├── buzzer.cpp/h       # 蜂鸣器
│   └── button_manager.cpp/h # 按钮管理
│
├── web-admin/             # Web管理前端（HTML/JavaScript）
│   ├── index.html         # 主页面
│   ├── login.html         # 登录页面
│   ├── css/
│   │   └── styles.css     # 样式文件
│   ├── js/
│   │   ├── app.js         # 主应用逻辑
│   │   ├── api.js         # API调用封装
│   │   └── utils.js       # 工具函数
│   └── assets/            # 静态资源
│
├── docs/                  # 文档
│   ├── deploy-local.md    # 本地部署指南
│   ├── deploy-cloud.md    # 云服务器部署指南
│   ├── deploy-docker.md   # Docker部署指南
│   ├── flash-esp32.md     # ESP32固件烧录指南
│   └── configuration.md   # 配置说明
│
├── docker-compose.yml     # Docker编排配置
├── nginx.conf             # Nginx配置
└── README.md              # 本文件
```

## 快速开始

### 前置要求

- Node.js 16+ 和 npm
- Arduino IDE 或 PlatformIO
- ESP32-S3开发板
- PN532 NFC模块
- SQLite 或 PostgreSQL

### 1. 部署后端服务

```bash
# 进入后端目录
cd server

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env

# 编辑.env文件，配置数据库和JWT密钥
nano .env

# 初始化数据库
npm run db:init

# 启动开发服务器
npm run dev

# 或启动生产服务器
npm run build
npm start
```

### 2. 烧录ESP32固件

```bash
# 进入固件目录
cd esp32-firmware

# 编辑config.h文件，配置WiFi和API信息
nano config.h

# 使用Arduino IDE打开esp32-firmware.ino
# 选择开发板：ESP32-S3 Dev Module
# 选择端口：COM3 或 /dev/ttyUSB0
# 点击上传
```

### 3. 部署Web管理界面

```bash
# 进入Web目录
cd web-admin

# 使用任何HTTP服务器托管静态文件
# 例如使用Python：
python3 -m http.server 8080

# 或使用Nginx（推荐生产环境）
# 将web-admin目录配置为Nginx的root目录
```

### 4. 访问管理界面

打开浏览器访问：`http://localhost:8080`

默认管理员账户：
- 用户名：`admin`
- 密码：`admin123`

**⚠️ 首次登录后请立即修改默认密码！**

## 硬件接线

### ESP32-S3 引脚连接

| 组件 | ESP32引脚 | 说明 |
|------|-----------|------|
| PN532 SDA | GPIO8 | I2C数据线 |
| PN532 SCL | GPIO9 | I2C时钟线 |
| 继电器控制 | GPIO4 | 控制磁力锁 |
| 蜂鸣器 | GPIO5 | 声音反馈 |
| 出门按钮 | GPIO6 | 内部开门按钮 |
| GND | GND | 公共地线 |
| 5V | 5V | 电源（PN532、继电器） |

### 磁力锁接线

- 继电器NC（常闭）端子连接磁力锁
- 继电器COM端子连接12V电源正极
- 磁力锁负极连接12V电源负极
- 默认状态：继电器闭合，磁力锁通电（锁定）
- 开门状态：继电器断开，磁力锁断电（开锁）

## API文档

### 权限验证接口

```http
POST /api/check-card
Content-Type: application/json
X-API-Key: {device_api_key}
X-Device-ID: {device_id}

{
  "uid": "04A1B2C3D4E5F6",
  "device_id": "door_1",
  "timestamp": 1705329025,
  "signature": "a1b2c3d4e5f6..."
}
```

### 卡片管理接口

- `POST /api/cards` - 添加卡片
- `GET /api/cards` - 查询卡片列表
- `PUT /api/cards/:uid` - 更新卡片
- `DELETE /api/cards/:uid` - 删除卡片

### 设备管理接口

- `POST /api/devices` - 注册设备
- `GET /api/devices` - 查询设备列表
- `PUT /api/devices/:deviceId` - 更新设备

### 日志查询接口

- `GET /api/logs` - 查询访问日志
- `GET /api/status` - 获取实时状态

详细API文档请参考：[API Documentation](docs/api.md)

## 配置说明

### 后端环境变量（.env）

```env
# 数据库配置
DATABASE_TYPE=sqlite                    # sqlite 或 postgresql
DATABASE_PATH=./data/access_control.db  # SQLite数据库路径
# DATABASE_URL=postgresql://user:pass@localhost:5432/access_control  # PostgreSQL连接字符串

# 服务器配置
PORT=3000
NODE_ENV=production

# JWT配置
JWT_SECRET=your_random_secret_key_min_32_chars
JWT_EXPIRES_IN=24h

# CORS配置
ALLOWED_ORIGINS=http://localhost:8080,https://yourdomain.com

# 速率限制
RATE_LIMIT_DEVICE=60    # 每分钟每设备最大请求数
RATE_LIMIT_IP=100       # 每分钟每IP最大请求数
```

### ESP32固件配置（config.h）

```cpp
// WiFi配置
#define WIFI_SSID "Your_WiFi_SSID"
#define WIFI_PASSWORD "Your_WiFi_Password"

// API配置
#define API_BASE_URL "http://192.168.1.100:3000/api"
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
#define CACHE_SIZE 50         // 最大缓存卡片数量
#define CACHE_EXPIRE 86400    // 缓存有效期（秒）
```

## 部署指南

### 本地部署（家庭/小型办公室）

适合在局域网内部署，使用Raspberry Pi或旧电脑作为服务器。

详细步骤请参考：[本地部署指南](docs/deploy-local.md)

### 云服务器部署（生产环境）

适合需要远程访问的场景，支持多地点门禁统一管理。

详细步骤请参考：[云服务器部署指南](docs/deploy-cloud.md)

### Docker部署

使用Docker Compose部署后端服务（不包含nginx）。

```bash
# 启动所有服务（PostgreSQL + API）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

**注意**：本项目Docker配置不包含nginx，你需要自行部署nginx作为反向代理。

详细步骤请参考：
- [Docker部署指南](docs/deploy-docker.md)
- [Nginx外部部署指南](NGINX_DEPLOYMENT.md) ⭐ 必读

## 安全建议

1. **修改默认密码**：首次登录后立即修改管理员密码
2. **使用HTTPS**：生产环境必须使用HTTPS加密通信
3. **定期备份**：定期备份数据库文件
4. **更新固件**：及时更新ESP32固件和后端服务
5. **限制访问**：使用防火墙限制API访问端口
6. **强密钥**：使用强随机字符串作为JWT_SECRET和设备密钥

## 故障排查

### ESP32无法连接WiFi

- 检查WiFi SSID和密码是否正确
- 确认WiFi信号强度足够
- 检查路由器是否限制设备连接

### PN532无法读取卡片

- 检查I2C接线（SDA/SCL）
- 确认PN532供电正常（5V）
- 尝试重启ESP32
- 检查PN532模块是否损坏

### 云端API返回401错误

- 检查API Key是否正确
- 确认设备已注册且启用
- 检查请求签名是否正确
- 验证时间戳是否在有效范围内

### 门锁无法打开

- 检查继电器接线
- 确认继电器工作正常（听到咔嗒声）
- 检查磁力锁供电（12V）
- 验证GPIO4引脚输出

更多故障排查请参考：[故障排查指南](docs/troubleshooting.md)

## 开发指南

### 运行测试

```bash
# 后端单元测试
cd server
npm test

# 后端集成测试
npm run test:integration

# 测试覆盖率
npm run test:coverage
```

### 代码规范

项目使用ESLint和Prettier进行代码规范检查。

```bash
# 检查代码规范
npm run lint

# 自动修复
npm run lint:fix

# 格式化代码
npm run format
```

### 贡献指南

欢迎提交Issue和Pull Request！

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 联系方式

- 项目主页：https://github.com/your-username/esp32-nfc-cloud-access-control
- 问题反馈：https://github.com/your-username/esp32-nfc-cloud-access-control/issues
- 邮箱：your-email@example.com

## 致谢

- [Adafruit PN532 Library](https://github.com/adafruit/Adafruit-PN532)
- [ESP32 Arduino Core](https://github.com/espressif/arduino-esp32)
- [Express.js](https://expressjs.com/)

## 更新日志

### v1.0.0 (2024-01-15)

- 初始版本发布
- 实现核心功能：NFC读卡、云端验证、离线缓存
- 完成Web管理界面
- 支持SQLite和PostgreSQL数据库
- 提供Docker部署方案
