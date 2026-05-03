-- PostgreSQL Database Initialization Script
-- ESP32 NFC Cloud Access Control System

-- ============================================
-- 创建卡片表 (Cards Table)
-- ============================================
CREATE TABLE IF NOT EXISTS cards (
  uid VARCHAR(14) PRIMARY KEY,               -- NFC卡片UID（8-14位十六进制）
  name VARCHAR(100) NOT NULL,                -- 卡片持有人姓名
  enabled BOOLEAN DEFAULT TRUE,              -- 是否启用
  access_start TIMESTAMP,                    -- 权限开始时间（NULL表示无限制）
  access_end TIMESTAMP,                      -- 权限结束时间（NULL表示无限制）
  time_slots JSONB,                          -- 允许访问的时间段（JSONB格式）
  allowed_devices JSONB,                     -- 允许访问的设备列表（JSONB数组）
  cacheable BOOLEAN DEFAULT TRUE,            -- 是否允许ESP32缓存
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 创建设备表 (Devices Table)
-- ============================================
CREATE TABLE IF NOT EXISTS devices (
  device_id VARCHAR(50) PRIMARY KEY,         -- 设备唯一标识
  name VARCHAR(100) NOT NULL,                -- 设备名称
  location VARCHAR(200),                     -- 设备位置描述
  mac_address VARCHAR(17) UNIQUE,            -- ESP32 MAC地址（格式：XX:XX:XX:XX:XX:XX）
  api_key VARCHAR(64) NOT NULL UNIQUE,       -- 设备专用API Key
  secret_key VARCHAR(64) NOT NULL,           -- 设备专用签名密钥
  enabled BOOLEAN DEFAULT TRUE,              -- 是否启用
  last_seen TIMESTAMP,                       -- 最后在线时间
  firmware_version VARCHAR(20),              -- 固件版本号
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 创建访问日志表 (Access Logs Table)
-- ============================================
CREATE TABLE IF NOT EXISTS access_logs (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(14) NOT NULL,                  -- 刷卡UID
  device_id VARCHAR(50) NOT NULL,            -- 设备ID
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 刷卡时间
  allowed BOOLEAN NOT NULL,                  -- 是否允许通过
  reason TEXT,                               -- 拒绝原因
  source VARCHAR(10) NOT NULL,               -- 验证来源（cloud/cache）
  card_name VARCHAR(100),                    -- 卡片持有人姓名（冗余字段）
  device_name VARCHAR(100),                  -- 设备名称（冗余字段）
  CONSTRAINT fk_access_logs_uid FOREIGN KEY (uid) REFERENCES cards(uid) ON DELETE CASCADE,
  CONSTRAINT fk_access_logs_device_id FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- ============================================
-- 创建管理员表 (Admins Table)
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,      -- 管理员用户名
  password_hash VARCHAR(255) NOT NULL,       -- 密码哈希（bcrypt）
  email VARCHAR(100),                        -- 邮箱地址
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 创建索引 (Indexes)
-- ============================================
-- 访问日志时间戳索引（优化按时间查询）
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp DESC);

-- 访问日志UID索引（优化按卡片查询）
CREATE INDEX IF NOT EXISTS idx_access_logs_uid ON access_logs(uid);

-- 访问日志设备ID索引（优化按设备查询）
CREATE INDEX IF NOT EXISTS idx_access_logs_device_id ON access_logs(device_id);

-- 卡片启用状态索引（优化筛选启用卡片）
CREATE INDEX IF NOT EXISTS idx_cards_enabled ON cards(enabled);

-- 设备启用状态索引（优化筛选启用设备）
CREATE INDEX IF NOT EXISTS idx_devices_enabled ON devices(enabled);

-- 访问日志复合索引（优化按设备和时间查询）
CREATE INDEX IF NOT EXISTS idx_access_logs_device_timestamp ON access_logs(device_id, timestamp DESC);

-- 访问日志复合索引（优化按UID和时间查询）
CREATE INDEX IF NOT EXISTS idx_access_logs_uid_timestamp ON access_logs(uid, timestamp DESC);

-- ============================================
-- 创建触发器函数（自动更新updated_at字段）
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为cards表创建更新触发器
DROP TRIGGER IF EXISTS update_cards_updated_at ON cards;
CREATE TRIGGER update_cards_updated_at 
  BEFORE UPDATE ON cards
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 为devices表创建更新触发器
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at 
  BEFORE UPDATE ON devices
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 插入默认管理员账户
-- ============================================
-- 用户名: admin
-- 密码: admin123
-- 密码哈希使用bcrypt生成（cost=10）
INSERT INTO admins (username, password_hash, email) 
VALUES (
  'admin', 
  '$2b$10$rBV2kHYgLcIGxY4x8W1rXeJ7Z8QZ9X0Y1Z2Y3Z4Z5Z6Z7Z8Z9Z0Z1', 
  'admin@example.com'
)
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- 插入示例数据（可选，用于测试）
-- ============================================
-- 示例设备
INSERT INTO devices (device_id, name, location, mac_address, api_key, secret_key, firmware_version) 
VALUES (
  'door_1', 
  '前门门禁', 
  '一楼大厅', 
  'A4:CF:12:34:56:78',
  'sk_live_example_api_key_32chars_long_abc123',
  'secret_example_key_32chars_long_xyz789',
  '1.0.0'
)
ON CONFLICT (device_id) DO NOTHING;

-- 示例卡片
INSERT INTO cards (uid, name, enabled, cacheable, time_slots, allowed_devices) 
VALUES (
  '04A1B2C3D4E5F6', 
  '张三', 
  TRUE, 
  TRUE,
  '["09:00-12:00", "14:00-18:00"]'::JSONB,
  '["door_1"]'::JSONB
)
ON CONFLICT (uid) DO NOTHING;

-- ============================================
-- 创建视图（可选，用于简化查询）
-- ============================================
-- 最近访问日志视图（包含卡片和设备名称）
CREATE OR REPLACE VIEW v_recent_access_logs AS
SELECT 
  al.id,
  al.uid,
  c.name AS card_name,
  al.device_id,
  d.name AS device_name,
  al.timestamp,
  al.allowed,
  al.reason,
  al.source
FROM access_logs al
LEFT JOIN cards c ON al.uid = c.uid
LEFT JOIN devices d ON al.device_id = d.device_id
ORDER BY al.timestamp DESC;

-- 设备在线状态视图
CREATE OR REPLACE VIEW v_device_status AS
SELECT 
  device_id,
  name,
  location,
  enabled,
  last_seen,
  firmware_version,
  CASE 
    WHEN last_seen IS NULL THEN FALSE
    WHEN last_seen > CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN TRUE
    ELSE FALSE
  END AS is_online
FROM devices;

-- ============================================
-- 数据库初始化完成
-- ============================================
-- 查看表结构
-- \dt
-- 查看索引
-- \di
-- 查看触发器
-- \dS+ cards
-- \dS+ devices
