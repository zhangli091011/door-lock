# ========================================
# ESP32 NFC 云门禁系统 - Docker镜像
# ========================================
# 多阶段构建，优化镜像大小
# ========================================

# ----------------------------------------
# 阶段1：构建阶段
# ----------------------------------------
FROM node:18-alpine AS builder

# 安装编译工具（用于构建原生模块如bcrypt）
RUN apk add --no-cache python3 make g++

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY server/package*.json ./

# 安装依赖（包括开发依赖）
RUN npm ci

# 复制源代码
COPY server/ ./

# 编译TypeScript
RUN npm run build

# ----------------------------------------
# 阶段2：生产阶段
# ----------------------------------------
FROM node:18-alpine

# 安装运行时依赖和编译工具（bcrypt需要）
RUN apk add --no-cache \
    tini \
    curl \
    python3 \
    make \
    g++

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置工作目录
WORKDIR /app

# 从构建阶段复制编译后的文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# 只安装生产依赖（跳过可选依赖如sqlite3）
RUN npm ci --only=production --no-optional && \
    npm cache clean --force

# 清理编译工具以减小镜像大小
RUN apk del python3 make g++

# 创建必要的目录
RUN mkdir -p data logs && \
    chown -R nodejs:nodejs /app

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 使用tini作为init进程（处理信号和僵尸进程）
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用
CMD ["node", "dist/server.js"]

# 元数据标签
LABEL maintainer="ESP32 NFC Access Control Team"
LABEL description="ESP32 NFC云门禁系统后端服务"
LABEL version="1.0.0"
