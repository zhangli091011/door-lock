# Web管理界面登录信息

## 访问地址

本地开发环境：http://localhost:8080

## 默认管理员账户

- **用户名**: `admin`
- **密码**: `admin123`

## 重要提示

⚠️ **生产环境部署前，请务必修改默认密码！**

### 修改密码步骤

1. 使用默认账户登录
2. 进入"系统设置"或"账户管理"
3. 修改密码为强密码（建议至少12位，包含大小写字母、数字和特殊字符）

### 服务器要求

- 后端API服务器必须运行在 `http://localhost:3000`
- 确保CORS配置允许来自 `http://localhost:8080` 的请求

### 启动服务器

```bash
# 进入server目录
cd server

# 安装依赖（首次运行）
npm install

# 启动服务器
npm start
```

### 启动Web管理界面

使用任何HTTP服务器托管web-admin目录，例如：

```bash
# 使用Python
python -m http.server 8080

# 或使用Node.js http-server
npx http-server -p 8080

# 或使用Live Server (VS Code扩展)
```

## 功能说明

- **实时状态**: 查看系统运行状态和统计信息
- **卡片管理**: 添加、编辑、删除NFC卡片
- **设备管理**: 管理ESP32门禁设备
- **访问日志**: 查看和筛选访问记录

## 技术支持

如有问题，请查看项目README.md或提交Issue。
