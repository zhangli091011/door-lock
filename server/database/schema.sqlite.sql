-- SQLite Database Initialization Script
-- ESP32 NFC Cloud Access Control System

-- ============================================
-- 创建卡片表 (Cards Table)
-- ============================================
CREATE TABLE IF NOT EXISTS cards (
  uid TEXT PRIMARY KEY,                      -- NFC卡片UID（8-14位十六进制）
  name TEXT NOT NULL,                        -- 卡片持有人姓名
  enabled BOOLEAN DEFAULT 1,                 -- 是否启用（1=启用，0=禁用）
  access_start DATETIME,                     -- 权限开始时间（NULL表示无限制）
  access_end DATETIME,                       -- 权限结束时间（NULL表示无限制）
  time_slots TEXT,                           -- 允许访问的时间段（JSON格式）
  allowed_devices TEXT,                      -- 允许访问的设备列表（JSON数组）
  cacheable BOOLEAN DEFAULT 1,               -- 是否允许ESP32缓存
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 创建设备表 (Devices Table)
-- ============================================
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,                -- 设备唯一标识
  name TEXT NOT NULL,                        -- 设备名称
  location TEXT,                             -- 设备位置描述
  mac_address TEXT UNIQUE,                   -- ESP32 MAC地址
  api_key TEXT NOT NULL UNIQUE,              -- 设备专用API Key
  secret_key TEXT NOT NULL,                  -- 设备专用签名密钥
  enabled BOOLEAN DEFAULT 1,                 -- 是否启用
  last_seen DATETIME,                        -- 最后在线时间
  firmware_version TEXT,                     -- 固件版本号
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 创建访问日志表 (Access Logs Table)
-- ============================================
CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,                         -- 刷卡UID
  device_id TEXT NOT NULL,                   -- 设备ID
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, -- 刷卡时间
  allowed BOOLEAN NOT NULL,                  -- 是否允许通过
  reason TEXT,                               -- 拒绝原因
  source TEXT NOT NULL,                      -- 验证来源（cloud/cache）
  card_name TEXT,                            -- 卡片持有人姓名（冗余字段）
  device_name TEXT,                          -- 设备名称（冗余字段）
  FOREIGN KEY (uid) REFERENCES cards(uid),
  FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- ============================================
-- 创建管理员表 (Admins Table)
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,             -- 管理员用户名
  password_hash TEXT NOT NULL,               -- 密码哈希（bcrypt）
  email TEXT,                                -- 邮箱地址
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

-- ============================================
-- 插入默认管理员账户
-- ============================================
-- 用户名: admin
-- 密码: admin123
-- 密码哈希使用bcrypt生成（cost=10）
INSERT OR IGNORE INTO admins (username, password_hash, email) 
VALUES (
  'admin', 
  '$2b$10$rBV2kHYgLcIGxY4x8W1rXeJ7Z8QZ9X0Y1Z2Y3Z4Z5Z6Z7Z8Z9Z0Z1', 
  'admin@example.com'
);

-- ============================================
-- 插入示例数据（可选，用于测试）
-- ============================================
-- 示例设备
INSERT OR IGNORE INTO devices (device_id, name, location, mac_address, api_key, secret_key, firmware_version) 
VALUES (
  'door_1', 
  '前门门禁', 
  '一楼大厅', 
  'A4:CF:12:34:56:78',
  'sk_live_example_api_key_32chars_long_abc123',
  'secret_example_key_32chars_long_xyz789',
  '1.0.0'
);

-- 示例卡片
INSERT OR IGNORE INTO cards (uid, name, enabled, cacheable, time_slots, allowed_devices) 
VALUES (
  '04A1B2C3D4E5F6', 
  '张三', 
  1, 
  1,
  '["09:00-12:00", "14:00-18:00"]',
  '["door_1"]'
);

-- ============================================
-- 数据库初始化完成
-- ============================================
