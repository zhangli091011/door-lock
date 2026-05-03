# Web管理界面API配置说明

## 问题诊断

如果你看到 `501 Unsupported method` 或 `404 Not Found` 错误，说明API配置不正确。

## 配置方式

### 方式一：使用Nginx代理（推荐）

这是最简单和推荐的方式。Web界面和API通过同一个域名访问。

**Nginx配置示例：**

```nginx
server {
    listen 8080;
    server_name 49.235.143.45;
    
    # Web管理界面
    location / {
        root /var/www/nfc-access/web-admin;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API代理到后端服务
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**部署步骤：**

```bash
# 1. 复制web-admin到nginx目录
sudo mkdir -p /var/www/nfc-access
sudo cp -r web-admin /var/www/nfc-access/

# 2. 配置nginx（参考上面的配置）
sudo nano /etc/nginx/sites-available/nfc-access

# 3. 启用配置
sudo ln -s /etc/nginx/sites-available/nfc-access /etc/nginx/sites-enabled/

# 4. 测试配置
sudo nginx -t

# 5. 重载nginx
sudo systemctl reload nginx

# 6. 确保后端API运行在3000端口
# 检查：curl http://localhost:3000/health
```

**访问地址：**
- Web界面：http://49.235.143.45:8080
- API会自动通过nginx代理到 http://49.235.143.45:8080/api

### 方式二：直接指定API地址

如果你不想使用nginx代理，可以直接指定API地址。

**在 `index.html` 的 `<head>` 部分添加：**

```html
<script>
    // 设置API基础URL
    window.API_BASE_URL = 'http://49.235.143.45:3000/api';
</script>
```

**注意事项：**
1. 确保后端API的CORS配置允许来自 `http://49.235.143.45:8080` 的请求
2. 需要在 `server/.env` 中添加：
   ```
   ALLOWED_ORIGINS=http://49.235.143.45:8080,http://49.235.143.45:3000
   ```
3. 重启后端服务

### 方式三：修改api.js源代码

直接修改 `web-admin/js/api.js` 文件：

```javascript
const API_CONFIG = {
    baseURL: 'http://49.235.143.45:3000/api',  // 直接指定API地址
    timeout: 10000,
};
```

## 当前配置逻辑

`api.js` 会按以下优先级选择API地址：

1. **本地开发**：如果访问 `localhost` 或 `127.0.0.1`，使用 `http://localhost:3000/api`
2. **自定义配置**：如果设置了 `window.API_BASE_URL`，使用该地址
3. **相对路径**：使用 `/api`（需要nginx代理）

## 验证配置

### 1. 检查后端API是否运行

```bash
# 在服务器上执行
curl http://localhost:3000/health

# 应该返回：
# {"status":"ok","timestamp":"...","uptime":123.456,"environment":"production"}
```

### 2. 检查nginx配置

```bash
# 测试nginx配置
sudo nginx -t

# 查看nginx是否运行
sudo systemctl status nginx

# 测试API代理
curl http://49.235.143.45:8080/api/health
```

### 3. 检查防火墙

```bash
# 确保端口开放
sudo ufw status

# 如果需要开放端口
sudo ufw allow 8080
sudo ufw allow 3000  # 如果直接访问API
```

### 4. 浏览器测试

打开浏览器控制台（F12），在Console中执行：

```javascript
// 查看当前API配置
console.log('API Base URL:', API_CONFIG.baseURL);

// 测试API连接
fetch(API_CONFIG.baseURL.replace('/api', '/health'))
    .then(r => r.json())
    .then(data => console.log('API Health:', data))
    .catch(err => console.error('API Error:', err));
```

## 常见错误和解决方案

### 错误1: 501 Unsupported method

**原因**：请求到达了错误的服务器或nginx配置不正确

**解决方案**：
1. 检查nginx是否正确配置了 `/api/` 代理
2. 确保后端API服务正在运行
3. 检查nginx错误日志：`sudo tail -f /var/log/nginx/error.log`

### 错误2: CORS错误

**原因**：后端API的CORS配置不允许来自当前域名的请求

**解决方案**：
编辑 `server/.env`：
```bash
ALLOWED_ORIGINS=http://49.235.143.45:8080,http://49.235.143.45:3000
```

重启API服务：
```bash
docker-compose restart api
# 或
npm restart
```

### 错误3: 404 Not Found

**原因**：API路径不正确或nginx没有正确代理

**解决方案**：
1. 检查nginx配置中的 `proxy_pass` 路径
2. 确保使用 `proxy_pass http://localhost:3000/api/;`（注意末尾的斜杠）
3. 重载nginx：`sudo systemctl reload nginx`

### 错误4: Connection refused

**原因**：后端API服务未运行

**解决方案**：
```bash
# 检查API服务状态
docker-compose ps
# 或
ps aux | grep node

# 启动API服务
docker-compose up -d api
# 或
cd server && npm start
```

## 推荐配置（生产环境）

```
架构：
Internet → Nginx (8080) → 
    ├─ /      → Web静态文件 (/var/www/nfc-access/web-admin)
    └─ /api/  → 后端API (localhost:3000)

优点：
✓ 单一入口，简化配置
✓ 无需处理CORS
✓ 便于SSL配置
✓ 更好的安全性
```

**完整nginx配置：**

```nginx
server {
    listen 8080;
    server_name 49.235.143.45;
    
    # 日志
    access_log /var/log/nginx/nfc-access.log;
    error_log /var/log/nginx/nfc-access-error.log;
    
    # Web管理界面
    location / {
        root /var/www/nfc-access/web-admin;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

## 快速修复脚本

创建并运行此脚本来快速配置：

```bash
#!/bin/bash
# quick-setup.sh

echo "=== NFC门禁系统快速配置 ==="

# 1. 复制web文件
echo "1. 复制Web文件..."
sudo mkdir -p /var/www/nfc-access
sudo cp -r web-admin /var/www/nfc-access/
sudo chown -R www-data:www-data /var/www/nfc-access

# 2. 创建nginx配置
echo "2. 创建Nginx配置..."
sudo tee /etc/nginx/sites-available/nfc-access > /dev/null <<'EOF'
server {
    listen 8080;
    server_name 49.235.143.45;
    
    location / {
        root /var/www/nfc-access/web-admin;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# 3. 启用配置
echo "3. 启用Nginx配置..."
sudo ln -sf /etc/nginx/sites-available/nfc-access /etc/nginx/sites-enabled/

# 4. 测试nginx
echo "4. 测试Nginx配置..."
sudo nginx -t

# 5. 重载nginx
echo "5. 重载Nginx..."
sudo systemctl reload nginx

# 6. 检查API服务
echo "6. 检查API服务..."
curl -s http://localhost:3000/health | jq .

echo ""
echo "=== 配置完成 ==="
echo "访问地址: http://49.235.143.45:8080"
echo "默认账户: admin / admin123"
```

运行：
```bash
chmod +x quick-setup.sh
sudo ./quick-setup.sh
```

## 技术支持

如果仍有问题，请提供以下信息：

1. 浏览器控制台的完整错误信息
2. Nginx错误日志：`sudo tail -50 /var/log/nginx/error.log`
3. API服务状态：`docker-compose ps` 或 `ps aux | grep node`
4. API健康检查：`curl http://localhost:3000/health`
5. 当前访问的URL
