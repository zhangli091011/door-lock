#!/bin/bash

# ========================================
# ESP32 NFC 云门禁系统 - 云服务器部署脚本
# ========================================
# 适用于：云服务器生产环境部署
# 数据库：PostgreSQL
# 运行模式：生产模式（带SSL）
# 支持：Ubuntu 20.04+, Debian 11+
# ========================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ESP32 NFC 云门禁系统 - 云服务器部署${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}错误：请使用root用户或sudo运行此脚本${NC}"
    exit 1
fi

# 获取配置信息
echo -e "${BLUE}请输入配置信息：${NC}"
read -p "域名（例如：access.yourdomain.com）: " DOMAIN
read -p "数据库密码（PostgreSQL）: " -s DB_PASSWORD
echo ""
read -p "JWT密钥（至少32字符，留空自动生成）: " JWT_SECRET
echo ""

# 生成JWT密钥
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    echo -e "${GREEN}✓ 已自动生成JWT密钥${NC}"
fi

# 更新系统
echo -e "${YELLOW}[1/12] 更新系统软件包...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✓ 系统更新完成${NC}"
echo ""

# 安装必要的软件
echo -e "${YELLOW}[2/12] 安装必要的软件...${NC}"
apt install -y curl wget git nginx postgresql postgresql-contrib certbot python3-certbot-nginx
echo -e "${GREEN}✓ 软件安装完成${NC}"
echo ""

# 安装Node.js
echo -e "${YELLOW}[3/12] 安装Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi
echo -e "${GREEN}✓ Node.js版本：$(node -v)${NC}"
echo ""

# 安装PM2
echo -e "${YELLOW}[4/12] 安装PM2进程管理器...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo -e "${GREEN}✓ PM2安装完成${NC}"
echo ""

# 配置PostgreSQL
echo -e "${YELLOW}[5/12] 配置PostgreSQL数据库...${NC}"
sudo -u postgres psql -c "CREATE DATABASE access_control;" 2>/dev/null || echo "数据库已存在"
sudo -u postgres psql -c "CREATE USER access_user WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "用户已存在"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE access_control TO access_user;"
sudo -u postgres psql -c "ALTER DATABASE access_control OWNER TO access_user;"
echo -e "${GREEN}✓ PostgreSQL配置完成${NC}"
echo ""

# 创建应用目录
echo -e "${YELLOW}[6/12] 创建应用目录...${NC}"
APP_DIR="/var/www/nfc-access-control"
mkdir -p $APP_DIR
cd $APP_DIR

# 克隆或更新代码
if [ -d ".git" ]; then
    echo -e "${YELLOW}更新现有代码...${NC}"
    git pull
else
    echo -e "${YELLOW}克隆代码仓库...${NC}"
    echo -e "${RED}⚠ 请手动上传代码到 $APP_DIR 目录${NC}"
    echo -e "${RED}或修改此脚本添加git clone命令${NC}"
fi
echo -e "${GREEN}✓ 代码准备完成${NC}"
echo ""

# 安装依赖
echo -e "${YELLOW}[7/12] 安装应用依赖...${NC}"
cd $APP_DIR/server
npm install --production
echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

# 配置环境变量
echo -e "${YELLOW}[8/12] 配置环境变量...${NC}"
cat > .env << EOF
# 数据库配置
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://access_user:$DB_PASSWORD@localhost:5432/access_control

# 服务器配置
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# JWT配置
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h

# CORS配置
ALLOWED_ORIGINS=https://$DOMAIN

# 速率限制
RATE_LIMIT_DEVICE=60
RATE_LIMIT_IP=100

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_CONSOLE=false

# HTTPS配置
ENABLE_HTTPS=false

# 系统配置
LOG_RETENTION_DAYS=90
DEVICE_OFFLINE_MINUTES=5
CACHE_EXPIRE_SECONDS=86400
SIGNATURE_TIMESTAMP_TOLERANCE=300
BCRYPT_ROUNDS=10
EOF

echo -e "${GREEN}✓ 环境变量配置完成${NC}"
echo ""

# 创建必要的目录
echo -e "${YELLOW}[9/12] 创建必要的目录...${NC}"
mkdir -p data logs
chown -R www-data:www-data $APP_DIR
echo -e "${GREEN}✓ 目录创建完成${NC}"
echo ""

