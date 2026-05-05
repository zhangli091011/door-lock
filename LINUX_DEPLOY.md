# Linux 生产部署指南

本指南介绍如何在Linux服务器上部署ESP32 NFC云门禁系统（不使用Nginx）。

## 系统要求

- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **Node.js**: 16.x 或更高版本
- **内存**: 至少 1GB RAM
- **磁盘**: 至少 2GB 可用空间
- **网络**: 开放端口 3000 (API) 和 8080 (Web)

## 部署架构

```
┌─────────────────────────────────────────┐
│         Linux 服务器                     │
│                                          │
│  ┌────────────────┐  ┌────────────────┐ │
│  │  Backend API   │  │  Web Admin     │ │
│  │  端口: 3000    │  │  端口: 8080    │ │
│  │  (Node.js)     │  │  (Node.js)     │ │
│  └────────────────┘  └────────────────┘ │
│           │                   │          │
│           └───────┬───────────┘          │
│                   │                      │
│         ┌─────────▼─────────┐            │
│         │   SQLite 数据库   │            │
│         └───────────────────┘            │
└─────────────────────────────────────────┘
```

## 快速部署步骤

### 1. 安装 Node.js

#### Ubuntu/Debian:
```bash
# 安装 Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### CentOS/RHEL:
```bash
# 安装 Node.js 18.x LTS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 克隆项目

```bash
# 克隆项目到服务器
cd /opt
sudo git clone https://github.com/zhangli091011/door-lock.git
cd door-lock

# 设置权限
sudo chown -R $USER:$USER /opt/door-lock
```

### 3. 配置后端服务

```bash
# 进入后端目录
cd /opt/door-lock/server

# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env

# 编辑配置文件
nano .env
```

**配置 .env 文件**:
```env
# 数据库配置
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/access_control.db

# 服务器配置
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# JWT配置（必须修改为随机字符串）
JWT_SECRET=your_random_secret_key_at_least_32_characters_long_change_this
JWT_EXPIRES_IN=24h

# CORS配置（添加你的域名或IP）
ALLOWED_ORIGINS=http://your-server-ip:8080,http://localhost:8080

# 速率限制
RATE_LIMIT_DEVICE=60
RATE_LIMIT_IP=100

# 日志级别
LOG_LEVEL=info
```

```bash
# 创建数据目录
mkdir -p data

# 编译 TypeScript
npm run build

# 初始化数据库
npm run db:init
```

### 4. 配置 Web Admin 服务

```bash
# 进入 web-admin 目录
cd /opt/door-lock/web-admin

# 安装依赖
npm install

# 编辑 API 配置
nano js/api.js
```

**修改 api.js 中的 API 地址**:
```javascript
const API_CONFIG = {
    baseURL: (() => {
        const hostname = window.location.hostname;
        
        // 本地开发环境
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
        
        // 生产环境：使用服务器IP或域名
        return 'http://your-server-ip:3000/api';  // 修改这里
    })(),
    timeout: 10000,
};
```

### 5. 使用 PM2 管理进程（推荐）

PM2 是一个生产级的 Node.js 进程管理器，支持自动重启、日志管理等功能。

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 启动后端服务
cd /opt/door-lock/server
pm2 start npm --name "nfc-backend" -- start

# 启动 Web Admin 服务
cd /opt/door-lock/web-admin
pm2 start server.js --name "nfc-web-admin"

# 查看运行状态
pm2 status

# 查看日志
pm2 logs

# 设置开机自启动
pm2 startup
pm2 save
```

**PM2 常用命令**:
```bash
# 查看所有进程
pm2 list

# 查看特定进程日志
pm2 logs nfc-backend
pm2 logs nfc-web-admin

# 重启服务
pm2 restart nfc-backend
pm2 restart nfc-web-admin

# 停止服务
pm2 stop nfc-backend
pm2 stop nfc-web-admin

# 删除进程
pm2 delete nfc-backend
pm2 delete nfc-web-admin

# 监控资源使用
pm2 monit
```

### 6. 配置防火墙

#### Ubuntu/Debian (UFW):
```bash
# 启用防火墙
sudo ufw enable

# 允许 SSH
sudo ufw allow 22/tcp

# 允许 API 端口
sudo ufw allow 3000/tcp

# 允许 Web Admin 端口
sudo ufw allow 8080/tcp

