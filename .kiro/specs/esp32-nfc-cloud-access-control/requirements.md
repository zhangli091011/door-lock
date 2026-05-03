# 需求文档：ESP32 NFC 云门禁系统

## 引言

ESP32 NFC 云门禁系统是一个基于物联网技术的智能门禁解决方案，旨在为家庭、办公室和小型企业提供安全、可靠、易于管理的门禁控制系统。系统通过ESP32-S3微控制器读取NFC卡片，与云端服务器通信验证权限，并控制磁力锁实现门禁管理。系统支持离线缓存机制，确保在网络故障时仍能正常工作，同时提供Web管理界面方便管理员进行卡片和设备管理。

## 术语表

- **ESP32_Client**: ESP32-S3硬件客户端，负责NFC读取、网络通信和门锁控制
- **PN532_Module**: NFC读卡模块，通过I2C接口与ESP32通信
- **Cloud_API**: 云端后端服务，提供权限验证、设备管理和日志记录功能
- **Web_Admin**: Web管理前端，提供可视化的卡片和设备管理界面
- **Database**: 数据库服务，存储卡片信息、设备信息和访问日志
- **Relay**: 继电器模块，控制磁力锁的通断电
- **Magnetic_Lock**: 磁力锁，通过继电器NC端子控制
- **Local_Cache**: ESP32本地缓存，存储最近验证通过的卡片信息
- **API_Key**: 设备专用认证密钥，用于API请求认证
- **Secret_Key**: 设备专用签名密钥，用于请求签名计算
- **UID**: NFC卡片唯一标识符，8-14位十六进制字符串
- **Access_Log**: 访问日志记录，包含刷卡时间、卡片UID、设备ID和验证结果

## 需求

### 需求 1: NFC卡片读取

**用户故事**: 作为用户，我想通过刷NFC卡片来请求门禁访问，以便快速便捷地进入受控区域。

#### 验收标准

1. WHEN 用户将NFC卡片靠近PN532感应区 THEN THE ESP32_Client SHALL 在500毫秒内读取卡片UID
2. WHEN 成功读取卡片UID THEN THE ESP32_Client SHALL 通过蜂鸣器发出短鸣提示
3. WHEN 读取到的UID长度在8-14位十六进制字符范围内 THEN THE ESP32_Client SHALL 接受该UID作为有效输入
4. WHEN PN532_Module 初始化失败 THEN THE ESP32_Client SHALL 记录错误日志并进入故障模式
5. WHEN 连续读取失败超过3次 THEN THE ESP32_Client SHALL 尝试重新初始化PN532_Module

### 需求 2: 云端权限验证

**用户故事**: 作为系统管理员,我想通过云端服务器集中管理所有门禁权限,以便实时控制访问权限并记录所有访问行为。

#### 验收标准

1. WHEN ESP32_Client 读取到卡片UID THEN THE ESP32_Client SHALL 向Cloud_API发送权限验证请求
2. WHEN 发送验证请求 THEN THE ESP32_Client SHALL 在请求中包含UID、设备ID、时间戳和HMAC-SHA256签名
3. WHEN Cloud_API 收到验证请求 THEN THE Cloud_API SHALL 验证API_Key和请求签名的有效性
4. WHEN 签名验证通过 THEN THE Cloud_API SHALL 查询Database获取卡片权限信息
5. WHEN 卡片存在且启用 THEN THE Cloud_API SHALL 检查访问时间段和设备权限
6. WHEN 所有权限检查通过 THEN THE Cloud_API SHALL 返回allow=true并记录访问日志
7. WHEN 任何权限检查失败 THEN THE Cloud_API SHALL 返回allow=false和拒绝原因并记录访问日志
8. WHEN 请求时间戳与服务器时间差超过5分钟 THEN THE Cloud_API SHALL 拒绝请求并返回401错误
9. WHEN API请求超时超过5秒 THEN THE ESP32_Client SHALL 终止请求并切换到本地缓存验证

