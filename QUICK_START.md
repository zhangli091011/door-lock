# 快速开始指南

这是一个快速开始指南，帮助你在5分钟内了解项目并开始开发。

## 🚀 5分钟快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/esp32-nfc-cloud-access-control.git
cd esp32-nfc-cloud-access-control
```

### 2. 安装后端依赖

```bash
cd server
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑.env文件，至少修改JWT_SECRET
```

### 4. 初始化数据库（Task 2完成后可用）

```bash
npm run db:init
```

### 5. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动。

## 📁 项目结构速览

```
├── server/           # 后端服务（TypeScript）
├── esp32-firmware/   # ESP32固件（Arduino C++）
├── web-admin/        # Web管理界面（HTML/JS）
└── docs/             # 文档
```

## 🛠️ 常用命令

### 后端开发

```bash
cd server

# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 运行测试
npm test

# 代码检查
npm run lint

# 代码格式化
npm run format
```

### ESP32固件

```bash
cd esp32-firmware

# 复制配置模板
cp config.h.example config.h

# 编辑配置文件
nano config.h

# 使用Arduino IDE上传固件
```

### Web前端

```bash
cd web-admin

# 启动开发服务器
python3 -m http.server 8080

# 或使用Node.js
npx http-server -p 8080
```

## 📝 开发流程

### 1. 选择任务

查看 `.kiro/specs/esp32-nfc-cloud-access-control/tasks.md` 选择要实现的任务。

### 2. 创建分支

```bash
git checkout -b feature/task-name
```

### 3. 实现功能

- 编写代码
- 添加测试
- 更新文档

### 4. 测试

```bash
npm test
npm run lint
```

### 5. 提交

```bash
git add .
git commit -m "feat: implement task description"
git push origin feature/task-name
```

### 6. 创建Pull Request

在GitHub上创建PR，等待代码审查。

## 🔧 配置说明

### 后端环境变量（.env）

```env
# 数据库
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/access_control.db

# 服务器
PORT=3000
NODE_ENV=development

# JWT（必须修改）
JWT_SECRET=your_random_secret_key_min_32_chars

# CORS
ALLOWED_ORIGINS=http://localhost:8080
```

### ESP32配置（config.h）

```cpp
// WiFi
#define WIFI_SSID "Your_WiFi_SSID"
#define WIFI_PASSWORD "Your_WiFi_Password"

// API
#define API_BASE_URL "http://192.168.1.100:3000/api"
#define DEVICE_ID "door_1"
#define API_KEY "your_device_api_key"
#define SECRET_KEY "your_device_secret_key"
```

## 📚 文档

- **README.md** - 项目概述和功能介绍
- **SETUP.md** - 详细的设置指南
- **CONTRIBUTING.md** - 贡献指南
- **PROJECT_STATUS.md** - 项目进度
- **.kiro/specs/** - 完整的规格文档

## 🐛 调试技巧

### 后端调试

```bash
# 查看详细日志
DEBUG=* npm run dev

# 使用VS Code调试
# 在.vscode/launch.json中配置调试器
```

### ESP32调试

```bash
# 打开串口监视器
# Arduino IDE: 工具 > 串口监视器
# 波特率: 115200
```

### 前端调试

```bash
# 使用浏览器开发者工具
# F12 或 右键 > 检查
```

## 🔍 常见问题

### Q: npm install失败？

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Q: TypeScript编译错误？

```bash
npm run build
# 查看错误信息并修复
```

### Q: 测试失败？

```bash
npm test -- --verbose
# 查看详细的测试输出
```

## 📞 获取帮助

- 查看 [SETUP.md](SETUP.md) 详细设置指南
- 查看 [故障排查](docs/troubleshooting.md)（Task 14完成后可用）
- 提交 [GitHub Issue](https://github.com/your-username/esp32-nfc-cloud-access-control/issues)

## 🎯 下一步

1. ✅ 完成环境设置
2. 📖 阅读规格文档（.kiro/specs/）
3. 🔨 开始实现Task 2（数据库层）
4. ✅ 运行测试确保质量
5. 📝 更新文档

祝你开发愉快！🎉
