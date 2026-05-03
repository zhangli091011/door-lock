#!/bin/bash
# ========================================
# 服务器更新脚本
# ========================================
# 用于快速更新和重启Docker服务
# ========================================

set -e  # 遇到错误立即退出

echo "=========================================="
echo "ESP32 NFC门禁系统 - 服务器更新"
echo "=========================================="
echo ""

# 1. 拉取最新代码
echo "📥 [1/5] 拉取最新代码..."
git pull origin main
echo "✅ 代码已更新"
echo ""

# 2. 停止现有服务
echo "🛑 [2/5] 停止现有服务..."
docker-compose down
echo "✅ 服务已停止"
echo ""

# 3. 重新构建镜像
echo "🔨 [3/5] 重新构建Docker镜像..."
docker-compose build --no-cache api
echo "✅ 镜像构建完成"
echo ""

# 4. 启动服务
echo "🚀 [4/5] 启动服务..."
docker-compose up -d
echo "✅ 服务已启动"
echo ""

# 5. 等待服务就绪
echo "⏳ [5/5] 等待服务就绪..."
sleep 10

# 检查服务状态
echo ""
echo "=========================================="
echo "服务状态检查"
echo "=========================================="
docker-compose ps
echo ""

# 检查API健康状态
echo "=========================================="
echo "API健康检查"
echo "=========================================="
curl -s http://localhost:3000/health | jq . || echo "健康检查失败，请查看日志"
echo ""

# 显示最近日志
echo "=========================================="
echo "最近日志（最后20行）"
echo "=========================================="
docker-compose logs --tail=20 api
echo ""

echo "=========================================="
echo "✅ 更新完成！"
echo "=========================================="
echo ""
echo "访问地址："
echo "  - Web管理界面: http://YOUR_SERVER_IP:8080"
echo "  - API服务: http://YOUR_SERVER_IP:3000"
echo ""
echo "默认登录账户："
echo "  - 用户名: admin"
echo "  - 密码: admin123"
echo ""
echo "查看实时日志："
echo "  docker-compose logs -f api"
echo ""
