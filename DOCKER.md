# Docker 部署指南

本文档提供ESP32 NFC云门禁系统的Docker容器化部署详细说明。

## 快速开始

### 1. 安装Docker和Docker Compose

```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker .env

# 编辑配置
nano .env
```

**必须修改的配置**：
- `DB_PASSWORD`: 数据库密码
- `JWT_SECRET`: JWT密钥（至少32字符）
- `ALLOWED_ORIGINS`: 允许的前端域名

### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 4. 初始化数据库

```bash
# 进入API容器
docker-compose exec api sh

# 运行数据库初始化
npm run db:init

# 退出容器
exit
```

### 5. 访问系统

- **Web界面**: http://localhost
- **API**: http://localhost/api
- **默认账户**: admin / admin123

---

## 服务说明

### 服务架构

```
┌─────────────────────────────────────────┐
│           Nginx (端口 80/443)            │
│         反向代理 + 静态文件服务           │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌────────▼────────┐
│  API Service   │    │  PostgreSQL DB  │
│   (端口 3000)   │◄───┤   (端口 5432)   │
└────────────────┘    └─────────────────┘
```

### 包含的服务

1. **api**: Node.js后端服务
2. **db**: PostgreSQL数据库
3. **nginx**: Nginx反向代理
4. **redis**: Redis缓存（可选）

---

## 常用命令

### 服务管理

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启服务
docker-compose restart

# 重启单个服务
docker-compose restart api

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f
docker-compose logs -f api  # 只查看API日志
```

### 容器操作

```bash
# 进入容器
docker-compose exec api sh
docker-compose exec db psql -U access_user -d access_control

# 查看容器资源使用
docker stats

# 清理未使用的容器和镜像
docker system prune -a
```

### 数据管理

```bash
# 备份数据库
docker-compose exec db pg_dump -U access_user access_control > backup.sql

# 恢复数据库
cat backup.sql | docker-compose exec -T db psql -U access_user access_control

# 查看数据卷
docker volume ls

# 删除数据卷（⚠️ 会删除所有数据）
docker-compose down -v
```

---

## 开发环境

### 启动开发环境

```bash
# 使用开发环境配置
docker-compose -f docker-compose.dev.yml up -d

# 查看日志（支持热重载）
docker-compose -f docker-compose.dev.yml logs -f api
```

### 开发环境特性

- **热重载**: 代码修改自动重启
- **调试端口**: 9229端口用于Node.js调试
- **数据库管理**: Adminer工具 (http://localhost:8081)
- **详细日志**: DEBUG级别日志输出

### 访问地址

- **Web界面**: http://localhost:8080
- **API**: http://localhost:3000
- **数据库管理**: http://localhost:8081
  - 系统: PostgreSQL
  - 服务器: db
  - 用户名: dev_user
  - 密码: dev_password
  - 数据库: access_control_dev

---

## 生产环境部署

### 1. 配置SSL证书

```bash
# 创建SSL目录
mkdir -p ssl

# 复制证书文件
cp /path/to/fullchain.pem ssl/
cp /path/to/privkey.pem ssl/

# 或使用Let's Encrypt
certbot certonly --standalone -d yourdomain.com
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/
```

### 2. 修改环境变量

```bash
# 编辑.env文件
nano .env
```

**生产环境配置**：
```env
DB_PASSWORD=strong_random_password_here
JWT_SECRET=your_32_chars_random_secret_key
ALLOWED_ORIGINS=https://yourdomain.com
DOMAIN=yourdomain.com
```

### 3. 启动生产服务

```bash
# 构建并启动
docker-compose up -d

# 查看日志确认启动成功
docker-compose logs -f
```

### 4. 配置自动启动

```bash
# 创建systemd服务文件
sudo nano /etc/systemd/system/nfc-access.service
```

内容：
```ini
[Unit]
Description=ESP32 NFC Access Control
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/esp32-nfc-access-control
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

启用服务：
```bash
sudo systemctl enable nfc-access
sudo systemctl start nfc-access
```

---

