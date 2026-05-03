/**
 * Device Model
 * 设备数据模型
 */

export interface Device {
  device_id: string;              // 设备唯一标识
  name: string;                   // 设备名称
  location?: string | null;       // 设备位置描述
  mac_address?: string | null;    // ESP32 MAC地址
  api_key: string;                // 设备专用API Key
  secret_key: string;             // 设备专用签名密钥
  enabled: boolean;               // 是否启用
  last_seen?: Date | null;        // 最后在线时间
  firmware_version?: string | null; // 固件版本号
  created_at: Date;               // 注册时间
  updated_at: Date;               // 最后更新时间
}

/**
 * Device creation input (without auto-generated fields)
 */
export interface CreateDeviceInput {
  device_id: string;
  name: string;
  location?: string | null;
  mac_address?: string | null;
  api_key: string;
  secret_key: string;
  enabled?: boolean;
  firmware_version?: string | null;
}

/**
 * Device update input (all fields optional except device_id)
 */
export interface UpdateDeviceInput {
  name?: string;
  location?: string | null;
  mac_address?: string | null;
  enabled?: boolean;
  last_seen?: Date | null;
  firmware_version?: string | null;
}

/**
 * Device with online status
 */
export interface DeviceWithStatus extends Device {
  is_online: boolean;
}