# 初始化数据库
echo -e "${YELLOW}[10/12] 初始化数据库...${NC}"
npm run db:init
echo -e "${GREEN}✓ 数据库初始化完成${NC}"
echo ""

# 编译TypeScript
echo -e "${YELLOW}[11/12] 编译应用...${NC}"
npm run build
echo -e "${GREEN}✓ 编译完成${NC}"
echo ""

# 配置Nginx
echo -e "${YELLOW}[12/12] 配置Nginx...${NC}"
cat > /etc/nginx/sites-available/nfc-access << EOF
# HTTP服务器（重定向到HTTPS）
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Let's Encrypt验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 重定向到HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS服务器
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    # SSL证书配置（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/$DOMAIN/chain.pem;

    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头部
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 日志配置
    access_log /var/log/nginx/nfc-access.access.log;
    error_log /var/log/nginx/nfc-access.error.log;

    # 反向代理到Node.js后端
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件（Web管理界面）
    location / {
        root $APP_DIR/web-admin;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
EOF

# 启用站点配置
ln -sf /etc/nginx/sites-available/nfc-access /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
nginx -t

echo -e "${GREEN}✓ Nginx配置完成${NC}"
echo ""

# 申请SSL证书
echo -e "${YELLOW}申请Let's Encrypt SSL证书...${NC}"
echo -e "${BLUE}注意：请确保域名 $DOMAIN 已正确解析到此服务器IP${NC}"
read -p "是否现在申请SSL证书？(Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    # 临时启动Nginx用于验证
    systemctl restart nginx
    
    # 申请证书
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
        echo -e "${RED}SSL证书申请失败，请检查域名解析${NC}"
        echo -e "${YELLOW}可以稍后手动运行：certbot --nginx -d $DOMAIN${NC}"
    }
    
    # 配置自动续期
    systemctl enable certbot.timer
    systemctl start certbot.timer
    
    echo -e "${GREEN}✓ SSL证书配置完成${NC}"
else
    echo -e "${YELLOW}⚠ 跳过SSL证书申请，请稍后手动配置${NC}"
fi
echo ""

# 启动应用
echo -e "${YELLOW}启动应用...${NC}"
cd $APP_DIR/server
pm2 start dist/server.js --name nfc-access-api
pm2 save
pm2 startup systemd -u root --hp /root
echo -e "${GREEN}✓ 应用启动完成${NC}"
echo ""

# 重启Nginx
systemctl restart nginx
systemctl enable nginx
echo -e "${GREEN}✓ Nginx重启完成${NC}"
echo ""

# 配置防火墙
echo -e "${YELLOW}配置防火墙...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo -e "${GREEN}✓ 防火墙配置完成${NC}"
else
    echo -e "${YELLOW}⚠ 未检测到ufw，请手动配置防火墙${NC}"
fi
echo ""

# 部署完成
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "服务信息："
echo -e "  - 访问地址：https://$DOMAIN"
echo -e "  - 后端API：https://$DOMAIN/api"
echo -e "  - 数据库：PostgreSQL (access_control)"
echo -e "  - 应用目录：$APP_DIR"
echo ""
echo -e "默认管理员账户："
echo -e "  - 用户名：admin"
echo -e "  - 密码：admin123"
echo -e "  ${RED}⚠ 请立即登录并修改默认密码！${NC}"
echo ""
echo -e "常用命令："
echo -e "  - 查看应用状态：${GREEN}pm2 status${NC}"
echo -e "  - 查看应用日志：${GREEN}pm2 logs nfc-access-api${NC}"
echo -e "  - 重启应用：${GREEN}pm2 restart nfc-access-api${NC}"
echo -e "  - 查看Nginx日志：${GREEN}tail -f /var/log/nginx/nfc-access.access.log${NC}"
echo -e "  - 测试Nginx配置：${GREEN}nginx -t${NC}"
echo -e "  - 重启Nginx：${GREEN}systemctl restart nginx${NC}"
echo -e "  - 续期SSL证书：${GREEN}certbot renew${NC}"
echo ""
echo -e "数据库连接："
echo -e "  ${GREEN}psql -U access_user -d access_control${NC}"
echo ""
echo -e "${YELLOW}⚠ 重要提示：${NC}"
echo -e "  1. 请妥善保管数据库密码和JWT密钥"
echo -e "  2. 定期备份数据库：pg_dump access_control > backup.sql"
echo -e "  3. 监控服务器资源使用情况"
echo -e "  4. 定期更新系统和依赖包"
echo ""