### 需求 3: 本地缓存机制

**用户故事**: 作为用户,我想在网络故障时仍能使用门禁系统,以便确保门禁系统的可靠性和可用性。

#### 验收标准

1. WHEN Cloud_API 返回cacheable=true THEN THE ESP32_Client SHALL 将卡片UID和验证结果存储到Local_Cache
2. WHEN Local_Cache 已满 THEN THE ESP32_Client SHALL 删除最旧的缓存条目
3. WHEN 网络连接失败或API请求超时 THEN THE ESP32_Client SHALL 查询Local_Cache进行验证
4. WHEN Local_Cache 中存在该UID且未过期 THEN THE ESP32_Client SHALL 使用缓存结果决定是否开门
5. WHEN 缓存条目创建时间超过24小时 THEN THE ESP32_Client SHALL 将该条目标记为过期
6. WHEN 使用缓存验证 THEN THE ESP32_Client SHALL 通过蜂鸣器短鸣2次提示离线模式
7. THE Local_Cache SHALL 最多存储50个卡片条目

### 需求 4: 门锁控制

**用户故事**: 作为用户,我想在权限验证通过后自动开门,以便无需手动操作即可进入。

#### 验收标准

1. WHEN 权限验证返回allow=true THEN THE ESP32_Client SHALL 将继电器GPIO引脚设置为LOW
2. WHEN 继电器GPIO引脚为LOW THEN THE Relay SHALL 断开NC端子使Magnetic_Lock断电
3. WHEN Magnetic_Lock 断电 THEN THE Magnetic_Lock SHALL 释放锁定状态
4. WHEN 门锁打开 THEN THE ESP32_Client SHALL 通过蜂鸣器长鸣1次提示成功
5. WHEN 门锁打开持续3秒 THEN THE ESP32_Client SHALL 将继电器GPIO引脚设置为HIGH重新锁门
6. WHEN 权限验证返回allow=false THEN THE ESP32_Client SHALL 保持继电器GPIO引脚为HIGH
7. WHEN 权限拒绝 THEN THE ESP32_Client SHALL 通过蜂鸣器短鸣3次提示失败

### 需求 5: 出门按钮功能

**用户故事**: 作为用户,我想通过按钮从内部开门,以便无需刷卡即可离开受控区域。

#### 验收标准

1. WHEN 用户按下出门按钮 THEN THE ESP32_Client SHALL 检测到GPIO6引脚电平变化
2. WHEN 检测到按钮按下 THEN THE ESP32_Client SHALL 立即打开门锁持续3秒
3. WHEN 通过按钮开门 THEN THE ESP32_Client SHALL 记录本地日志标记为"出门按钮触发"
4. WHEN 按钮开门 THEN THE ESP32_Client SHALL 通过蜂鸣器短鸣1次确认

### 需求 6: 卡片管理

**用户故事**: 作为系统管理员,我想通过Web界面添加、修改和删除卡片,以便灵活管理门禁权限。

#### 验收标准

1. WHEN 管理员提交添加卡片请求 THEN THE Cloud_API SHALL 验证UID格式和唯一性
2. WHEN UID格式有效且不存在 THEN THE Cloud_API SHALL 在Database中创建新卡片记录
3. WHEN 管理员提交更新卡片请求 THEN THE Cloud_API SHALL 更新Database中对应的卡片信息
4. WHEN 管理员提交删除卡片请求 THEN THE Cloud_API SHALL 从Database中删除对应的卡片记录
5. WHEN 管理员禁用卡片 THEN THE Cloud_API SHALL 将卡片enabled字段设置为false
6. WHEN 卡片被禁用 THEN THE Cloud_API SHALL 在后续验证请求中拒绝该卡片访问
7. WHEN 管理员设置访问时间段 THEN THE Cloud_API SHALL 验证时间段格式并存储为JSON数组
8. WHEN 管理员设置允许设备列表 THEN THE Cloud_API SHALL 验证设备ID存在性并存储为JSON数组

