#!/bin/bash

# ========================================
# ESP32 NFC 云门禁系统 - 本地部署脚本
# ========================================
# 适用于：本地开发环境、家庭/小型办公室部署
# 数据库：SQLite
# 运行模式：开发模式
# ========================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ESP32 NFC 云门禁系统 - 本地部署${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查Node.js版本
echo -e "${YELLOW}[1/8] 检查Node.js环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误：未安装Node.js${NC}"
    echo "请访问 https://nodejs.org/ 下载安装Node.js 16+版本"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}错误：Node.js版本过低（当前：$(node -v)，要求：v16+）${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js版本：$(node -v)${NC}"
echo ""

# 检查npm
echo -e "${YELLOW}[2/8] 检查npm环境...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误：未安装npm${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm版本：$(npm -v)${NC}"
echo ""

# 安装后端依赖
echo -e "${YELLOW}[3/8] 安装后端依赖...${NC}"
cd server
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误：未找到server/package.json${NC}"
    exit 1
fi

npm install
echo -e "${GREEN}✓ 后端依赖安装完成${NC}"
echo ""

# 配置环境变量
echo -e "${YELLOW}[4/8] 配置环境变量...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ 已创建.env文件（从.env.example复制）${NC}"
        echo -e "${YELLOW}⚠ 请编辑server/.env文件，修改JWT_SECRET等配置${NC}"
    else
        echo -e "${RED}错误：未找到.env.example文件${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env文件已存在${NC}"
fi
echo ""

# 创建必要的目录
echo -e "${YELLOW}[5/8] 创建必要的目录...${NC}"
mkdir -p data
mkdir -p logs
echo -e "${GREEN}✓ 目录创建完成${NC}"
echo ""

# 初始化数据库
echo -e "${YELLOW}[6/8] 初始化数据库...${NC}"
if [ -f "data/access_control.db" ]; then
    echo -e "${YELLOW}⚠ 数据库文件已存在，跳过初始化${NC}"
    read -p "是否重新初始化数据库？这将删除所有现有数据！(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f data/access_control.db
        npm run db:init
        echo -e "${GREEN}✓ 数据库重新初始化完成${NC}"
    fi
else
    npm run db:init
    echo -e "${GREEN}✓ 数据库初始化完成${NC}"
fi
echo ""

# 编译TypeScript
echo -e "${YELLOW}[7/8] 编译TypeScript代码...${NC}"
npm run build
echo -e "${GREEN}✓ 编译完成${NC}"
echo ""

# 启动服务
echo -e "${YELLOW}[8/8] 启动服务...${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "服务信息："
echo -e "  - 后端API地址：http://localhost:3000"
echo -e "  - 数据库类型：SQLite"
echo -e "  - 数据库路径：server/data/access_control.db"
echo -e "  - 日志路径：server/logs/app.log"
echo ""
echo -e "默认管理员账户："
echo -e "  - 用户名：admin"
echo -e "  - 密码：admin123"
echo -e "  ${RED}⚠ 请立即修改默认密码！${NC}"
echo ""
echo -e "启动命令："
echo -e "  - 开发模式：${GREEN}npm run dev${NC}"
echo -e "  - 生产模式：${GREEN}npm start${NC}"
echo ""
echo -e "其他命令："
echo -e "  - 运行测试：${GREEN}npm test${NC}"
echo -e "  - 查看日志：${GREEN}tail -f logs/app.log${NC}"
echo ""

# 询问是否立即启动
read -p "是否立即启动开发服务器？(Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${GREEN}正在启动开发服务器...${NC}"
    npm run dev
fi
