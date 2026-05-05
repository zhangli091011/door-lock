# 时区问题快速修复指南

如果你的系统显示时间比实际时间早8小时，按照以下步骤快速修复。

## 快速修复步骤

### 1. 停止所有服务

```bash
# 如果使用PM2
pm2 stop all

# 如果使用systemd
sudo systemctl stop nfc-backend nfc-web-admin
```

### 2. 设置系统时区

```bash
# 设置为中国标准时间
sudo timedatectl set-timezone Asia/Shanghai

# 验证时区
timedatectl
date
```

应该看到类似输出：
```
Time zone: Asia/Shanghai (CST, +0800)
Local time: 2024-01-15 14:30:00 CST
```

### 3. 更新代码

```bash
cd /opt/door-lock
git pull
```

### 4. 更新环境变量

```bash
# 编辑后端配置
nano server/.env
```

添加或确认这一行：
```env
TZ=Asia/Shanghai
```

### 5. 重启服务

```bash
# 如果使用PM2
pm2 restart all

# 如果使用systemd
sudo systemctl restart nfc-backend nfc-web-admin
```

### 6. 清除浏览器缓存

在浏览器中：
1. 按 `Ctrl + Shift + Delete`
2. 选择"缓存的图片和文件"
3. 点击"清除数据"
4. 刷新页面 (`Ctrl + F5`)

## 验证修复

### 1. 检查API时间

```bash
curl http://localhost:3000/health
```

返回的 `timestamp` 应该是当前正确时间。

### 2. 检查Web界面

打开 `http://your-server-ip:8080`，查看访问日志的时间是否正确。

## 如果问题仍然存在

### 方案A：手动设置环境变量

```bash
# 编辑PM2配置
nano /opt/door-lock/ecosystem.config.js
```

确保包含：
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
        TZ: 'Asia/Shanghai'  // 确保这一行存在
      }
    }
  ]
};
```

```bash
# 重新加载配置
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

### 方案B：修改systemd服务

```bash
# 编辑后端服务
sudo nano /etc/systemd/system/nfc-backend.service
```

确保包含：
```ini
[Service]
Environment=TZ=Asia/Shanghai
```

```bash
# 重新加载并重启
sudo systemctl daemon-reload
sudo systemctl restart nfc-backend nfc-web-admin
```

### 方案C：Docker环境

如果使用Docker，编辑 `docker-compose.yml`：

```yaml
services:
  backend:
    environment:
      - TZ=Asia/Shanghai
    volumes:
      - /etc/localtime:/etc/localtime:ro
```

```bash
# 重启容器
docker-compose down
docker-compose up -d
```

## 数据库中旧数据的时间修正

如果数据库中已有数据，时间可能需要修正：

### SQLite

```bash
sqlite3 /opt/door-lock/server/data/access_control.db
```

```sql
-- 查看当前时间
SELECT datetime('now', 'localtime');

-- 如果旧数据是UTC时间，需要加8小时
-- 备份数据库后执行：
UPDATE access_logs 
SET timestamp = datetime(timestamp, '+8 hours')
WHERE timestamp < '2024-01-15 00:00:00';

-- 退出
.quit
```

### PostgreSQL

```bash
sudo -u postgres psql access_control
```

```sql
-- 查看当前时区
SHOW TIMEZONE;

-- 设置时区
SET TIMEZONE='Asia/Shanghai';

-- 如果需要修正旧数据
UPDATE access_logs 
SET timestamp = timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai'
WHERE timestamp < '2024-01-15 00:00:00';
```

## 预防措施

### 1. 在部署时就设置时区

```bash
# 系统级
sudo timedatectl set-timezone Asia/Shanghai

# 用户级（添加到 ~/.bashrc）
echo 'export TZ=Asia/Shanghai' >> ~/.bashrc
source ~/.bashrc
```

### 2. 使用统一的启动脚本

项目提供的启动脚本已包含时区设置：

```bash
# 使用项目提供的脚本
./start-backend.sh
./start-web-admin.sh
```

### 3. 监控时区配置

添加健康检查：

```bash
# 创建检查脚本
cat > /opt/door-lock/check-timezone.sh << 'EOF'
#!/bin/bash
echo "系统时区: $(timedatectl | grep 'Time zone')"
echo "当前时间: $(date)"
echo "Node.js时区: $(node -e "console.log(new Date().toString())")"
EOF

chmod +x /opt/door-lock/check-timezone.sh

# 运行检查
./check-timezone.sh
```

## 常见错误

### 错误1: "时间仍然差8小时"

**原因**: 浏览器缓存了旧的JavaScript文件

**解决**: 强制刷新浏览器 (`Ctrl + Shift + R` 或 `Ctrl + F5`)

### 错误2: "PM2重启后时区恢复"

**原因**: PM2配置中没有保存TZ环境变量

**解决**: 使用 `ecosystem.config.js` 并执行 `pm2 save`

### 错误3: "Docker容器时区不对"

**原因**: 容器没有挂载主机时区文件

**解决**: 在docker-compose.yml中添加volume挂载

## 技术支持

如果以上方法都无法解决问题，请：

1. 收集以下信息：
```bash
# 系统信息
uname -a
timedatectl
date

# Node.js时区
node -e "console.log(process.env.TZ)"
node -e "console.log(new Date().toString())"

# 服务状态
pm2 list
pm2 logs nfc-backend --lines 50
```

2. 提交Issue到GitHub，附上上述信息

3. 或查看完整文档：`TIMEZONE_CONFIG.md`