### 需求 7: 设备管理

**用户故事**: 作为系统管理员,我想注册和管理多个门禁设备,以便支持多门禁点的统一管理。

#### 验收标准

1. WHEN 管理员提交注册设备请求 THEN THE Cloud_API SHALL 生成唯一的API_Key和Secret_Key
2. WHEN 设备注册成功 THEN THE Cloud_API SHALL 返回API_Key供ESP32_Client配置使用
3. WHEN 设备发送API请求 THEN THE Cloud_API SHALL 更新该设备的last_seen时间戳
4. WHEN 设备超过5分钟未发送请求 THEN THE Web_Admin SHALL 将设备状态显示为离线
5. WHEN 管理员禁用设备 THEN THE Cloud_API SHALL 拒绝该设备的所有API请求
6. WHEN 管理员更新设备信息 THEN THE Cloud_API SHALL 更新Database中对应的设备记录

### 需求 8: 访问日志记录

**用户故事**: 作为系统管理员,我想查看所有门禁访问记录,以便审计和追溯访问行为。

#### 验收标准

1. WHEN Cloud_API 处理权限验证请求 THEN THE Cloud_API SHALL 在Database中创建访问日志记录
2. WHEN 创建访问日志 THEN THE Access_Log SHALL 包含UID、设备ID、时间戳、验证结果和验证来源
3. WHEN 权限验证失败 THEN THE Access_Log SHALL 包含拒绝原因
4. WHEN 管理员查询访问日志 THEN THE Cloud_API SHALL 支持按设备ID、UID、时间范围和验证结果筛选
5. WHEN 管理员查询访问日志 THEN THE Cloud_API SHALL 支持分页返回结果
6. WHEN 访问日志超过3个月 THEN THE Database SHALL 自动归档或删除旧日志

### 需求 9: Web管理界面

**用户故事**: 作为系统管理员,我想通过Web浏览器管理门禁系统,以便随时随地进行管理操作。

#### 验收标准

1. WHEN 管理员访问Web管理界面 THEN THE Web_Admin SHALL 要求输入用户名和密码
2. WHEN 管理员登录成功 THEN THE Web_Admin SHALL 生成JWT令牌并存储在浏览器
3. WHEN JWT令牌过期 THEN THE Web_Admin SHALL 自动跳转到登录页面
4. WHEN 管理员访问卡片管理页面 THEN THE Web_Admin SHALL 显示所有卡片列表并支持搜索和筛选
5. WHEN 管理员访问设备管理页面 THEN THE Web_Admin SHALL 显示所有设备列表和在线状态
6. WHEN 管理员访问日志查看页面 THEN THE Web_Admin SHALL 显示最近的访问记录并支持实时刷新
7. WHEN 管理员访问实时状态页面 THEN THE Web_Admin SHALL 显示系统统计信息和最近刷卡记录
8. THE Web_Admin SHALL 支持响应式设计适配移动设备浏览器

### 需求 10: API安全认证

**用户故事**: 作为系统架构师,我想确保所有API请求都经过认证和签名验证,以便防止未授权访问和请求伪造。

#### 验收标准

1. WHEN ESP32_Client 发送API请求 THEN THE ESP32_Client SHALL 在请求头中包含X-API-Key和X-Device-ID
2. WHEN Cloud_API 收到API请求 THEN THE Cloud_API SHALL 验证API_Key与设备ID的对应关系
3. WHEN API_Key验证失败 THEN THE Cloud_API SHALL 返回401 Unauthorized错误
4. WHEN ESP32_Client 发送API请求 THEN THE ESP32_Client SHALL 使用HMAC-SHA256算法生成请求签名
5. WHEN Cloud_API 收到API请求 THEN THE Cloud_API SHALL 使用设备Secret_Key重新计算签名并比对
6. WHEN 签名验证失败 THEN THE Cloud_API SHALL 返回401 Unauthorized错误并记录安全日志
7. WHEN Web_Admin 发送API请求 THEN THE Web_Admin SHALL 在请求头中包含Bearer Token
8. WHEN Cloud_API 收到Web请求 THEN THE Cloud_API SHALL 验证JWT令牌的有效性和过期时间

