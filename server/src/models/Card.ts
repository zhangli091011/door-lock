/**
 * Card Model
 * 卡片数据模型
 */

export interface Card {
  uid: string;                    // NFC卡片UID（8-14位十六进制）
  name: string;                   // 卡片持有人姓名
  enabled: boolean;               // 是否启用
  access_start?: Date | null;     // 权限开始时间
  access_end?: Date | null;       // 权限结束时间
  time_slots?: string | null;     // 允许访问的时间段（JSON格式）
  allowed_devices?: string | null; // 允许访问的设备列表（JSON数组）
  cacheable: boolean;             // 是否允许ESP32缓存
  created_at: Date;               // 创建时间
  updated_at: Date;               // 最后更新时间
}

/**
 * Card creation input (without auto-generated fields)
 */
export interface CreateCardInput {
  uid: string;
  name: string;
  enabled?: boolean;
  access_start?: Date | null;
  access_end?: Date | null;
  time_slots?: string | null;
  allowed_devices?: string | null;
  cacheable?: boolean;
}

/**
 * Card update input (all fields optional except uid)
 */
export interface UpdateCardInput {
  name?: string;
  enabled?: boolean;
  access_start?: Date | null;
  access_end?: Date | null;
  time_slots?: string | null;
  allowed_devices?: string | null;
  cacheable?: boolean;
}

/**
 * Card filter for querying
 */
export interface CardFilter {
  enabled?: boolean;
  search?: string;  // Search by UID or name
  page?: number;
  limit?: number;
}

/**
 * Paginated card list result
 */
export interface PaginatedCards {
  cards: Card[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