# 查看状态
sudo ufw status
```

#### CentOS/RHEL (firewalld):
```bash
# 启动防火墙
sudo systemctl start firewalld
sudo systemctl enable firewalld

# 允许端口
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp

# 重载配置
sudo firewall-cmd --reload

# 查看状态
sudo firewall-cmd --list-all
```

### 7. 访问系统

打开浏览器访问：
- **Web 管理界面**: `http://your-server-ip:8080`
- **API 健康检查**: `http://your-server-ip:3000/health`

**默认登录凭据**:
- 用户名: `admin`
- 密码: `admin123`

⚠️ **首次登录后请立即修改密码！**

## 使用 systemd 管理服务（替代方案）

如果不想使用 PM2，可以使用 systemd 创建系统服务。

### 创建后端服务

```bash
sudo nano /etc/systemd/system/nfc-backend.service
```

```ini
[Unit]
Description=NFC Access Control Backend API
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/opt/door-lock/server
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=nfc-backend
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 创建 Web Admin 服务

```bash
sudo nano /etc/systemd/system/nfc-web-admin.service
```

```ini
[Unit]
Description=NFC Access Control Web Admin
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/opt/door-lock/web-admin
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=nfc-web-admin

[Install]
WantedBy=multi-user.target
```

### 启动服务

```bash
# 重载 systemd 配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start nfc-backend
sudo systemctl start nfc-web-admin

# 设置开机自启动
sudo systemctl enable nfc-backend
sudo systemctl enable nfc-web-admin

# 查看状态
sudo systemctl status nfc-backend
sudo systemctl status nfc-web-admin

# 查看日志
sudo journalctl -u nfc-backend -f
sudo journalctl -u nfc-web-admin -f
```

## 更新部署

```bash
# 停止服务
pm2 stop nfc-backend nfc-web-admin

# 或使用 systemd
# sudo systemctl stop nfc-backend nfc-web-admin

# 拉取最新代码
cd /opt/door-lock
git pull

# 更新后端
cd server
npm install
npm run build

# 更新前端
cd ../web-admin
npm install

# 重启服务
pm2 restart nfc-backend nfc-web-admin

# 或使用 systemd
# sudo systemctl restart nfc-backend nfc-web-admin
```

## 数据备份

### 自动备份脚本

创建备份脚本：

```bash
sudo nano /opt/door-lock/backup.sh
```

```bash
#!/bin/bash
# 数据库备份脚本

BACKUP_DIR="/opt/door-lock/backups"
DB_PATH="/opt/door-lock/server/data/access_control.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.db"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp $DB_PATH $BACKUP_FILE

# 压缩备份
gzip $BACKUP_FILE

# 删除30天前的备份
find $BACKUP_DIR -name "backup_*.db.gz" -mtime +30 -delete

echo "备份完成: $BACKUP_FILE.gz"
```

```bash
# 设置执行权限
chmod +x /opt/door-lock/backup.sh

# 添加到 crontab（每天凌晨2点备份）
crontab -e
```

添加以下行：
```
0 2 * * * /opt/door-lock/backup.sh >> /var/log/nfc-backup.log 2>&1
```

### 手动备份

```bash
# 备份数据库
cp /opt/door-lock/server/data/access_control.db ~/backup_$(date +%Y%m%d).db

# 备份配置文件
cp /opt/door-lock/server/.env ~/backup_env_$(date +%Y%m%d)
```

## 监控和日志

### 查看实时日志

```bash
# PM2 日志
pm2 logs nfc-backend --lines 100
pm2 logs nfc-web-admin --lines 100

# systemd 日志
sudo journalctl -u nfc-backend -f
sudo journalctl -u nfc-web-admin -f

# 应用日志
tail -f /opt/door-lock/server/logs/combined.log
tail -f /opt/door-lock/server/logs/error.log
```

### 性能监控

```bash
# PM2 监控
pm2 monit

# 系统资源
htop
```

## 故障排查

### 问题1: 服务无法启动

```bash
# 检查端口占用
sudo netstat -tulpn | grep 3000
sudo netstat -tulpn | grep 8080

# 检查日志
pm2 logs nfc-backend --err
pm2 logs nfc-web-admin --err

# 检查权限
ls -la /opt/door-lock/server/data
```

### 问题2: 无法连接数据库

```bash
# 检查数据库文件
ls -la /opt/door-lock/server/data/access_control.db

