# 部署配置文件说明

本文档说明任务9.2创建的所有部署配置文件。

## 创建的文件列表

### 1. 环境变量配置

#### `.env.example` (根目录)
- **用途**: 环境变量配置模板，包含所有配置项和详细说明
- **位置**: 项目根目录
- **使用**: 复制为`.env`文件并修改相应值
- **包含配置**:
  - 数据库配置（SQLite/PostgreSQL）
  - 服务器配置（端口、主机）
  - JWT认证配置
  - CORS跨域配置
  - 速率限制配置
  - 日志配置
  - HTTPS/SSL配置
  - Redis缓存配置（可选）
  - 邮件通知配置（可选）
  - 系统配置（日志保留、设备离线判定等）
  - 安全配置（签名验证、密码强度等）

#### `.env.docker`
- **用途**: Docker环境专用的环境变量模板
- **位置**: 项目根目录
- **使用**: 用于docker-compose.yml，复制为`.env`
- **包含配置**:
  - 数据库密码
  - JWT密钥
  - CORS域名
  - Redis密码
  - 域名配置
  - 邮件配置

### 2. 部署脚本

#### `deploy-local.sh`
- **用途**: 本地部署自动化脚本
- **适用场景**: 家庭、小型办公室、开发环境
- **数据库**: SQLite
- **功能**:
  - 检查Node.js环境
  - 安装依赖包
  - 配置环境变量
  - 创建必要目录
  - 初始化数据库
  - 编译TypeScript代码
  - 启动服务
- **使用方法**:
  ```bash
  chmod +x deploy-local.sh
  ./deploy-local.sh
  ```

#### `deploy-cloud.sh`
- **用途**: 云服务器部署自动化脚本
- **适用场景**: 生产环境、云服务器
- **数据库**: PostgreSQL
- **功能**:
  - 更新系统软件包
  - 安装Node.js、PostgreSQL、Nginx
  - 配置PostgreSQL数据库
  - 部署应用代码
  - 配置环境变量
  - 初始化数据库
  - 配置Nginx反向代理
  - 申请Let's Encrypt SSL证书
  - 配置防火墙
  - 配置PM2进程管理
- **使用方法**:
  ```bash
  chmod +x deploy-cloud.sh
  sudo ./deploy-cloud.sh
  ```

#### `docker-quickstart.sh`
- **用途**: Docker快速启动脚本
- **功能**:
  - 检查Docker环境
  - 自动生成随机密码和密钥
  - 创建.env文件
  - 启动Docker服务
  - 初始化数据库
- **使用方法**:
  ```bash
  chmod +x docker-quickstart.sh
  ./docker-quickstart.sh
  ```

### 3. Docker配置

#### `Dockerfile`
- **用途**: 生产环境Docker镜像构建配置
- **特性**:
  - 多阶段构建（优化镜像大小）
  - 基于Node.js 18 Alpine
  - 非root用户运行
  - 健康检查配置
  - 使用tini作为init进程
- **构建命令**:
  ```bash
  docker build -t nfc-access-api .
  ```

#### `Dockerfile.dev`
- **用途**: 开发环境Docker镜像配置
- **特性**:
  - 包含开发工具
  - 支持热重载
  - 暴露调试端口（9229）
- **使用**: 配合docker-compose.dev.yml使用

#### `docker-compose.yml`
- **用途**: 生产环境Docker Compose配置
- **包含服务**:
  - `db`: PostgreSQL数据库
  - `api`: Node.js后端服务
  - `nginx`: Nginx反向代理
  - `redis`: Redis缓存（可选，使用--profile cache启动）
- **特性**:
  - 服务依赖管理
  - 健康检查
  - 数据卷持久化
  - 网络隔离
  - 资源限制
- **使用方法**:
  ```bash
  docker-compose up -d
  ```

#### `docker-compose.dev.yml`
- **用途**: 开发环境Docker Compose配置
- **包含服务**:
  - `db`: PostgreSQL开发数据库
  - `api`: 支持热重载的后端服务
  - `nginx`: Nginx反向代理
  - `redis`: Redis缓存
  - `adminer`: 数据库管理工具
- **特性**:
  - 源代码挂载（支持热重载）
  - 调试端口暴露
  - 详细日志输出
  - 数据库管理界面
- **使用方法**:
  ```bash
  docker-compose -f docker-compose.dev.yml up -d
  ```

