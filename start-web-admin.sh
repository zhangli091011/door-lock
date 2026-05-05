#!/bin/bash
# Web Admin 启动脚本 (Linux)

echo "启动 Web Admin 服务..."
echo "设置时区为 Asia/Shanghai (UTC+8)..."

# 设置时区环境变量
export TZ=Asia/Shanghai

cd web-admin
node server.js
