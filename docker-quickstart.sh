#!/bin/bash

# ========================================
# ESP32 NFC 云门禁系统 - Docker快速启动脚本
# ========================================

set -e

echo "========================================="
echo "ESP32 NFC 云门禁系统 - Docker快速启动"
echo "========================================="
echo ""

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误：未安装Docker"
    echo "请访问 https://docs.docker.com/get-docker/ 安装Docker"
    exit 1
fi

# 检查Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误：未安装Docker Compose"
    echo "请访问 https://docs.docker.com/compose/install/ 安装Docker Compose"
    exit 1
fi

echo "✓ Docker版本：$(docker --version)"
echo "✓ Docker Compose版本：$(docker-compose --version)"
echo ""

# 配置环境变量
if [ ! -f ".env" ]; then
    echo "📝 配置环境变量..."
    
    # 生成随机密码和密钥
    DB_PASSWORD=$(openssl rand -hex 16)
    JWT_SECRET=$(openssl rand -hex 32)
    
    cat > .env << EOF
# 数据库配置
DB_PASSWORD=$DB_PASSWORD

# JWT配置
JWT_SECRET=$JWT_SECRET

# CORS配置
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000

# Redis配置
REDIS_PASSWORD=$(openssl rand -hex 16)
EOF
    
    echo "✓ 环境变量配置完成"
    echo "  - 数据库密码已自动生成"
    echo "  - JWT密钥已自动生成"
else
    echo "✓ 环境变量文件已存在"
fi
echo ""

# 启动服务
echo "🚀 启动Docker服务..."
docker-compose up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "📊 服务状态："
docker-compose ps

# 初始化数据库
echo ""
echo "🗄️  初始化数据库..."
docker-compose exec -T api npm run db:init || echo "⚠️  数据库可能已初始化"

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "访问地址："
echo "  - Web管理界面：http://localhost"
echo "  - API接口：http://localhost/api"
echo ""
echo "默认管理员账户："
echo "  - 用户名：admin"
echo "  - 密码：admin123"
echo "  ⚠️  请立即修改默认密码！"
echo ""
echo "常用命令："
echo "  - 查看日志：docker-compose logs -f"
echo "  - 停止服务：docker-compose down"
echo "  - 重启服务：docker-compose restart"
echo ""
