# 快速修复指南 - PostgreSQL占位符错误

## 问题描述

错误信息：
```
ERROR: syntax error at end of input at character 109
WHERE username = ?
```

**原因**：Docker容器中的代码还是旧版本，使用了SQLite的 `?` 占位符，但数据库是PostgreSQL。

## 解决方案

### 方式一：使用更新脚本（推荐）

在服务器上执行：

```bash
# 1. 进入项目目录
cd /path/to/your/project

# 2. 拉取最新代码
git pull

# 3. 给脚本添加执行权限
chmod +x update-server.sh

# 4. 运行更新脚本
./update-server.sh
```

### 方式二：手动更新

```bash
# 1. 进入项目目录
cd /path/to/your/project

# 2. 拉取最新代码
git pull origin main

# 3. 停止服务
docker-compose down

# 4. 重新构建镜像（不使用缓存）
docker-compose build --no-cache api

# 5. 启动服务
docker-compose up -d

# 6. 查看日志确认
docker-compose logs -f api
```

### 方式三：临时切换到SQLite（如果PostgreSQL有问题）

如果你想快速测试，可以临时切换到SQLite：

1. 编辑 `.env` 文件：
```bash
nano .env
```

2. 修改数据库配置：
```env
# 注释掉PostgreSQL配置
# DATABASE_TYPE=postgresql
# DATABASE_URL=postgresql://...

# 使用SQLite
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/access_control.db
```

3. 重启服务：
```bash
docker-compose restart api
```

## 验证修复

### 1. 检查容器状态
```bash
docker-compose ps
```

应该看到所有服务都是 `Up` 状态。

### 2. 检查API健康
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

### 3. 查看日志
```bash
docker-compose logs -f api
```

不应该再看到 "syntax error" 错误。

### 4. 测试登录
访问 Web 界面并尝试登录：
- 用户名：`admin`
- 密码：`admin123`

## 如果还有问题

### 检查数据库是否有管理员账户

```bash
# 进入PostgreSQL容器
docker-compose exec db psql -U access_user -d access_control

# 查询管理员表
SELECT * FROM admins;

# 如果没有数据，插入默认管理员
INSERT INTO admins (username, password_hash, email) 
VALUES (
  'admin', 
  '$2b$10$SxLHcgTB4qW4UYy4slSXReqH28DAMYEFFdyFxYL8SPPlYzpWQnV3K', 
  'admin@example.com'
);

# 退出
\q
```

### 查看详细错误日志

```bash
# API日志
docker-compose logs --tail=100 api

# 数据库日志
docker-compose logs --tail=100 db

# 所有服务日志
docker-compose logs --tail=100
```

### 完全重置（谨慎使用）

如果需要完全重置：

```bash
# 停止并删除所有容器和卷
docker-compose down -v

# 删除旧镜像
docker rmi $(docker images | grep nfc-access | awk '{print $3}')

# 重新构建和启动
docker-compose build --no-cache
docker-compose up -d
```

⚠️ **警告**：这会删除所有数据！

## 代码修改说明

修复的代码在 `server/src/db.ts` 的 `queryPostgreSQL` 方法中：

```typescript
private async queryPostgreSQL(sql: string, params: any[]): Promise<QueryResult> {
  if (!this.pgPool) {
    throw new Error('PostgreSQL pool not initialized');
  }

  // 将 ? 转换为 $1, $2, $3...
  let paramIndex = 0;
  const convertedSql = sql.replace(/\?/g, () => {
    paramIndex++;
    return `$${paramIndex}`;
  });

  const result = await this.pgPool.query(convertedSql, params);
  return {
    rows: result.rows,
    rowCount: result.rowCount || 0,
  };
}
```

这样代码就可以同时支持SQLite和PostgreSQL了。

## 联系支持

如果问题仍然存在，请提供：
1. `docker-compose ps` 的输出
2. `docker-compose logs api` 的最后100行
3. 你的 `.env` 配置（隐藏敏感信息）
4. 服务器操作系统和Docker版本
