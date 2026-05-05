#!/bin/bash
# 一键部署脚本 (Linux)

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  ESP32 NFC 云门禁系统 - 一键部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}请不要使用 root 用户运行此脚本${NC}"
    exit 1
fi

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未检测到 Node.js${NC}"
    echo "请先安装 Node.js 16+ 版本"
    echo "Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "CentOS/RHEL: curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 版本: $(node --version)${NC}"
echo -e "${GREEN}✓ npm 版本: $(npm --version)${NC}"
echo ""

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 未安装，正在安装...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✓ PM2 安装完成${NC}"
else
    echo -e "${GREEN}✓ PM2 已安装: $(pm2 --version)${NC}"
fi
echo ""

# 1. 安装后端依赖
echo "=========================================="
echo "步骤 1/6: 安装后端依赖"
echo "=========================================="
cd server
if [ ! -d "node_modules" ]; then
    echo "正在安装后端依赖..."
    npm install
    echo -e "${GREEN}✓ 后端依赖安装完成${NC}"
else
    echo -e "${YELLOW}后端依赖已存在，跳过安装${NC}"
fi
echo ""

# 2. 配置后端环境变量
echo "=========================================="
echo "步骤 2/6: 配置后端环境变量"
echo "=========================================="
if [ ! -f ".env" ]; then
    echo "创建 .env 配置文件..."
    cp .env.example .env
    
    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -base64 32)
    
    # 获取服务器 IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    # 更新配置文件
    sed -i "s/your_random_secret_key_min_32_chars/$JWT_SECRET/" .env
    sed -i "s|http://localhost:8080|http://$SERVER_IP:8080|" .env
    
    echo -e "${GREEN}✓ 环境变量配置完成${NC}"
    echo -e "${YELLOW}请检查 server/.env 文件并根据需要调整配置${NC}"
else
    echo -e "${YELLOW}.env 文件已存在，跳过创建${NC}"
fi
echo ""

# 3. 编译后端代码
echo "=========================================="
echo "步骤 3/6: 编译后端 TypeScript 代码"
echo "=========================================="
echo "正在编译..."
npm run build
echo -e "${GREEN}✓ 编译完成${NC}"
echo ""

# 4. 初始化数据库
echo "=========================================="
echo "步骤 4/6: 初始化数据库"
echo "=========================================="
if [ ! -f "data/access_control.db" ]; then
    echo "正在初始化数据库..."
    mkdir -p data
    npm run db:init
    echo -e "${GREEN}✓ 数据库初始化完成${NC}"
else
    echo -e "${YELLOW}数据库已存在，跳过初始化${NC}"
fi
echo ""

# 5. 安装前端依赖
echo "=========================================="
echo "步骤 5/6: 安装前端依赖"
echo "=========================================="
cd ../web-admin
if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    npm install
    echo -e "${GREEN}✓ 前端依赖安装完成${NC}"
else
    echo -e "${YELLOW}前端依赖已存在，跳过安装${NC}"
fi
echo ""

# 6. 启动服务
echo "=========================================="
echo "步骤 6/6: 启动服务"
echo "=========================================="
cd ..

# 停止已存在的服务
pm2 delete nfc-backend 2>/dev/null || true
pm2 delete nfc-web-admin 2>/dev/null || true

# 使用 PM2 启动服务
echo "正在启动服务..."
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启动
echo ""
echo -e "${YELLOW}设置开机自启动...${NC}"
pm2 startup | grep "sudo" | bash || true

echo ""
echo "=========================================="
echo -e "${GREEN}部署完成！${NC}"
echo "=========================================="
echo ""
echo "服务状态:"
pm2 status
echo ""
echo "访问地址:"
echo -e "  Web 管理界面: ${GREEN}http://$SERVER_IP:8080${NC}"
echo -e "  API 服务:     ${GREEN}http://$SERVER_IP:3000${NC}"
echo -e "  健康检查:     ${GREEN}http://$SERVER_IP:3000/health${NC}"
echo ""
echo "默认登录凭据:"
echo -e "  用户名: ${YELLOW}admin${NC}"
echo -e "  密码:   ${YELLOW}admin123${NC}"
echo -e "  ${RED}⚠️  首次登录后请立即修改密码！${NC}"
echo ""
echo "常用命令:"
echo "  查看日志:   pm2 logs"
echo "  重启服务:   pm2 restart all"
echo "  停止服务:   pm2 stop all"
echo "  查看状态:   pm2 status"
echo "  监控资源:   pm2 monit"
echo ""
echo "配置防火墙:"
echo "  Ubuntu/Debian: sudo ufw allow 3000/tcp && sudo ufw allow 8080/tcp"
echo "  CentOS/RHEL:   sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --permanent --add-port=8080/tcp && sudo firewall-cmd --reload"
echo ""
echo "详细文档请查看: LINUX_DEPLOY.md"
echo "=========================================="