# 重新初始化数据库
cd /opt/door-lock/server
npm run db:init
```

### 问题3: Web 界面无法访问 API

```bash
# 检查 CORS 配置
cat /opt/door-lock/server/.env | grep ALLOWED_ORIGINS

# 检查防火墙
sudo ufw status
sudo firewall-cmd --list-all

# 测试 API 连接
curl http://localhost:3000/health
```

### 问题4: 内存不足

```bash
# 查看内存使用
free -h

# 限制 Node.js 内存使用
pm2 start npm --name "nfc-backend" -- start --max-memory-restart 500M
```

## 安全加固

### 1. 修改默认密码

首次登录后立即修改管理员密码。

### 2. 使用强 JWT 密钥

```bash
# 生成随机密钥
openssl rand -base64 32

# 更新 .env 文件
nano /opt/door-lock/server/.env
```

### 3. 限制 SSH 访问

```bash
# 编辑 SSH 配置
sudo nano /etc/ssh/sshd_config

# 禁用 root 登录
PermitRootLogin no

# 使用密钥认证
PasswordAuthentication no

# 重启 SSH
sudo systemctl restart sshd
```

### 4. 配置 fail2ban

```bash
# 安装 fail2ban
sudo apt-get install fail2ban  # Ubuntu/Debian
sudo yum install fail2ban      # CentOS/RHEL

# 启动服务
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 5. 定期更新系统

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get upgrade

# CentOS/RHEL
sudo yum update
```

## 性能优化

### 1. 启用 Node.js 集群模式

编辑 PM2 配置文件：

```bash
nano /opt/door-lock/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'nfc-backend',
      cwd: '/opt/door-lock/server',
      script: 'npm',
      args: 'start',
      instances: 2,  // 使用2个实例
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'nfc-web-admin',
      cwd: '/opt/door-lock/web-admin',
      script: 'server.js',
      instances: 1,
      max_memory_restart: '200M'
    }
  ]
};
```

```bash
# 使用配置文件启动
pm2 start ecosystem.config.js
pm2 save
```

### 2. 数据库优化

如果数据量大，建议切换到 PostgreSQL：

```bash
# 安装 PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# 创建数据库
sudo -u postgres psql
CREATE DATABASE access_control;
CREATE USER nfc_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE access_control TO nfc_user;
\q

# 更新 .env 配置
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://nfc_user:your_password@localhost:5432/access_control
```

## 使用域名访问（可选）

### 1. 配置 DNS

在域名提供商处添加 A 记录：
```
api.yourdomain.com  -> your-server-ip
web.yourdomain.com  -> your-server-ip
```

### 2. 更新配置

```bash
# 更新后端 CORS
nano /opt/door-lock/server/.env
ALLOWED_ORIGINS=http://web.yourdomain.com:8080

# 更新前端 API 地址
nano /opt/door-lock/web-admin/js/api.js
return 'http://api.yourdomain.com:3000/api';
```

### 3. 配置 HTTPS（推荐）

使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
sudo apt-get install certbot

# 获取证书（需要停止服务）
pm2 stop all
sudo certbot certonly --standalone -d api.yourdomain.com -d web.yourdomain.com

# 更新后端配置
nano /opt/door-lock/server/.env
SSL_CERT_PATH=/etc/letsencrypt/live/api.yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/api.yourdomain.com/privkey.pem

# 重启服务
pm2 restart all
```

## 快速启动脚本

项目根目录提供了快速启动脚本：

```bash
# 启动后端
./start-backend.sh

# 启动前端
./start-web-admin.sh

# 设置执行权限
chmod +x start-backend.sh start-web-admin.sh
```

## 总结

完成以上步骤后，你的系统应该已经成功部署并运行：

- ✅ 后端 API 运行在 `http://your-server-ip:3000`
- ✅ Web 管理界面运行在 `http://your-server-ip:8080`
- ✅ 使用 PM2 管理进程，支持自动重启
- ✅ 配置了防火墙规则
- ✅ 设置了自动备份
- ✅ 配置了开机自启动

## 技术支持

如有问题，请查看：
- 项目文档: `/opt/door-lock/docs/`
- 日志文件: `/opt/door-lock/server/logs/`
- GitHub Issues: https://github.com/zhangli091011/door-lock/issues
