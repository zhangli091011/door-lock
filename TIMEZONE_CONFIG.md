# 时区配置说明

本系统已配置为强制使用 **UTC+8 (中国标准时间 / Asia/Shanghai)**。

## 配置方式

### 1. 服务器端配置

#### 方式一：环境变量（推荐）

在启动服务前设置环境变量：

```bash
export TZ=Asia/Shanghai
```

#### 方式二：代码中设置

在 `server/src/server.ts` 中已添加：

```typescript
// Force timezone to UTC+8 (Asia/Shanghai)
process.env.TZ = 'Asia/Shanghai';
```

#### 方式三：系统级配置

**Ubuntu/Debian:**
```bash
# 设置系统时区
sudo timedatectl set-timezone Asia/Shanghai

# 验证时区
timedatectl
```

**CentOS/RHEL:**
```bash
# 设置系统时区
sudo timedatectl set-timezone Asia/Shanghai

# 或使用传统方式
sudo ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
```

### 2. 数据库时区配置

#### SQLite

SQLite 使用系统时区，确保系统时区设置正确即可。

#### PostgreSQL

编辑 PostgreSQL 配置文件：

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

添加或修改：

```
timezone = 'Asia/Shanghai'
```

重启 PostgreSQL：

```bash
sudo systemctl restart postgresql
```

### 3. Docker 部署时区配置

在 `docker-compose.yml` 中添加时区配置：

```yaml
services:
  backend:
    environment:
      - TZ=Asia/Shanghai
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /etc/timezone:/etc/timezone:ro
  
  web-admin:
    environment:
      - TZ=Asia/Shanghai
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /etc/timezone:/etc/timezone:ro
```

### 4. PM2 部署时区配置

在 `ecosystem.config.js` 中添加：

```javascript
module.exports = {
  apps: [
    {
      name: 'nfc-backend',
      cwd: '/opt/door-lock/server',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Shanghai'  // 添加时区配置
      }
    },
    {
      name: 'nfc-web-admin',
      cwd: '/opt/door-lock/web-admin',
      script: 'server.js',
      env: {
        TZ: 'Asia/Shanghai'  // 添加时区配置
      }
    }
  ]
};
```

### 5. systemd 服务时区配置

在服务文件中添加环境变量：

```ini
[Service]
Environment="TZ=Asia/Shanghai"
```

完整示例：

```bash
sudo nano /etc/systemd/system/nfc-backend.service
```

```ini
[Unit]
Description=NFC Access Control Backend API
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/opt/door-lock/server
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=nfc-backend
Environment=NODE_ENV=production
Environment=TZ=Asia/Shanghai

[Install]
WantedBy=multi-user.target
```

## 验证时区配置

### 1. 检查系统时区

```bash
# Linux
date
timedatectl

# 应该显示 CST (China Standard Time) 或 +0800
```

### 2. 检查 Node.js 时区

```bash
node -e "console.log(new Date().toString())"
# 应该显示 GMT+0800 (中国标准时间)
```

### 3. 检查 API 返回时间

```bash
curl http://localhost:3000/health
```

返回的 `timestamp` 字段应该显示正确的UTC+8时间。

### 4. 检查数据库时间

**SQLite:**
```bash
sqlite3 server/data/access_control.db "SELECT datetime('now', 'localtime');"
```

**PostgreSQL:**
```sql
SELECT NOW();
SHOW TIMEZONE;
```

## 时间格式说明

### 数据库存储格式

```
YYYY-MM-DD HH:MM:SS
例如: 2024-01-15 14:30:00
```

数据库中存储的时间为 **UTC+8 本地时间**。

### API 返回格式

```json
{
  "timestamp": "2024-01-15T14:30:00.000+08:00"
}
```

API 返回的时间为 **ISO 8601 格式，带 +08:00 时区标记**。

### 前端显示格式

```
2024-01-15 14:30:00
```

前端显示为 **UTC+8 本地时间**。

## 常见问题

### Q1: 时间显示仍然不正确？

**解决方案：**

1. 重启服务：
```bash
pm2 restart all
# 或
sudo systemctl restart nfc-backend nfc-web-admin
```

2. 清除浏览器缓存并刷新页面

3. 检查服务器系统时区：
```bash
timedatectl
```

### Q2: Docker 容器中时间不正确？

**解决方案：**

确保 docker-compose.yml 中已添加时区配置：

```yaml
environment:
  - TZ=Asia/Shanghai
volumes:
  - /etc/localtime:/etc/localtime:ro
```

然后重启容器：
```bash
docker-compose down
docker-compose up -d
```

### Q3: 数据库中的旧数据时间不正确？

**解决方案：**

旧数据可能是UTC时间，需要批量更新：

**SQLite:**
```sql
-- 将UTC时间转换为UTC+8
UPDATE access_logs 
SET timestamp = datetime(timestamp, '+8 hours')
WHERE timestamp < '2024-01-15 00:00:00';
```

**PostgreSQL:**
```sql
-- 设置时区后重新解释时间
UPDATE access_logs 
SET timestamp = timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai'
WHERE timestamp < '2024-01-15 00:00:00';
```

### Q4: ESP32 设备时间不同步？

**解决方案：**

ESP32 固件会自动从 NTP 服务器同步时间。确保：

1. ESP32 能访问互联网
2. 固件中配置了正确的时区偏移（+8小时）

在 `esp32-firmware.ino` 中检查：

```cpp
configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
```

## 时区工具函数

项目提供了统一的时区工具函数（`server/src/utils/timezone.ts`）：

```typescript
import { 
  getCurrentTimeUTC8,
  toUTC8ISOString,
  formatDateForDB,
  formatDateForAPI 
} from './utils/timezone';

// 获取当前UTC+8时间
const now = getCurrentTimeUTC8();

// 转换为ISO字符串（带+08:00）
const isoString = toUTC8ISOString(now);

// 格式化为数据库格式
const dbFormat = formatDateForDB(now);

// 格式化为API响应格式
const apiFormat = formatDateForAPI(now);
```

## 最佳实践

1. **统一使用 UTC+8**：所有时间存储和显示都使用 UTC+8
2. **明确时区标记**：API 返回的时间字符串包含 `+08:00` 标记
3. **避免时区转换**：前后端都使用相同时区，避免转换错误
4. **使用工具函数**：使用项目提供的时区工具函数，确保一致性
5. **记录时区信息**：在日志中记录时区设置，便于排查问题

## 参考资料

- [Node.js 时区处理](https://nodejs.org/api/process.html#process_process_env)
- [Linux 时区配置](https://www.freedesktop.org/software/systemd/man/timedatectl.html)
- [ISO 8601 时间格式](https://en.wikipedia.org/wiki/ISO_8601)
- [中国标准时间 (CST)](https://en.wikipedia.org/wiki/China_Standard_Time)
