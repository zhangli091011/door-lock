/**
 * AccessLog Model
 * 访问日志数据模型
 */

export interface AccessLog {
  id: number;                     // 自增主键
  uid: string;                    // 刷卡UID
  device_id: string;              // 设备ID
  timestamp: Date;                // 刷卡时间
  allowed: boolean;               // 是否允许通过
  reason?: string | null;         // 拒绝原因
  source: 'cloud' | 'cache';      // 验证来源
  card_name?: string | null;      // 卡片持有人姓名（冗余字段）
  device_name?: string | null;    // 设备名称（冗余字段）
}

/**
 * AccessLog creation input (without auto-generated fields)
 */
export interface CreateAccessLogInput {
  uid: string;
  device_id: string;
  allowed: boolean;
  reason?: string | null;
  source: 'cloud' | 'cache';
  card_name?: string | null;
  device_name?: string | null;
}

/**
 * AccessLog filter for querying
 */
export interface AccessLogFilter {
  device_id?: string;
  uid?: string;
  allowed?: boolean;
  start_time?: Date;
  end_time?: Date;
  page?: number;
  limit?: number;
}

/**
 * Paginated access log list result
 */
export interface PaginatedAccessLogs {
  logs: AccessLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Access statistics
 */
export interface AccessStatistics {
  today_access: number;
  today_denied: number;
  total_access: number;
}
