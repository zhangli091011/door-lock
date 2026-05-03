# ESP32 NFC 云门禁系统 - 固件

## 项目概述

这是ESP32 NFC云门禁系统的固件代码，运行在ESP32-S3微控制器上。固件负责NFC卡片读取、云端权限验证、本地缓存管理和门锁控制。

## 硬件要求

- **主控**: ESP32-S3开发板
- **NFC模块**: PN532（I2C接口）
- **继电器**: 5V继电器模块（控制磁力锁）
- **磁力锁**: 12V磁力锁（通过继电器NC端子控制）
- **蜂鸣器**: 有源蜂鸣器（5V）
- **出门按钮**: 常开按钮

## 引脚连接

| 组件 | ESP32引脚 | 说明 |
|------|----------|------|
| PN532 SDA | GPIO 8 | I2C数据线 |
| PN532 SCL | GPIO 9 | I2C时钟线 |
| 继电器控制 | GPIO 4 | 继电器信号输入 |
| 蜂鸣器 | GPIO 5 | 蜂鸣器控制 |
| 出门按钮 | GPIO 6 | 按钮输入（内部上拉） |

## 项目结构

```
esp32-firmware/
├── esp32-firmware.ino    # 主程序文件
├── config.h              # 配置文件（包含WiFi、API等配置）
├── config.h.example      # 配置文件示例
├── .gitignore           # Git忽略文件
└── README.md            # 本文档
```

## 安装步骤

### 1. 安装Arduino IDE

下载并安装Arduino IDE（推荐1.8.19或更高版本）：
https://www.arduino.cc/en/software

### 2. 安装ESP32开发板支持

1. 打开Arduino IDE
2. 进入 `文件` -> `首选项`
3. 在"附加开发板管理器网址"中添加：
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. 进入 `工具` -> `开发板` -> `开发板管理器`
5. 搜索"ESP32"并安装"ESP32 by Espressif Systems"

### 3. 安装依赖库

进入 `工具` -> `管理库`，搜索并安装以下库：

- **Adafruit PN532** (v1.3.0或更高)
- **ArduinoJson** (v6.21.0或更高)

注意：WiFi和HTTPClient库是ESP32核心库的一部分，无需单独安装。

### 4. 配置固件

1. 复制`config.h.example`为`config.h`：
   ```bash
   cp config.h.example config.h
   ```

2. 编辑`config.h`文件，配置以下参数：

   **WiFi配置**：
   ```cpp
   #define WIFI_SSID "Your_WiFi_SSID"
   #define WIFI_PASSWORD "Your_WiFi_Password"
   ```

   **API配置**：
   ```cpp
   #define API_BASE_URL "http://192.168.1.100:3000/api"
   #define DEVICE_ID "door_1"
   #define API_KEY "your_device_api_key"
   #define SECRET_KEY "your_device_secret_key"
   ```

   注意：`DEVICE_ID`、`API_KEY`和`SECRET_KEY`需要在云端服务器注册设备后获得。

### 5. 编译和上传

1. 打开`esp32-firmware.ino`文件
2. 选择开发板：`工具` -> `开发板` -> `ESP32-S3 Dev Module`
3. 选择端口：`工具` -> `端口` -> 选择对应的COM端口
4. 设置上传速度：`工具` -> `上传速度` -> `115200`
5. 点击"上传"按钮

### 6. 查看串口输出

1. 打开串口监视器：`工具` -> `串口监视器`
2. 设置波特率为`115200`
3. 查看系统启动日志和运行状态

## 配置说明

### WiFi配置

- `WIFI_SSID`: WiFi网络名称
- `WIFI_PASSWORD`: WiFi密码
- `WIFI_CONNECT_TIMEOUT`: 连接超时时间（默认10秒）
- `WIFI_RECONNECT_INTERVAL`: 重连检查间隔（默认10秒）

### API配置

- `API_BASE_URL`: 云端API基础URL（不要以斜杠结尾）
- `DEVICE_ID`: 设备唯一标识符
- `API_KEY`: 设备API密钥（用于认证）
- `SECRET_KEY`: 设备签名密钥（用于请求签名）
- `API_TIMEOUT`: API请求超时时间（默认5秒）

### 硬件GPIO配置

- `PN532_SDA_PIN`: PN532 I2C数据引脚（默认GPIO 8）
- `PN532_SCL_PIN`: PN532 I2C时钟引脚（默认GPIO 9）
- `RELAY_PIN`: 继电器控制引脚（默认GPIO 4）
- `BUZZER_PIN`: 蜂鸣器引脚（默认GPIO 5）
- `EXIT_BUTTON_PIN`: 出门按钮引脚（默认GPIO 6）

