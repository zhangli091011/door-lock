# Nginx外部部署指南

本项目已移除Docker Compose中的内置nginx服务，你需要自行部署nginx作为反向代理。

## 架构说明

```
Internet
    ↓
[你的Nginx服务器]
    ↓
    ├─→ /api/*  → Docker容器 (localhost:3000) - 后端API
    └─→ /*      → 静态文件 (/var/www/nfc-access/web-admin) - Web管理界面
```

## 快速开始

### 1. 启动Docker服务

```bash
# 生产环境
docker-compose up -d

# 开发环境
docker-compose -f docker-compose.dev.yml up -d
```

这将启动：
- PostgreSQL数据库（端口5432）
- 后端API服务（端口3000）
- Redis缓存（可选，使用 --profile cache）

### 2. 配置Nginx

#### 方式一：使用提供的配置示例

```bash
# 复制配置示例
sudo cp nginx.example.conf /etc/nginx/sites-available/nfc-access

# 修改配置文件
sudo nano /etc/nginx/sites-available/nfc-access

# 需要修改的内容：
# - server_name: 改为你的域名
# - ssl_certificate: SSL证书路径
# - root: web-admin静态文件路径

# 创建软链接
sudo ln -s /etc/nginx/sites-available/nfc-access /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载nginx
sudo systemctl reload nginx
```

#### 方式二：添加到现有nginx配置

如果你已有nginx配置，只需添加以下location块：

```nginx
# API代理
location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Web管理界面
location / {
    root /var/www/nfc-access/web-admin;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```

### 3. 部署Web管理界面静态文件

```bash
# 创建目录
sudo mkdir -p /var/www/nfc-access

# 复制web-admin文件
sudo cp -r web-admin /var/www/nfc-access/

# 设置权限
sudo chown -R www-data:www-data /var/www/nfc-access
sudo chmod -R 755 /var/www/nfc-access
```

### 4. 配置SSL证书（生产环境）

#### 使用Let's Encrypt（推荐）

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

#### 使用自签名证书（仅测试）

```bash
# 创建SSL目录
sudo mkdir -p /etc/nginx/ssl

# 生成自签名证书
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/privkey.pem \
  -out /etc/nginx/ssl/fullchain.pem
```

## 环境变量配置

创建 `.env` 文件配置Docker服务：

```bash
# 数据库密码
DB_PASSWORD=your_secure_database_password

# JWT密钥（至少32字符）
JWT_SECRET=your_random_secret_key_min_32_chars_change_this_in_production

# 允许的CORS源（根据你的域名修改）
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Redis密码（如果使用）
REDIS_PASSWORD=your_redis_password
```

## 验证部署

### 1. 检查Docker容器状态

```bash
docker-compose ps
```

应该看到：
- nfc-access-db (healthy)
- nfc-access-api (healthy)

### 2. 测试API健康检查

```bash
curl http://localhost:3000/health
```

应该返回：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "production"
}
```

### 3. 测试Nginx代理

```bash
# 测试API代理
curl http://yourdomain.com/api/health

# 测试Web界面
curl http://yourdomain.com/
```

### 4. 访问Web管理界面

打开浏览器访问：
- HTTP: http://yourdomain.com
- HTTPS: https://yourdomain.com

默认登录账户：
- 用户名：`admin`
- 密码：`admin123`

⚠️ **首次登录后请立即修改密码！**

## 常见问题

### 1. API返回502 Bad Gateway

**原因**：Nginx无法连接到后端API

**解决方案**：
```bash
# 检查API容器是否运行
docker-compose ps

# 检查API日志
docker-compose logs api

# 检查端口是否监听
netstat -tlnp | grep 3000
```

### 2. CORS错误

**原因**：ALLOWED_ORIGINS配置不正确

**解决方案**：
```bash
# 编辑.env文件，添加你的域名
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# 重启API容器
docker-compose restart api
```

### 3. 静态文件404

**原因**：web-admin路径配置错误

**解决方案**：
```bash
# 检查文件是否存在
ls -la /var/www/nfc-access/web-admin/

# 检查nginx配置中的root路径
sudo nginx -T | grep root

# 检查文件权限
sudo chown -R www-data:www-data /var/www/nfc-access
```

### 4. SSL证书错误

**原因**：证书路径或权限问题

**解决方案**：
```bash
# 检查证书文件
sudo ls -la /etc/nginx/ssl/

# 检查nginx配置
sudo nginx -t

# 查看详细错误
sudo tail -f /var/log/nginx/error.log
```

## 监控和日志

### Nginx日志

```bash
# 访问日志
sudo tail -f /var/log/nginx/nfc-access.log

# 错误日志
sudo tail -f /var/log/nginx/nfc-access-error.log
```

### Docker日志

```bash
# API日志
docker-compose logs -f api

# 数据库日志
docker-compose logs -f db

# 所有服务日志
docker-compose logs -f
```

### 系统资源监控

```bash
# 容器资源使用
docker stats

# 磁盘使用
docker system df
```

## 性能优化

### 1. Nginx缓存配置

```nginx
# 在http块中添加
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

# 在location /api/块中添加
proxy_cache api_cache;
proxy_cache_valid 200 5m;
proxy_cache_key "$scheme$request_method$host$request_uri";
```

### 2. 启用HTTP/2

```nginx
listen 443 ssl http2;
listen [::]:443 ssl http2;
```

### 3. 配置Gzip压缩

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;
```

## 备份和恢复

### 备份数据库

```bash
# PostgreSQL备份
docker-compose exec db pg_dump -U access_user access_control > backup.sql

# 或使用docker volume备份
docker run --rm -v nfc-access_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data
```

### 恢复数据库

```bash
# PostgreSQL恢复
docker-compose exec -T db psql -U access_user access_control < backup.sql
```

## 安全建议

1. **修改默认密码**：首次登录后立即修改admin密码
2. **使用强密码**：数据库、JWT密钥、Redis密码都应使用强随机密码
3. **启用HTTPS**：生产环境必须使用HTTPS
4. **配置防火墙**：只开放必要的端口（80, 443）
5. **定期更新**：及时更新Docker镜像和系统包
6. **监控日志**：定期检查访问日志和错误日志
7. **备份数据**：定期备份数据库和配置文件

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose build

# 重启服务（零停机）
docker-compose up -d --no-deps --build api

# 或完全重启
docker-compose down
docker-compose up -d
```

## 技术支持

如有问题，请查看：
- [项目README](README.md)
- [部署文档](DEPLOYMENT.md)
- [Docker文档](DOCKER.md)
- [GitHub Issues](https://github.com/zhangli091011/door-lock/issues)