#### `.dockerignore`
- **用途**: Docker构建时忽略的文件
- **包含**:
  - node_modules
  - 日志文件
  - 数据库文件
  - 测试文件
  - IDE配置
  - Git文件

### 4. Nginx配置

#### `nginx.conf`
- **用途**: 生产环境Nginx配置
- **功能**:
  - HTTP到HTTPS重定向
  - SSL/TLS配置
  - 反向代理到后端API
  - 静态文件服务（Web管理界面）
  - Gzip压缩
  - 安全头部配置
  - 限流配置
  - 健康检查端点
  - 错误页面配置
- **特性**:
  - 支持HTTP/2
  - OCSP Stapling
  - HSTS配置
  - WebSocket支持
  - 负载均衡配置（多实例）

#### `nginx.dev.conf`
- **用途**: 开发环境Nginx配置
- **特性**:
  - 简化配置
  - 禁用缓存
  - 更长的超时时间
  - 仅HTTP（无SSL）

### 5. 文档

#### `DEPLOYMENT.md`
- **用途**: 完整的部署指南
- **内容**:
  - 系统要求
  - 部署方式选择
  - 本地部署详细步骤
  - 云服务器部署详细步骤
  - Docker部署详细步骤
  - 配置说明
  - 常见问题解答
  - 维护和备份指南
  - 安全建议
  - 附录（端口说明、目录结构、命令速查）

#### `DOCKER.md`
- **用途**: Docker部署专项指南
- **内容**:
  - 快速开始
  - 服务说明
  - 常用命令
  - 开发环境配置
  - 生产环境部署
  - 性能优化
  - 监控和维护
  - 故障排查
  - 数据迁移
  - 安全建议
  - 高级配置

#### `DEPLOYMENT_SUMMARY.md` (本文件)
- **用途**: 部署配置文件说明和使用指南

## 部署方式对比

| 特性 | 本地部署 | 云服务器部署 | Docker部署 |
|-----|---------|------------|-----------|
| **难度** | 简单 | 中等 | 简单 |
| **数据库** | SQLite | PostgreSQL | PostgreSQL |
| **SSL** | 可选 | 必须 | 可选 |
| **适用场景** | 开发/小型 | 生产环境 | 开发/测试 |
| **成本** | 低 | 中 | 低 |
| **维护** | 手动 | 手动 | 自动化 |
| **扩展性** | 低 | 高 | 中 |

## 快速开始指南

### 方式1：本地部署（最简单）

```bash
# 1. 克隆代码
git clone <repository-url>
cd esp32-nfc-access-control

# 2. 运行部署脚本
chmod +x deploy-local.sh
./deploy-local.sh

# 3. 访问系统
# http://localhost:3000
```

### 方式2：Docker部署（推荐）

```bash
# 1. 克隆代码
git clone <repository-url>
cd esp32-nfc-access-control

# 2. 运行快速启动脚本
chmod +x docker-quickstart.sh
./docker-quickstart.sh

# 3. 访问系统
# http://localhost
```

### 方式3：云服务器部署（生产环境）

```bash
# 1. SSH连接到服务器
ssh root@your-server-ip

# 2. 下载并运行部署脚本
wget <script-url>/deploy-cloud.sh
chmod +x deploy-cloud.sh
./deploy-cloud.sh

# 3. 访问系统
# https://yourdomain.com
```

## 配置要点

### 必须修改的配置

1. **JWT_SECRET**: JWT密钥，至少32字符
   ```bash
   # 生成方法
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # 或
   openssl rand -hex 32
   ```

2. **DB_PASSWORD**: 数据库密码（生产环境）
   ```bash
   # 生成方法
   openssl rand -hex 16
   ```

3. **ALLOWED_ORIGINS**: 允许的前端域名
   ```env
   # 开发环境
   ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000
   
   # 生产环境
   ALLOWED_ORIGINS=https://yourdomain.com
   ```

### 可选配置

1. **Redis缓存**: 提高性能（多实例部署时推荐）
2. **邮件通知**: 系统告警通知
3. **HTTPS**: 生产环境必须启用
4. **日志级别**: 开发环境使用debug，生产环境使用info

## 端口说明

