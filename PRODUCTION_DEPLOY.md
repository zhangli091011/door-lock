# 生产环境部署指南

## 域名配置

**主域名**: `door.sparkmaker.club`

## 部署步骤

### 1. 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y nginx nodejs npm git

# 安装PM2（进程管理器）
sudo npm install -g pm2
```

### 2. 拉取代码

```bash
# 克隆仓库
cd /var/www
sudo git clone https://github.com/zhangli091011/door-lock.git
cd door-lock

# 设置权限
sudo chown -R $USER:$USER /var/www/door-lock
```

### 3. 配置后端服务

```bash
# 进入server目录
cd /var/www/door-lock/server

# 复制生产环境配置
cp .env.production .env

# 编辑配置文件
nano .env
```

**必须修改的配置**：

```env
# 数据库配置（如果使用PostgreSQL）
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://access_user:YOUR_STRONG_PASSWORD@localhost:5432/access_control

# JWT密钥（必须修改！）
JWT_SECRET=YOUR_RANDOM_32_CHARS_SECRET_KEY

# CORS配置（必须包含你的域名）
ALLOWED_ORIGINS=http://door.sparkmaker.club,https://door.sparkmaker.club
```

**生成强随机JWT密钥**：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. 安装依赖并启动服务

```bash
# 安装依赖
npm install

# 编译TypeScript
npm run build

# 初始化数据库（如果使用SQLite）
mkdir -p data
sqlite3 data/access_control.db < database/schema.sqlite.sql

# 使用PM2启动服务
pm2 start dist/server.js --name nfc-api

# 设置开机自启
pm2 startup
pm2 save
```

### 5. 配置Nginx

创建nginx配置文件：

```bash
sudo nano /etc/nginx/sites-available/door-sparkmaker
```

添加以下内容：

```nginx
# HTTP服务器
server {
    listen 80;
    server_name door.sparkmaker.club;
    
    # 日志配置
    access_log /var/log/nginx/door-sparkmaker-access.log;
    error_log /var/log/nginx/door-sparkmaker-error.log;
    
    # 客户端上传大小限制
    client_max_body_size 10M;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;
    
    # Web管理界面静态文件
    location / {
        root /var/www/door-lock/web-admin;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API代理到后端服务
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        
        # 代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 健康检查端点
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/door-sparkmaker /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载nginx
sudo systemctl reload nginx
```

### 6. 配置SSL证书（推荐）

使用Let's Encrypt免费SSL证书：

```bash
# 安装certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d door.sparkmaker.club

# 自动续期测试
sudo certbot renew --dry-run
```

### 7. 配置防火墙

```bash
# 允许HTTP和HTTPS
sudo ufw allow 80
sudo ufw allow 443

# 允许SSH（如果还没开放）
sudo ufw allow 22

# 启用防火墙
sudo ufw enable
```

### 8. 验证部署

```bash
# 检查后端服务
curl http://localhost:3000/health

# 检查nginx代理
curl http://door.sparkmaker.club/health

# 查看PM2状态
pm2 status

# 查看日志
pm2 logs nfc-api
```

### 9. 访问系统

打开浏览器访问：
- HTTP: http://door.sparkmaker.club
- HTTPS: https://door.sparkmaker.club

**默认登录账户**：
- 用户名：`admin`
- 密码：`admin123`

⚠️ **首次登录后请立即修改密码！**

## 更新部署

```bash
# 进入项目目录
cd /var/www/door-lock

# 拉取最新代码
git pull

# 更新后端
cd server
npm install
npm run build
pm2 restart nfc-api

# 更新前端（nginx会自动使用新文件）
# 无需额外操作

# 查看日志确认
pm2 logs nfc-api
```

## 监控和维护

### 查看日志

```bash
# PM2日志
pm2 logs nfc-api

# Nginx访问日志
sudo tail -f /var/log/nginx/door-sparkmaker-access.log

# Nginx错误日志
sudo tail -f /var/log/nginx/door-sparkmaker-error.log

# 应用日志
tail -f /var/www/door-lock/server/logs/combined.log
```

### 性能监控

```bash
# PM2监控
pm2 monit

# 系统资源
htop
```

### 备份数据库

```bash
# SQLite备份
cp /var/www/door-lock/server/data/access_control.db ~/backup/access_control_$(date +%Y%m%d).db

# PostgreSQL备份
pg_dump -U access_user access_control > ~/backup/access_control_$(date +%Y%m%d).sql
```

## 故障排查

### 问题1: 502 Bad Gateway

**原因**：后端服务未运行

**解决**：
```bash
pm2 restart nfc-api
pm2 logs nfc-api
```

### 问题2: CORS错误

**原因**：.env中ALLOWED_ORIGINS配置不正确

**解决**：
```bash
cd /var/www/door-lock/server
nano .env
# 确保包含: http://door.sparkmaker.club,https://door.sparkmaker.club
pm2 restart nfc-api
```

### 问题3: 数据库连接失败

**原因**：数据库未启动或配置错误

**解决**：
```bash
# 检查PostgreSQL
sudo systemctl status postgresql

# 或检查SQLite文件
ls -la /var/www/door-lock/server/data/
```

## 安全建议

1. ✅ 修改默认管理员密码
2. ✅ 使用HTTPS（Let's Encrypt）
3. ✅ 配置防火墙（ufw）
4. ✅ 定期备份数据库
5. ✅ 定期更新系统和依赖
6. ✅ 监控日志文件
7. ✅ 使用强JWT密钥
8. ✅ 限制数据库访问权限

## 技术支持

- GitHub: https://github.com/zhangli091011/door-lock
- 文档: 查看项目README.md
