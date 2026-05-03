# NFC门禁管理系统 - Web管理前端

这是ESP32 NFC云门禁系统的Web管理前端，提供可视化的卡片和设备管理界面。

## 项目结构

```
web-admin/
├── index.html          # 主页面入口
├── css/
│   └── styles.css      # 自定义样式文件
├── js/
│   ├── api.js          # API客户端封装
│   ├── auth.js         # 认证逻辑
│   └── app.js          # 主应用逻辑
├── assets/             # 静态资源（图片、图标等）
└── README.md           # 本文档
```

## 技术栈

- **HTML5** - 页面结构
- **CSS3** - 样式设计
- **JavaScript (ES6+)** - 应用逻辑
- **Bootstrap 5** - UI框架
- **Bootstrap Icons** - 图标库
- **Axios** - HTTP请求库

## 功能特性

### 1. 用户认证
- 登录/登出功能
- JWT令牌管理
- 自动登录检查
- 令牌过期自动跳转

### 2. 实时状态监控
- 在线设备数量统计
- 启用卡片数量统计
- 今日访问次数统计
- 最近访问记录（自动刷新）

### 3. 卡片管理
- 卡片列表查看
- 添加新卡片
- 编辑卡片信息
- 删除卡片
- 启用/禁用卡片
- 搜索和筛选功能

### 4. 设备管理
- 设备列表查看
- 注册新设备
- 编辑设备信息
- 设备在线状态显示
- API Key管理

### 5. 访问日志
- 访问记录查看
- 多条件筛选（设备、卡片、时间、结果）
- 分页显示
- 日志导出（可选）

## 快速开始

### 1. 配置后端API地址

编辑 `js/api.js` 文件，修改API基础URL：

```javascript
const API_CONFIG = {
    baseURL: 'http://your-server-ip:3000/api',  // 修改为你的服务器地址
    timeout: 10000,
};
```

### 2. 部署方式

#### 方式一：直接使用（开发环境）

直接在浏览器中打开 `index.html` 文件即可使用。

**注意**：由于浏览器的CORS限制，建议使用本地HTTP服务器：

```bash
# 使用Python启动简单HTTP服务器
python -m http.server 8080

# 或使用Node.js的http-server
npx http-server -p 8080
```

然后访问：`http://localhost:8080`

#### 方式二：Nginx部署（生产环境）

将 `web-admin` 目录复制到Nginx的网站根目录：

```bash
sudo cp -r web-admin /var/www/html/
```

配置Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/html/web-admin;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API代理（可选）
    location /api {
        proxy_pass http://localhost:3000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

重启Nginx：

```bash
sudo systemctl restart nginx
```

#### 方式三：Docker部署

在项目根目录的 `docker-compose.yml` 中已包含Nginx配置，直接运行：

```bash
docker-compose up -d
```

### 3. 默认登录凭据

- 用户名：`admin`
- 密码：`admin123`

**重要**：首次登录后请立即修改默认密码！

## API接口说明

### 认证接口

- `POST /api/auth/login` - 用户登录

### 卡片管理接口

- `GET /api/cards` - 获取卡片列表
- `POST /api/cards` - 添加新卡片
- `PUT /api/cards/:uid` - 更新卡片
- `DELETE /api/cards/:uid` - 删除卡片

### 设备管理接口

- `GET /api/devices` - 获取设备列表
- `POST /api/devices` - 注册新设备
- `PUT /api/devices/:deviceId` - 更新设备

### 日志接口

- `GET /api/logs` - 获取访问日志
- `GET /api/status` - 获取实时状态

详细API文档请参考后端服务的API文档。

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 响应式设计

本系统支持响应式设计，可在以下设备上正常使用：

- 桌面电脑（1920x1080及以上）
- 笔记本电脑（1366x768及以上）
- 平板电脑（768x1024）
- 手机（375x667及以上）

## 安全注意事项

1. **HTTPS部署**：生产环境必须使用HTTPS加密通信
2. **JWT令牌**：令牌存储在localStorage中，有效期24小时
3. **XSS防护**：所有用户输入都经过HTML转义处理
4. **CORS配置**：后端需正确配置CORS允许的域名
5. **密码强度**：建议使用强密码并定期更换

## 开发说明

### 添加新页面

1. 在 `app.js` 中添加新的页面加载函数：

```javascript
loadNewPage: () => {
    const content = document.getElementById('pageContent');
    content.innerHTML = `
        <!-- 页面HTML内容 -->
    `;
    // 加载数据
    App.loadNewPageData();
},
```

2. 在侧边栏添加导航链接：

```html
<li class="nav-item">
    <a class="nav-link" href="#" data-page="newpage">
        <i class="bi bi-icon"></i> 新页面
    </a>
</li>
```

### 添加新API接口

在 `api.js` 中添加新的API方法：

```javascript
API.newMethod = async (params) => {
    const response = await apiClient.get('/new-endpoint', { params });
    return response.data;
};
```

## 故障排查

### 问题1：无法登录

- 检查后端服务是否正常运行
- 检查API地址配置是否正确
- 检查浏览器控制台是否有CORS错误
- 检查网络连接是否正常

### 问题2：页面显示异常

- 清除浏览器缓存
- 检查浏览器控制台是否有JavaScript错误
- 确认Bootstrap和Axios CDN链接可访问

### 问题3：数据不刷新

- 检查API接口是否返回正确数据
- 检查浏览器控制台网络请求
- 尝试手动刷新页面

## 后续开发计划

- [ ] 实现卡片添加/编辑/删除模态框（任务13.3）
- [ ] 实现设备添加/编辑模态框（任务13.4）
- [ ] 实现日志导出功能（任务13.5）
- [ ] 添加图表统计功能
- [ ] 添加实时WebSocket推送
- [ ] 添加多语言支持
- [ ] 添加暗黑模式

## 许可证

本项目采用MIT许可证。详见项目根目录的LICENSE文件。

## 联系方式

如有问题或建议，请提交Issue或Pull Request。