| 端口 | 服务 | 说明 |
|-----|------|------|
| 3000 | 后端API | Node.js应用端口 |
| 80 | HTTP | Nginx HTTP端口 |
| 443 | HTTPS | Nginx HTTPS端口 |
| 5432 | PostgreSQL | 数据库端口（仅内部） |
| 6379 | Redis | 缓存端口（可选） |
| 8080 | Web界面 | 开发环境 |
| 8081 | Adminer | 数据库管理（开发环境） |
| 9229 | Debug | Node.js调试端口（开发环境） |

## 目录结构

```
esp32-nfc-access-control/
├── .env.example              # 环境变量模板
├── .env.docker               # Docker环境变量模板
├── .dockerignore             # Docker忽略文件
├── deploy-local.sh           # 本地部署脚本
├── deploy-cloud.sh           # 云服务器部署脚本
├── docker-quickstart.sh      # Docker快速启动脚本
├── Dockerfile                # 生产环境Docker镜像
├── Dockerfile.dev            # 开发环境Docker镜像
├── docker-compose.yml        # 生产环境Docker Compose
├── docker-compose.dev.yml    # 开发环境Docker Compose
├── nginx.conf                # 生产环境Nginx配置
├── nginx.dev.conf            # 开发环境Nginx配置
├── DEPLOYMENT.md             # 部署指南
├── DOCKER.md                 # Docker部署指南
├── DEPLOYMENT_SUMMARY.md     # 本文件
├── server/                   # 后端服务
│   ├── .env.example          # 服务器环境变量模板
│   ├── src/                  # 源代码
│   ├── dist/                 # 编译后代码
│   ├── data/                 # SQLite数据库
│   └── logs/                 # 日志文件
├── web-admin/                # Web管理界面
└── esp32-firmware/           # ESP32固件
```

## 常见问题

### Q: 如何选择部署方式？

**A**: 
- **开发/测试**: 使用Docker部署（docker-compose.dev.yml）
- **家庭/小型办公室**: 使用本地部署（deploy-local.sh）
- **生产环境**: 使用云服务器部署（deploy-cloud.sh）或Docker生产环境（docker-compose.yml）

### Q: 如何修改默认端口？

**A**: 
- **本地部署**: 修改`.env`文件中的`PORT`配置
- **Docker部署**: 修改`docker-compose.yml`中的端口映射

### Q: 如何启用HTTPS？

**A**:
- **云服务器**: 部署脚本会自动申请Let's Encrypt证书
- **Docker**: 将SSL证书放到`ssl/`目录，修改`nginx.conf`配置
- **本地**: 使用自签名证书或反向代理

### Q: 如何备份数据？

**A**:
- **SQLite**: `cp server/data/access_control.db backup.db`
- **PostgreSQL**: `pg_dump access_control > backup.sql`
- **Docker**: `docker-compose exec db pg_dump -U access_user access_control > backup.sql`

### Q: 如何更新系统？

**A**:
```bash
# 本地部署
git pull
cd server
npm install
npm run build
pm2 restart nfc-access-api

# Docker部署
git pull
docker-compose build --no-cache
docker-compose up -d
```

## 安全检查清单

- [ ] 修改默认管理员密码
- [ ] 修改JWT_SECRET为强随机字符串
- [ ] 修改数据库密码（生产环境）
- [ ] 启用HTTPS（生产环境）
- [ ] 配置防火墙规则
- [ ] 定期备份数据库
- [ ] 定期更新系统和依赖
- [ ] 监控日志文件
- [ ] 限制管理界面访问IP（可选）
- [ ] 启用Redis密码（如果使用）

## 性能优化建议

1. **启用Redis缓存**: 减少数据库查询
2. **配置Nginx缓存**: 缓存静态资源
3. **使用CDN**: 加速静态资源加载
4. **数据库索引**: 优化查询性能
5. **日志轮转**: 防止日志文件过大
6. **资源限制**: Docker环境配置资源限制
7. **负载均衡**: 多实例部署（高并发场景）

## 监控建议

1. **服务监控**: 使用PM2或Docker健康检查
2. **日志监控**: 定期检查错误日志
3. **性能监控**: 监控CPU、内存、磁盘使用
4. **数据库监控**: 监控连接数、查询性能
5. **告警配置**: 配置邮件或短信告警

## 技术支持

如有问题，请：
1. 查看 `DEPLOYMENT.md` 详细文档
2. 查看 `DOCKER.md` Docker专项文档
3. 检查日志文件排查问题
4. 提交GitHub Issue

---

**创建日期**: 2024-01-15  
**任务编号**: 9.2  
**需求**: 20.1, 20.3, 20.5
