/**
 * Timezone Utility Functions
 * 时区工具函数 - 统一使用 UTC+8 (中国标准时间)
 */

/**
 * Get current time in UTC+8
 * 获取当前UTC+8时间
 */
export function getCurrentTimeUTC8(): Date {
  const now = new Date();
  // 转换为UTC+8时间
  const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return utc8Time;
}

/**
 * Convert any date to UTC+8 ISO string
 * 将任意日期转换为UTC+8的ISO字符串
 */
export function toUTC8ISOString(date: Date = new Date()): string {
  // 获取UTC时间戳
  const timestamp = date.getTime();
  // 加上8小时的毫秒数
  const utc8Timestamp = timestamp + (8 * 60 * 60 * 1000);
  // 创建UTC+8时间
  const utc8Date = new Date(utc8Timestamp);
  // 返回ISO格式，但去掉Z标记，添加+08:00
  return utc8Date.toISOString().replace('Z', '+08:00');
}

/**
 * Format date to database format (YYYY-MM-DD HH:MM:SS in UTC+8)
 * 格式化日期为数据库格式（UTC+8时区）
 */
export function formatDateForDB(date: Date = new Date()): string {
  // 获取UTC时间戳
  const timestamp = date.getTime();
  // 加上8小时的毫秒数
  const utc8Timestamp = timestamp + (8 * 60 * 60 * 1000);
  // 创建UTC+8时间
  const utc8Date = new Date(utc8Timestamp);
  
  const year = utc8Date.getUTCFullYear();
  const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8Date.getUTCDate()).padStart(2, '0');
  const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
  const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(utc8Date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Parse database datetime string to Date object
 * 解析数据库时间字符串为Date对象（假设数据库存储的是UTC+8时间）
 */
export function parseDateFromDB(dateString: string): Date {
  if (!dateString) {
    return new Date();
  }
  
  // 如果字符串已经包含时区信息，直接解析
  if (dateString.includes('+') || dateString.includes('Z')) {
    return new Date(dateString);
  }
  
  // 否则，假设是UTC+8时间，添加时区标记
  return new Date(dateString + '+08:00');
}

/**
 * Get start of today in UTC+8
 * 获取今天的开始时间（UTC+8的00:00:00）
 */
export function getStartOfTodayUTC8(): Date {
  const now = new Date();
  // 转换为UTC+8
  const utc8Timestamp = now.getTime() + (8 * 60 * 60 * 1000);
  const utc8Date = new Date(utc8Timestamp);
  
  // 设置为当天00:00:00
  utc8Date.setUTCHours(0, 0, 0, 0);
  
  // 转换回本地时间
  return new Date(utc8Date.getTime() - (8 * 60 * 60 * 1000));
}

/**
 * Get end of today in UTC+8
 * 获取今天的结束时间（UTC+8的23:59:59）
 */
export function getEndOfTodayUTC8(): Date {
  const now = new Date();
  // 转换为UTC+8
  const utc8Timestamp = now.getTime() + (8 * 60 * 60 * 1000);
  const utc8Date = new Date(utc8Timestamp);
  
  // 设置为当天23:59:59
  utc8Date.setUTCHours(23, 59, 59, 999);
  
  // 转换回本地时间
  return new Date(utc8Date.getTime() - (8 * 60 * 60 * 1000));
}

/**
 * Convert UTC time to UTC+8 for display
 * 将UTC时间转换为UTC+8用于显示
 */
export function convertUTCtoUTC8(utcDate: Date): Date {
  return new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
}

/**
 * Format date for API response (ISO string with +08:00 timezone)
 * 格式化日期用于API响应（带+08:00时区的ISO字符串）
 */
export function formatDateForAPI(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  return toUTC8ISOString(date);
}