### 门锁配置

- `UNLOCK_DURATION`: 开锁持续时间（默认3000毫秒）
- `RELAY_LOCK`: 锁定状态的继电器电平（默认HIGH）
- `RELAY_UNLOCK`: 开锁状态的继电器电平（默认LOW）

### 缓存配置

- `CACHE_SIZE`: 本地缓存最大卡片数量（默认50）
- `CACHE_EXPIRE`: 缓存有效期（默认86400秒，即24小时）

### 调试配置

- `DEBUG_ENABLED`: 启用调试输出（注释掉以禁用）
- `SERIAL_BAUD_RATE`: 串口波特率（默认115200）

## 功能说明

### 1. NFC卡片读取

- 使用PN532模块通过I2C接口读取NFC卡片UID
- 支持ISO14443A标准的NFC卡片（如Mifare Classic、Mifare Ultralight等）
- 读取间隔500毫秒，避免重复读取

### 2. 云端权限验证

- 通过WiFi连接到云端API服务器
- 发送卡片UID、设备ID、时间戳和签名
- 接收云端返回的权限验证结果
- 支持HMAC-SHA256签名验证（防止请求伪造）

### 3. 本地缓存机制

- 缓存最近验证通过的卡片信息
- 网络故障时自动切换到本地缓存验证
- 缓存有效期24小时，过期自动清除
- 缓存满时采用FIFO策略（先进先出）

### 4. 门锁控制

- 通过继电器控制磁力锁
- 使用NC（常闭）端子连接磁力锁
- 权限通过后自动开锁3秒
- 3秒后自动重新锁门

### 5. 出门按钮

- 支持从内部按钮开门
- 按钮防抖处理（50毫秒）
- 按下后立即开锁3秒

### 6. 蜂鸣器反馈

- 读卡提示：短鸣1次
- 成功开门：长鸣1次
- 权限拒绝：短鸣3次
- 离线模式：短鸣2次
- 系统启动：短鸣2次

## 故障排除

### PN532初始化失败

**现象**：串口输出"PN532初始化失败"，蜂鸣器持续鸣叫

**可能原因**：
1. I2C接线错误（检查SDA/SCL连接）
2. PN532供电不足（确保5V供电稳定）
3. PN532未设置为I2C模式（检查拨码开关）

**解决方法**：
1. 检查接线：SDA -> GPIO8, SCL -> GPIO9
2. 确保PN532供电为5V，电流充足
3. 设置PN532为I2C模式（拨码开关：ON, OFF）

### WiFi连接失败

**现象**：串口输出"WiFi连接失败，将使用离线模式"

**可能原因**：
1. WiFi SSID或密码错误
2. WiFi信号弱
3. 路由器限制

**解决方法**：
1. 检查`config.h`中的WiFi配置
2. 将ESP32靠近路由器
3. 检查路由器是否限制设备连接

### API请求失败

**现象**：串口输出"HTTP请求失败"或"HTTP状态码错误"

**可能原因**：
1. API服务器未启动
2. API_BASE_URL配置错误
3. API_KEY或DEVICE_ID错误
4. 网络连接问题

**解决方法**：
1. 确认云端服务器正常运行
2. 检查`config.h`中的API配置
3. 在云端注册设备并获取正确的API_KEY
4. 检查网络连接

### 门锁不工作

**现象**：权限验证通过但门锁不开

**可能原因**：
1. 继电器接线错误
2. 继电器逻辑配置错误
3. 磁力锁供电不足

**解决方法**：
1. 检查继电器接线（信号线 -> GPIO4）
2. 确认使用NC端子连接磁力锁
3. 确保磁力锁供电为12V，电流充足

## 开发说明

### 添加新功能

1. 在主程序中添加函数声明
2. 在`loop()`函数中调用新功能
3. 根据需要在`config.h`中添加配置参数

### 调试技巧

1. 启用`DEBUG_ENABLED`宏以查看详细日志
2. 使用串口监视器查看实时输出
3. 检查WiFi连接状态和API响应

### 注意事项

1. **签名实现**：当前版本使用简化版签名，生产环境需实现真实的HMAC-SHA256签名
2. **时间同步**：当前使用`millis()`作为时间戳，建议使用NTP同步真实时间
3. **安全性**：`config.h`包含敏感信息，不要提交到公共代码仓库

## 版本历史

- **v1.0.0** (2024-01-15)
  - 初始版本
  - 支持NFC卡片读取
  - 支持云端权限验证
  - 支持本地缓存机制
  - 支持门锁控制和出门按钮

## 许可证

本项目采用MIT许可证。详见LICENSE文件。

## 技术支持

如有问题或建议，请提交Issue或联系开发团队。
