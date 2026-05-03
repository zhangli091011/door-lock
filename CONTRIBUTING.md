# 贡献指南

感谢你对ESP32 NFC云门禁系统的关注！我们欢迎所有形式的贡献。

## 如何贡献

### 报告Bug

如果你发现了Bug，请在GitHub上创建Issue，并包含以下信息：

- **Bug描述**：清晰简洁地描述问题
- **复现步骤**：详细的复现步骤
- **期望行为**：你期望发生什么
- **实际行为**：实际发生了什么
- **环境信息**：
  - 操作系统和版本
  - Node.js版本
  - ESP32固件版本
  - 浏览器版本（如果是前端问题）
- **截图或日志**：如果适用，添加截图或错误日志

### 提出新功能

如果你有新功能的想法，请先创建Issue讨论：

- **功能描述**：清晰描述新功能
- **使用场景**：为什么需要这个功能
- **实现建议**：如果有，提供实现思路

### 提交代码

1. **Fork仓库**

   点击GitHub页面右上角的"Fork"按钮

2. **克隆你的Fork**

   ```bash
   git clone https://github.com/your-username/esp32-nfc-cloud-access-control.git
   cd esp32-nfc-cloud-access-control
   ```

3. **创建特性分支**

   ```bash
   git checkout -b feature/your-feature-name
   ```

   分支命名规范：
   - `feature/xxx` - 新功能
   - `bugfix/xxx` - Bug修复
   - `docs/xxx` - 文档更新
   - `refactor/xxx` - 代码重构

4. **进行修改**

   - 遵循项目的代码规范
   - 添加必要的测试
   - 更新相关文档

5. **提交更改**

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   提交信息规范（遵循Conventional Commits）：
   - `feat:` - 新功能
   - `fix:` - Bug修复
   - `docs:` - 文档更新
   - `style:` - 代码格式调整
   - `refactor:` - 代码重构
   - `test:` - 测试相关
   - `chore:` - 构建/工具相关

6. **推送到你的Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

7. **创建Pull Request**

   - 在GitHub上打开你的Fork
   - 点击"New Pull Request"
   - 填写PR描述，说明你的更改
   - 等待代码审查

## 代码规范

### TypeScript/JavaScript

- 使用ESLint和Prettier进行代码格式化
- 运行 `npm run lint` 检查代码规范
- 运行 `npm run format` 格式化代码
- 使用TypeScript类型注解
- 避免使用`any`类型

### Arduino C++

- 遵循Arduino代码风格
- 使用有意义的变量名
- 添加必要的注释
- 避免使用全局变量

### 命名规范

- **文件名**：使用kebab-case（如：`access-controller.ts`）
- **类名**：使用PascalCase（如：`AccessController`）
- **函数名**：使用camelCase（如：`checkCardAccess`）
- **常量**：使用UPPER_SNAKE_CASE（如：`API_TIMEOUT`）

## 测试

### 运行测试

```bash
# 后端测试
cd server
npm test

# 测试覆盖率
npm run test:coverage

# 监听模式
npm run test:watch
```

### 编写测试

- 为新功能添加单元测试
- 为Bug修复添加回归测试
- 确保测试覆盖率不降低
- 使用描述性的测试名称

示例：

```typescript
describe('AccessControlService', () => {
  describe('checkCardAccess', () => {
    it('should allow access for enabled card', async () => {
      // 测试代码
    });

    it('should deny access for disabled card', async () => {
      // 测试代码
    });
  });
});
```

## 文档

- 更新相关的README和文档
- 为新功能添加使用示例
- 更新API文档
- 保持文档与代码同步

## Pull Request检查清单

在提交PR之前，请确保：

- [ ] 代码通过所有测试
- [ ] 代码通过Lint检查
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 提交信息遵循规范
- [ ] PR描述清晰完整
- [ ] 没有合并冲突

## 代码审查

- 所有PR都需要至少一个维护者的审查
- 请耐心等待审查反馈
- 根据反馈进行必要的修改
- 保持友好和专业的沟通

## 行为准则

### 我们的承诺

为了营造开放和友好的环境，我们承诺：

- 尊重不同的观点和经验
- 接受建设性的批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化的语言或图像
- 人身攻击或侮辱性评论
- 公开或私下骚扰
- 未经许可发布他人的私人信息
- 其他不道德或不专业的行为

## 许可证

通过贡献代码，你同意你的贡献将在MIT许可证下发布。

## 问题？

如果你有任何问题，可以：

- 在GitHub上创建Issue
- 发送邮件至：your-email@example.com

感谢你的贡献！