### 需求 11: 速率限制

**用户故事**: 作为系统架构师,我想限制API请求频率,以便防止DDoS攻击和资源滥用。

#### 验收标准

1. WHEN 单个设备每分钟请求超过60次 THEN THE Cloud_API SHALL 返回429 Too Many Requests错误
2. WHEN 单个IP地址每分钟请求超过100次 THEN THE Cloud_API SHALL 返回429 Too Many Requests错误
3. WHEN 触发速率限制 THEN THE Cloud_API SHALL 记录安全日志包含设备ID和IP地址
4. WHEN 速率限制触发 THEN THE Cloud_API SHALL 在响应头中包含Retry-After字段

### 需求 12: 时间段权限控制

**用户故事**: 作为系统管理员,我想为卡片设置允许访问的时间段,以便实现更精细的权限控制。

#### 验收标准

1. WHEN 管理员为卡片设置时间段 THEN THE Cloud_API SHALL 验证时间段格式为"HH:MM-HH:MM"
2. WHEN 卡片设置了时间段限制 THEN THE Cloud_API SHALL 检查当前时间是否在允许的时间段内
3. WHEN 当前时间不在允许时间段内 THEN THE Cloud_API SHALL 返回allow=false和拒绝原因"不在允许时间段内"
4. WHEN 卡片未设置时间段限制 THEN THE Cloud_API SHALL 允许全天24小时访问

### 需求 13: 设备权限控制

**用户故事**: 作为系统管理员,我想为卡片指定允许访问的设备,以便实现不同门禁点的差异化权限管理。

#### 验收标准

1. WHEN 管理员为卡片设置允许设备列表 THEN THE Cloud_API SHALL 验证设备ID的存在性
2. WHEN 卡片设置了设备限制 THEN THE Cloud_API SHALL 检查请求设备ID是否在允许列表中
3. WHEN 请求设备ID不在允许列表中 THEN THE Cloud_API SHALL 返回allow=false和拒绝原因"不允许访问此设备"
4. WHEN 卡片未设置设备限制 THEN THE Cloud_API SHALL 允许访问所有设备

### 需求 14: WiFi连接管理

**用户故事**: 作为用户,我想ESP32能够自动连接WiFi并在断线后重连,以便确保系统的网络连接稳定性。

#### 验收标准

1. WHEN ESP32_Client 启动 THEN THE ESP32_Client SHALL 尝试连接配置的WiFi网络
2. WHEN WiFi连接成功 THEN THE ESP32_Client SHALL 通过串口输出IP地址
3. WHEN WiFi连接失败 THEN THE ESP32_Client SHALL 每10秒重试一次连接
4. WHEN WiFi连接断开 THEN THE ESP32_Client SHALL 自动尝试重新连接
5. WHEN WiFi重连成功 THEN THE ESP32_Client SHALL 从离线模式切换回云端验证模式

### 需求 15: 数据库初始化

**用户故事**: 作为系统部署人员,我想通过脚本自动初始化数据库,以便快速部署系统。

#### 验收标准

1. WHEN 执行数据库初始化脚本 THEN THE Database SHALL 创建cards、devices、access_logs和admins表
2. WHEN 创建数据库表 THEN THE Database SHALL 创建必要的索引以优化查询性能
3. WHEN 初始化数据库 THEN THE Database SHALL 插入默认管理员账户
4. WHEN 初始化数据库 THEN THE Database SHALL 支持SQLite和PostgreSQL两种数据库

### 需求 16: HTTPS加密通信