## 性能优化

### 1. 资源限制

编辑 `docker-compose.yml`，添加资源限制：

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 2. 日志轮转

```bash
# 配置Docker日志驱动
# 编辑 /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# 重启Docker
sudo systemctl restart docker
```

### 3. 启用Redis缓存

```bash
# 启动Redis服务
docker-compose --profile cache up -d

# 修改API环境变量
ENABLE_REDIS=true
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

---

## 监控和维护

### 健康检查

```bash
# 检查服务健康状态
docker-compose ps

# 查看健康检查日志
docker inspect --format='{{json .State.Health}}' nfc-access-api | jq
```

### 日志管理

```bash
# 查看最近100行日志
docker-compose logs --tail=100 api

# 实时查看日志
docker-compose logs -f --tail=50 api

# 导出日志
docker-compose logs --no-color > logs.txt
```

### 性能监控

```bash
# 查看容器资源使用
docker stats

# 查看容器详细信息
docker inspect nfc-access-api

# 查看网络连接
docker network inspect esp32-nfc-access-control_nfc-network
```

---

## 故障排查

### 问题1: 容器无法启动

```bash
# 查看容器日志
docker-compose logs api

# 检查容器状态
docker-compose ps

# 重新构建镜像
docker-compose build --no-cache api
docker-compose up -d
```

### 问题2: 数据库连接失败

```bash
# 检查数据库容器状态
docker-compose ps db

# 进入数据库容器
docker-compose exec db psql -U access_user -d access_control

# 检查数据库日志
docker-compose logs db
```

### 问题3: Nginx 502错误

```bash
# 检查API服务是否运行
docker-compose ps api

# 检查Nginx配置
docker-compose exec nginx nginx -t

# 查看Nginx日志
docker-compose logs nginx
```

### 问题4: 端口冲突

```bash
# 查找占用端口的进程
sudo lsof -i :80
sudo lsof -i :443

# 修改docker-compose.yml中的端口映射
ports:
  - "8080:80"  # 改为8080端口
  - "8443:443"
```

---

## 数据迁移

### 从SQLite迁移到PostgreSQL

```bash
# 1. 导出SQLite数据
sqlite3 data/access_control.db .dump > sqlite_dump.sql

# 2. 转换SQL语法（手动或使用工具）
# SQLite和PostgreSQL语法有差异，需要调整

# 3. 导入到PostgreSQL
cat converted_dump.sql | docker-compose exec -T db psql -U access_user access_control
```

### 从其他服务器迁移

```bash
# 1. 在旧服务器备份数据
pg_dump -U access_user access_control > backup.sql

# 2. 复制到新服务器
scp backup.sql user@new-server:/path/to/

# 3. 在新服务器恢复
cat backup.sql | docker-compose exec -T db psql -U access_user access_control
```

---

## 安全建议

1. **使用强密码**: 数据库密码、JWT密钥使用强随机字符串
2. **限制端口暴露**: 生产环境不要暴露数据库端口
3. **定期更新镜像**: `docker-compose pull && docker-compose up -d`
4. **使用secrets**: 敏感信息使用Docker secrets管理
5. **网络隔离**: 使用自定义网络隔离服务
6. **只读文件系统**: 对不需要写入的容器使用只读文件系统

---

## 高级配置

### 多实例部署（负载均衡）

```yaml
services:
  api:
    deploy:
      replicas: 3
    # ... 其他配置
```

### 使用外部数据库

```yaml
services:
  api:
    environment:
      DATABASE_URL: postgresql://user:pass@external-db:5432/dbname
  # 移除db服务
```

### 自定义网络

```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # 内部网络，不能访问外网
```

---

## 参考资源

- [Docker官方文档](https://docs.docker.com/)
- [Docker Compose文档](https://docs.docker.com/compose/)
- [PostgreSQL Docker镜像](https://hub.docker.com/_/postgres)
- [Nginx Docker镜像](https://hub.docker.com/_/nginx)

---

**版本**: 1.0.0  
**更新日期**: 2024-01-15
