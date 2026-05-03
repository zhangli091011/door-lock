/**
 * Admin Model
 * 管理员数据模型
 */

export interface Admin {
  id: number;                     // 自增主键
  username: string;               // 管理员用户名
  password_hash: string;          // 密码哈希（bcrypt）
  email?: string | null;          // 邮箱地址
  created_at: Date;               // 创建时间
}

/**
 * Admin without password hash (for safe responses)
 */
export interface SafeAdmin {
  id: number;
  username: string;
  email?: string | null;
  created_at: Date;
}