**用户故事**: 作为系统架构师,我想在生产环境中使用HTTPS加密通信,以便保护数据传输安全。

#### 验收标准

1. WHEN 部署到生产环境 THEN THE Cloud_API SHALL 仅接受HTTPS请求
2. WHEN 配置HTTPS THEN THE Cloud_API SHALL 使用有效的SSL证书
3. WHEN SSL证书即将过期 THEN THE Cloud_API SHALL 自动续期证书
4. WHEN 部署到开发环境 THEN THE Cloud_API SHALL 支持HTTP请求用于本地测试

### 需求 17: 错误处理和日志记录

**用户故事**: 作为系统维护人员,我想系统能够记录详细的错误日志,以便快速定位和解决问题。

#### 验收标准

1. WHEN ESP32_Client 发生错误 THEN THE ESP32_Client SHALL 通过串口输出错误信息
2. WHEN Cloud_API 发生错误 THEN THE Cloud_API SHALL 记录错误日志到文件包含时间戳和堆栈跟踪
3. WHEN 数据库连接失败 THEN THE Cloud_API SHALL 记录错误并尝试重新连接
4. WHEN PN532_Module 初始化失败 THEN THE ESP32_Client SHALL 进入故障模式并持续鸣叫
5. WHEN 系统发生严重错误 THEN THE Cloud_API SHALL 发送告警通知给管理员

### 需求 18: 系统监控和统计

**用户故事**: 作为系统管理员,我想查看系统运行状态和统计信息,以便了解系统使用情况。

#### 验收标准

1. WHEN 管理员访问实时状态页面 THEN THE Web_Admin SHALL 显示在线设备数量和总设备数量
2. WHEN 管理员访问实时状态页面 THEN THE Web_Admin SHALL 显示启用卡片数量和总卡片数量
3. WHEN 管理员访问实时状态页面 THEN THE Web_Admin SHALL 显示今日访问次数和拒绝次数
4. WHEN 管理员访问实时状态页面 THEN THE Web_Admin SHALL 显示最近10条刷卡记录
5. WHEN 管理员访问实时状态页面 THEN THE Web_Admin SHALL 每5秒自动刷新数据

### 需求 19: 固件配置管理

**用户故事**: 作为系统部署人员,我想通过配置文件管理ESP32固件参数,以便快速配置不同的设备。

#### 验收标准

1. WHEN 部署ESP32固件 THEN THE ESP32_Client SHALL 从config.h文件读取WiFi SSID和密码
2. WHEN 部署ESP32固件 THEN THE ESP32_Client SHALL 从config.h文件读取API Base URL和设备ID
3. WHEN 部署ESP32固件 THEN THE ESP32_Client SHALL 从config.h文件读取API_Key和Secret_Key
4. WHEN 部署ESP32固件 THEN THE ESP32_Client SHALL 从config.h文件读取GPIO引脚配置
5. WHEN 部署ESP32固件 THEN THE ESP32_Client SHALL 从config.h文件读取缓存大小和过期时间配置

### 需求 20: 系统部署和安装

**用户故事**: 作为系统部署人员,我想通过自动化脚本部署系统,以便快速完成安装和配置。

#### 验收标准

1. WHEN 执行本地部署脚本 THEN THE 部署脚本 SHALL 安装所有必要的依赖包
2. WHEN 执行本地部署脚本 THEN THE 部署脚本 SHALL 初始化数据库并创建默认管理员账户
3. WHEN 执行本地部署脚本 THEN THE 部署脚本 SHALL 配置Nginx反向代理和SSL证书
4. WHEN 执行本地部署脚本 THEN THE 部署脚本 SHALL 启动后端服务并配置自动启动
5. WHEN 执行云服务器部署脚本 THEN THE 部署脚本 SHALL 支持Docker容器化部署
6. WHEN 执行云服务器部署脚本 THEN THE 部署脚本 SHALL 自动申请Let's Encrypt SSL证书
