# 项目设置指南

本文档提供ESP32 NFC云门禁系统的详细设置步骤。

## 目录

1. [环境准备](#环境准备)
2. [后端服务设置](#后端服务设置)
3. [ESP32固件设置](#esp32固件设置)
4. [Web管理界面设置](#web管理界面设置)
5. [验证安装](#验证安装)

## 环境准备

### 系统要求

- **操作系统**：Linux、macOS 或 Windows
- **Node.js**：16.x 或更高版本
- **npm**：8.x 或更高版本
- **Arduino IDE**：1.8.x 或更高版本（或 PlatformIO）
- **数据库**：SQLite（默认）或 PostgreSQL

### 安装Node.js

#### Linux/macOS

```bash
# 使用nvm安装（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc  # 或 ~/.zshrc
nvm install 18
nvm use 18
```

#### Windows

从 [Node.js官网](https://nodejs.org/) 下载并安装LTS版本。

### 安装Arduino IDE

从 [Arduino官网](https://www.arduino.cc/en/software) 下载并安装Arduino IDE。

## 后端服务设置

### 1. 进入后端目录

```bash
cd server
```

### 2. 安装依赖

```bash
npm install
```

如果遇到权限问题（Linux/macOS）：

```bash
sudo npm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件
nano .env  # 或使用你喜欢的编辑器
```

**必须修改的配置项**：

```env
# JWT密钥（必须修改为强随机字符串）
JWT_SECRET=your_random_secret_key_min_32_chars_change_this_in_production

# 如果使用PostgreSQL，取消注释并配置
# DATABASE_TYPE=postgresql
# DATABASE_URL=postgresql://user:password@localhost:5432/access_control
```

**生成强随机密钥**：

```bash
# Linux/macOS
openssl rand -base64 32

# 或使用Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. 初始化数据库

```bash
npm run db:init
```

这将创建数据库表并插入默认管理员账户：
- 用户名：`admin`
- 密码：`admin123`

**⚠️ 重要：首次登录后请立即修改默认密码！**

### 5. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 6. 验证后端服务

打开浏览器访问：`http://localhost:3000/api/status`

如果看到JSON响应，说明后端服务正常运行。

## ESP32固件设置

### 1. 安装ESP32开发板支持

在Arduino IDE中：

1. 打开 **文件 > 首选项**
2. 在"附加开发板管理器网址"中添加：
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. 打开 **工具 > 开发板 > 开发板管理器**
4. 搜索"ESP32"并安装"ESP32 by Espressif Systems"

### 2. 安装依赖库

在Arduino IDE中：

1. 打开 **工具 > 管理库**
2. 搜索并安装以下库：
   - **Adafruit PN532** (v1.3.0+)
   - **ArduinoJson** (v6.21.0+)

### 3. 配置固件

```bash
cd esp32-firmware

# 复制配置模板
cp config.h.example config.h

# 编辑配置文件
nano config.h
```

**必须修改的配置项**：

```cpp
// WiFi配置
#define WIFI_SSID "Your_WiFi_SSID"
#define WIFI_PASSWORD "Your_WiFi_Password"

// API配置
#define API_BASE_URL "http://192.168.1.100:3000/api"  // 替换为你的服务器IP
#define DEVICE_ID "door_1"
#define API_KEY "your_device_api_key"      // 从Web管理界面注册设备后获得
#define SECRET_KEY "your_device_secret_key" // 从Web管理界面注册设备后获得
```

### 4. 硬件连接

按照以下接线图连接硬件：

| 组件 | ESP32引脚 | 说明 |
|------|-----------|------|
| PN532 SDA | GPIO8 | I2C数据线 |
| PN532 SCL | GPIO9 | I2C时钟线 |
| PN532 VCC | 5V | 电源 |
| PN532 GND | GND | 地线 |
| 继电器 IN | GPIO4 | 控制信号 |
| 继电器 VCC | 5V | 电源 |
| 继电器 GND | GND | 地线 |
| 蜂鸣器 + | GPIO5 | 正极 |
| 蜂鸣器 - | GND | 负极 |
| 按钮 | GPIO6 | 一端连接，另一端接GND |

**磁力锁接线**：
- 继电器 COM → 12V电源正极
- 继电器 NC → 磁力锁正极
- 磁力锁负极 → 12V电源负极

### 5. 上传固件

1. 在Arduino IDE中打开 `esp32-firmware.ino`
2. 选择开发板：**工具 > 开发板 > ESP32 Arduino > ESP32-S3 Dev Module**
3. 选择端口：**工具 > 端口 > COM3**（Windows）或 **/dev/ttyUSB0**（Linux）
4. 点击"上传"按钮

### 6. 验证固件

1. 打开串口监视器：**工具 > 串口监视器**
2. 设置波特率为 **115200**
3. 查看输出，应该看到：
   ```
   WiFi connecting...
   WiFi connected
   IP address: 192.168.1.xxx
   PN532 initialized
   System ready
   ```

## Web管理界面设置

### 方法1：使用Python HTTP服务器（开发环境）

```bash
cd web-admin
python3 -m http.server 8080
```

访问：`http://localhost:8080`

### 方法2：使用Nginx（生产环境）

#### Linux

```bash
# 安装Nginx
sudo apt update
sudo apt install nginx

# 复制Web文件到Nginx目录
sudo cp -r web-admin/* /var/www/html/

# 重启Nginx
sudo systemctl restart nginx
```

访问：`http://your-server-ip`

#### macOS

```bash
# 使用Homebrew安装Nginx
brew install nginx

# 复制Web文件
cp -r web-admin/* /usr/local/var/www/

# 启动Nginx
brew services start nginx
```

访问：`http://localhost:8080`

### 方法3：使用Node.js静态服务器

```bash
# 安装http-server
npm install -g http-server

# 启动服务器
cd web-admin
http-server -p 8080
```

访问：`http://localhost:8080`

## 验证安装

### 1. 登录Web管理界面

1. 打开浏览器访问Web管理界面
2. 使用默认账户登录：
   - 用户名：`admin`
   - 密码：`admin123`
3. **立即修改默认密码！**

### 2. 注册ESP32设备

1. 在Web管理界面中，进入"设备管理"页面
2. 点击"添加设备"
3. 填写设备信息：
   - 设备ID：`door_1`
   - 设备名称：`前门门禁`
   - 位置：`一楼大厅`
   - MAC地址：ESP32的MAC地址（从串口监视器获取）
4. 点击"保存"
5. **记录生成的API Key和Secret Key**
6. 将API Key和Secret Key填入ESP32的`config.h`文件
7. 重新上传固件

### 3. 添加测试卡片

1. 在Web管理界面中，进入"卡片管理"页面
2. 点击"添加卡片"
3. 填写卡片信息：
   - UID：`04A1B2C3D4E5F6`（示例，使用你的实际卡片UID）
   - 姓名：`测试卡片`
   - 启用：勾选
   - 允许缓存：勾选
4. 点击"保存"

### 4. 测试刷卡

1. 将NFC卡片靠近PN532模块
2. 观察串口监视器输出
3. 应该看到：
   ```
   Card detected: 04A1B2C3D4E5F6
   Verifying with cloud...
   Access granted
   Unlocking door...
   ```
4. 继电器应该动作，蜂鸣器发出长鸣
5. 在Web管理界面的"访问日志"中应该能看到记录

### 5. 测试离线模式

1. 断开ESP32的WiFi连接（关闭路由器或修改WiFi密码）
2. 再次刷卡
3. 应该看到：
   ```
   Card detected: 04A1B2C3D4E5F6
   Network error, using cache...
   Access granted (cached)
   Unlocking door...
   ```
4. 蜂鸣器应该短鸣2次（离线模式提示）

## 常见问题

### Q1: npm install失败

**A**: 尝试清除缓存并重新安装：

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Q2: ESP32无法连接WiFi

**A**: 检查以下几点：
- WiFi SSID和密码是否正确
- WiFi信号强度是否足够
- 路由器是否限制设备连接
- ESP32是否支持你的WiFi频段（2.4GHz）

### Q3: PN532无法初始化

**A**: 检查以下几点：
- I2C接线是否正确（SDA/SCL）
- PN532供电是否正常（5V）
- PN532模块是否设置为I2C模式（拨码开关）
- 尝试更换PN532模块

### Q4: API返回401错误

**A**: 检查以下几点：
- API Key是否正确
- 设备是否已注册且启用
- 时间戳是否正确（ESP32时间同步）
- 签名计算是否正确

### Q5: 数据库初始化失败

**A**: 检查以下几点：
- 数据库文件路径是否有写权限
- SQLite是否正确安装
- 如果使用PostgreSQL，检查连接字符串是否正确

## 下一步

安装完成后，你可以：

1. 阅读 [API文档](docs/api.md) 了解API接口
2. 阅读 [部署指南](docs/deploy-cloud.md) 了解生产环境部署
3. 阅读 [配置说明](docs/configuration.md) 了解高级配置选项
4. 阅读 [故障排查](docs/troubleshooting.md) 解决常见问题

## 获取帮助

如果遇到问题，可以：

1. 查看 [故障排查指南](docs/troubleshooting.md)
2. 在GitHub上提交Issue
3. 发送邮件至：your-email@example.com

祝你使用愉快！
