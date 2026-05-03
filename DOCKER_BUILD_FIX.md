# Docker构建修复说明

## 问题描述

Docker构建时出现错误：
```
npm error gyp ERR! find Python
npm error gyp ERR! find Python Python is not set from command line or npm configuration
```

**原因**：sqlite3是一个原生模块，需要Python和编译工具来构建。但在Docker生产环境中使用PostgreSQL，不需要sqlite3。

## 解决方案

### 已完成的修改

1. **将sqlite3改为可选依赖** (`server/package.json`)
   ```json
   "optionalDependencies": {
     "sqlite3": "^5.1.6"
   }
   ```

2. **Dockerfile跳过可选依赖**
   ```dockerfile
   RUN npm ci --only=production --no-optional
   ```

3. **更新环境变量说明**
   - 明确Docker部署使用PostgreSQL
   - SQLite仅用于本地开发

### 数据库选择指南

| 场景 | 推荐数据库 | 原因 |
|------|-----------|------|
| 本地开发 | SQLite | 简单，无需额外服务 |
| Docker部署 | PostgreSQL | 生产级，支持并发 |
| 生产环境 | PostgreSQL | 高性能，可扩展 |

## 重新构建

在服务器上执行：

```bash
# 1. 拉取最新代码
git pull

# 2. 停止服务
docker-compose down

# 3. 重新构建（不使用缓存）
docker-compose build --no-cache api

# 4. 启动服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f api
```

或使用自动化脚本：

```bash
./update-server.sh
```

## 验证

### 1. 检查构建是否成功

```bash
docker images | grep nfc-access
```

应该看到新构建的镜像。

### 2. 检查容器状态

```bash
docker-compose ps
```

所有服务应该是 `Up` 状态。

### 3. 测试API

```bash
curl http://localhost:3000/health
```

应该返回：
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123.456,
  "environment": "production"
}
```

### 4. 测试登录

访问Web界面并登录：
- 用户名：`admin`
- 密码：`admin123`

## 本地开发（使用SQLite）

如果你想在本地使用SQLite开发：

```bash
# 1. 进入server目录
cd server

# 2. 安装所有依赖（包括sqlite3）
npm install

# 3. 配置.env使用SQLite
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/access_control.db

# 4. 初始化数据库
sqlite3 data/access_control.db < database/schema.sqlite.sql

# 5. 启动开发服务器
npm run dev
```

## Docker环境变量

Docker Compose会自动设置以下环境变量：

```yaml
environment:
  DATABASE_TYPE: postgresql
  DATABASE_URL: postgresql://access_user:password@db:5432/access_control
```

不需要手动配置。

## 故障排查

### 问题1: 构建仍然失败

**解决方案**：清理Docker缓存

```bash
# 删除旧镜像
docker rmi $(docker images | grep nfc-access | awk '{print $3}')

# 清理构建缓存
docker builder prune -a

# 重新构建
docker-compose build --no-cache
```

### 问题2: 容器启动失败

**检查日志**：
```bash
docker-compose logs api
```

**常见原因**：
- 数据库未就绪：等待几秒后重试
- 端口被占用：检查3000端口是否被占用
- 环境变量错误：检查docker-compose.yml配置

### 问题3: 仍然提示需要Python

**原因**：npm缓存或node_modules残留

**解决方案**：
```bash
# 完全清理
docker-compose down -v
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

## 性能优化

### 多阶段构建优势

当前Dockerfile使用多阶段构建：

1. **构建阶段**：安装所有依赖，编译TypeScript
2. **生产阶段**：只复制编译后的代码和生产依赖

**优势**：
- 镜像更小（不包含开发依赖和源代码）
- 构建更快（利用层缓存）
- 更安全（不暴露源代码）

### 镜像大小对比

- 包含sqlite3: ~250MB
- 不包含sqlite3: ~180MB
- 节省: ~70MB

## 相关文档

- [Docker部署指南](DOCKER.md)
- [Nginx部署指南](NGINX_DEPLOYMENT.md)
- [快速修复指南](QUICK_FIX.md)
- [更新脚本](update-server.sh)
