# ESP32 NFC 云门禁系统 - 部署指南

本文档提供ESP32 NFC云门禁系统的完整部署指南，包括本地部署、云服务器部署和Docker容器化部署三种方式。

## 目录

- [系统要求](#系统要求)
- [部署方式选择](#部署方式选择)
- [方式1：本地部署](#方式1本地部署)
- [方式2：云服务器部署](#方式2云服务器部署)
- [方式3：Docker部署](#方式3docker部署)
- [配置说明](#配置说明)
- [常见问题](#常见问题)
- [维护和备份](#维护和备份)

---

## 系统要求

### 硬件要求

**最低配置**：
- CPU: 1核
- 内存: 1GB RAM
- 存储: 10GB
- 网络: 1Mbps带宽

**推荐配置**：
- CPU: 2核
- 内存: 2GB RAM
- 存储: 20GB SSD
- 网络: 5Mbps带宽

### 软件要求

- **操作系统**: Ubuntu 20.04+, Debian 11+, CentOS 8+, macOS, Windows 10+
- **Node.js**: v16.0.0 或更高版本
- **数据库**: SQLite 3.x（本地）或 PostgreSQL 12+（生产）
- **Nginx**: 1.18+ (可选，用于反向代理)
- **Docker**: 20.10+ (可选，用于容器化部署)

---

## 部署方式选择

| 部署方式 | 适用场景 | 优点 | 缺点 |
|---------|---------|------|------|
| **本地部署** | 家庭、小型办公室 | 简单快速、成本低 | 需要自行维护、无法远程访问 |
| **云服务器部署** | 生产环境、多地点 | 稳定可靠、远程访问 | 需要购买服务器、配置复杂 |
| **Docker部署** | 开发测试、快速部署 | 环境隔离、易于迁移 | 需要学习Docker |

---

## 方式1：本地部署

适用于家庭或小型办公室，使用SQLite数据库，部署在本地网络。

### 1.1 准备工作

```bash
# 检查Node.js版本
node -v  # 应该 >= v16.0.0

# 如果未安装Node.js，请访问 https://nodejs.org/ 下载安装
```

### 1.2 克隆代码

```bash
# 克隆仓库
git clone https://github.com/your-repo/esp32-nfc-access-control.git
cd esp32-nfc-access-control
```

### 1.3 使用自动部署脚本

```bash
# 赋予执行权限
chmod +x deploy-local.sh

# 运行部署脚本
./deploy-local.sh
```

脚本会自动完成以下操作：
1. 检查Node.js环境
2. 安装依赖包
3. 配置环境变量
4. 初始化数据库
5. 编译TypeScript代码
6. 启动服务

### 1.4 手动部署（可选）

如果自动脚本失败，可以手动执行以下步骤：

```bash
# 1. 进入服务器目录
cd server

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑.env文件，修改必要的配置

# 4. 创建目录
mkdir -p data logs

# 5. 初始化数据库
npm run db:init

# 6. 编译代码
npm run build

# 7. 启动服务
npm start
```

### 1.5 访问系统

- **后端API**: http://localhost:3000
- **Web管理界面**: http://localhost:3000 (如果配置了静态文件服务)
- **默认账户**: 
  - 用户名: `admin`
  - 密码: `admin123`
  - ⚠️ **请立即修改默认密码！**

### 1.6 配置开机自启动（可选）

使用PM2管理进程：

```bash
# 安装PM2
npm install -g pm2

# 启动应用
cd server
pm2 start dist/server.js --name nfc-access-api

# 保存PM2配置
pm2 save

# 配置开机自启动
pm2 startup
# 按照提示执行命令
```

---

## 方式2：云服务器部署

适用于生产环境，使用PostgreSQL数据库，配置SSL证书。

### 2.1 准备云服务器

推荐云服务商：
- AWS EC2 / Lightsail
- 阿里云 ECS
- 腾讯云 CVM
- DigitalOcean Droplet

**服务器配置**：
- 操作系统: Ubuntu 22.04 LTS
- 配置: 1核2GB（最低）
- 开放端口: 22 (SSH), 80 (HTTP), 443 (HTTPS)

### 2.2 配置域名解析

在域名服务商处添加A记录，将域名指向服务器IP：

```
类型: A
主机记录: access (或 @)
记录值: 你的服务器IP
TTL: 600
```

### 2.3 使用自动部署脚本

```bash
# SSH连接到服务器
ssh root@your-server-ip

# 下载部署脚本
wget https://raw.githubusercontent.com/your-repo/esp32-nfc-access-control/main/deploy-cloud.sh

# 赋予执行权限
chmod +x deploy-cloud.sh

# 运行部署脚本
./deploy-cloud.sh
```

脚本会提示输入：
- 域名（例如：access.yourdomain.com）
- 数据库密码
- JWT密钥（可留空自动生成）

脚本会自动完成：
1. 更新系统
2. 安装Node.js、PostgreSQL、Nginx
3. 配置数据库
4. 部署应用
5. 配置Nginx反向代理
6. 申请SSL证书（Let's Encrypt）
7. 配置防火墙

### 2.4 手动部署（可选）

详细的手动部署步骤请参考 `deploy-cloud.sh` 脚本内容。

### 2.5 访问系统

- **HTTPS访问**: https://access.yourdomain.com
- **默认账户**: 
  - 用户名: `admin`
  - 密码: `admin123`
  - ⚠️ **请立即修改默认密码！**

### 2.6 SSL证书续期

Let's Encrypt证书有效期90天，系统会自动续期。手动续期命令：

```bash
certbot renew
systemctl reload nginx
```

---

## 方式3：Docker部署

适用于开发测试环境或需要快速部署的场景。

### 3.1 安装Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 3.2 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker .env

# 编辑.env文件
nano .env
```

**必须修改的配置**：
- `DB_PASSWORD`: 数据库密码
- `JWT_SECRET`: JWT密钥
- `ALLOWED_ORIGINS`: 允许的前端域名

### 3.3 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 3.4 初始化数据库

```bash
# 进入API容器
docker-compose exec api sh

# 运行数据库初始化
npm run db:init

# 退出容器
exit
```

### 3.5 访问系统

- **HTTP访问**: http://localhost:80
- **HTTPS访问**: https://localhost:443 (需要配置SSL证书)
- **API直接访问**: http://localhost:3000
- **数据库管理**: http://localhost:8081 (Adminer，仅开发环境)

### 3.6 开发环境部署

使用开发环境配置，支持热重载：

```bash
# 使用开发环境配置
docker-compose -f docker-compose.dev.yml up -d

# 访问
# - Web界面: http://localhost:8080
# - API: http://localhost:3000
# - 数据库管理: http://localhost:8081
```

### 3.7 停止和清理

```bash
# 停止服务
docker-compose down

# 停止并删除数据卷（⚠️ 会删除所有数据）
docker-compose down -v

# 重新构建镜像
docker-compose build --no-cache
```

---

## 配置说明

### 环境变量配置

主要环境变量说明：

| 变量名 | 说明 | 默认值 | 必填 |
|-------|------|--------|------|
| `DATABASE_TYPE` | 数据库类型 | `sqlite` | 是 |
| `DATABASE_PATH` | SQLite数据库路径 | `./data/access_control.db` | SQLite时必填 |
| `DATABASE_URL` | PostgreSQL连接URL | - | PostgreSQL时必填 |
| `PORT` | 服务器端口 | `3000` | 否 |
| `NODE_ENV` | 运行环境 | `development` | 是 |
| `JWT_SECRET` | JWT密钥 | - | 是 |
| `JWT_EXPIRES_IN` | JWT有效期 | `24h` | 否 |
| `ALLOWED_ORIGINS` | 允许的CORS域名 | - | 是 |
| `LOG_LEVEL` | 日志级别 | `info` | 否 |

完整配置请参考 `.env.example` 文件。

### 数据库配置

#### SQLite（本地部署）

```env
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/access_control.db
```

#### PostgreSQL（生产环境）

```env
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://用户名:密码@主机:端口/数据库名
```

示例：
```env
DATABASE_URL=postgresql://access_user:mypassword@localhost:5432/access_control
```

### Nginx配置

Nginx配置文件位于 `nginx.conf`，主要配置项：

- **反向代理**: 将 `/api` 路径代理到后端服务
- **静态文件**: 将 `/` 路径指向Web管理界面
- **SSL证书**: 配置HTTPS证书路径
- **限流**: 配置API请求频率限制
- **安全头部**: 配置安全相关的HTTP头部

修改配置后重启Nginx：

```bash
# 测试配置
nginx -t

# 重启Nginx
systemctl restart nginx
```

---

## 常见问题

### Q1: 端口被占用

**错误信息**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决方法**:
```bash
# 查找占用端口的进程
lsof -i :3000
# 或
netstat -tulpn | grep 3000

# 杀死进程
kill -9 <PID>

# 或修改.env文件中的PORT配置
```

### Q2: 数据库连接失败

**错误信息**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**解决方法**:
1. 检查PostgreSQL是否运行: `systemctl status postgresql`
2. 检查数据库连接配置是否正确
3. 检查数据库用户权限
4. 检查防火墙设置

### Q3: SSL证书申请失败

**错误信息**: `Failed to obtain certificate`

**解决方法**:
1. 确认域名已正确解析到服务器IP
2. 确认80端口可以访问
3. 检查防火墙是否开放80端口
4. 等待DNS解析生效（可能需要几分钟到几小时）

### Q4: Docker容器无法启动

**解决方法**:
```bash
# 查看容器日志
docker-compose logs api

# 检查容器状态
docker-compose ps

# 重新构建镜像
docker-compose build --no-cache

# 清理并重启
docker-compose down -v
docker-compose up -d
```

### Q5: 无法访问Web管理界面

**解决方法**:
1. 检查Nginx是否运行: `systemctl status nginx`
2. 检查Nginx配置: `nginx -t`
3. 检查静态文件路径是否正确
4. 查看Nginx错误日志: `tail -f /var/log/nginx/error.log`

---

## 维护和备份

### 日志管理

```bash
# 查看应用日志
tail -f server/logs/app.log

# 查看PM2日志
pm2 logs nfc-access-api

# 查看Nginx日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 查看Docker日志
docker-compose logs -f api
```

### 数据库备份

#### SQLite备份

```bash
# 备份数据库
cp server/data/access_control.db server/data/access_control.db.backup

# 或使用sqlite3命令
sqlite3 server/data/access_control.db ".backup 'backup.db'"
```

#### PostgreSQL备份

```bash
# 备份数据库
pg_dump -U access_user access_control > backup.sql

# 恢复数据库
psql -U access_user access_control < backup.sql

# 自动备份脚本（添加到crontab）
0 2 * * * pg_dump -U access_user access_control > /backup/access_control_$(date +\%Y\%m\%d).sql
```

### 系统更新

```bash
# 拉取最新代码
git pull

# 安装依赖
cd server
npm install

# 编译代码
npm run build

# 重启服务
pm2 restart nfc-access-api

# 或使用Docker
docker-compose pull
docker-compose up -d --build
```

### 性能监控

```bash
# 查看系统资源
htop

# 查看PM2进程
pm2 monit

# 查看Docker资源使用
docker stats
```

---

## 安全建议

1. **修改默认密码**: 立即修改默认管理员密码
2. **使用强密码**: 数据库密码、JWT密钥使用强随机字符串
3. **启用HTTPS**: 生产环境必须使用HTTPS
4. **配置防火墙**: 只开放必要的端口（22, 80, 443）
5. **定期备份**: 每天自动备份数据库
6. **定期更新**: 及时更新系统和依赖包
7. **监控日志**: 定期检查访问日志和错误日志
8. **限制访问**: 使用IP白名单限制管理界面访问

---

## 技术支持

如有问题，请：
1. 查看本文档的常见问题部分
2. 查看项目GitHub Issues
3. 联系技术支持团队

---

## 附录

### A. 端口说明

| 端口 | 服务 | 说明 |
|-----|------|------|
| 3000 | 后端API | Node.js应用端口 |
| 80 | HTTP | Nginx HTTP端口 |
| 443 | HTTPS | Nginx HTTPS端口 |
| 5432 | PostgreSQL | 数据库端口（仅本地访问） |
| 6379 | Redis | 缓存端口（可选） |
| 8080 | Web界面 | 开发环境Web端口 |
| 8081 | Adminer | 数据库管理工具（开发环境） |

### B. 目录结构

```
esp32-nfc-access-control/
├── server/                 # 后端服务
│   ├── src/               # 源代码
│   ├── dist/              # 编译后的代码
│   ├── data/              # SQLite数据库
│   ├── logs/              # 日志文件
│   └── .env               # 环境变量
├── web-admin/             # Web管理界面
├── esp32-firmware/        # ESP32固件
├── deploy-local.sh        # 本地部署脚本
├── deploy-cloud.sh        # 云服务器部署脚本
├── docker-compose.yml     # Docker生产环境配置
├── docker-compose.dev.yml # Docker开发环境配置
├── Dockerfile             # Docker镜像配置
├── nginx.conf             # Nginx配置
└── .env.example           # 环境变量示例
```

### C. 常用命令速查

```bash
# 本地部署
./deploy-local.sh

# 云服务器部署
./deploy-cloud.sh

# Docker部署
docker-compose up -d

# 查看日志
pm2 logs nfc-access-api
docker-compose logs -f

# 重启服务
pm2 restart nfc-access-api
docker-compose restart

# 备份数据库
pg_dump access_control > backup.sql

# 更新SSL证书
certbot renew
```

---

**版本**: 1.0.0  
**更新日期**: 2024-01-15  
**维护者**: ESP32 NFC Access Control Team
