/**
 * Admin Repository
 * 管理员数据访问层
 * 
 * Implements query operations for Admin model
 */

import { Database } from '../db';
import { Admin, SafeAdmin } from '../models/Admin';

export class AdminRepository {
  constructor(private db: Database) {}

  /**
   * Find admin by username
   * @param username Admin username
   * @returns Admin or null if not found
   */
  async findByUsername(username: string): Promise<Admin | null> {
    const sql = `
      SELECT id, username, password_hash, email, created_at
      FROM admins
      WHERE username = ?
    `;
    
    const row = await this.db.queryOne(sql, [username]);
    return row ? this.mapRowToAdmin(row) : null;
  }

  /**
   * Find admin by ID
   * @param id Admin ID
   * @returns Admin or null if not found
   */
  async findById(id: number): Promise<Admin | null> {
    const sql = `
      SELECT id, username, password_hash, email, created_at
      FROM admins
      WHERE id = ?
    `;
    
    const row = await this.db.queryOne(sql, [id]);
    return row ? this.mapRowToAdmin(row) : null;
  }

  /**
   * Find all admins
   * @returns Array of admins
   */
  async findAll(): Promise<Admin[]> {
    const sql = `
      SELECT id, username, password_hash, email, created_at
      FROM admins
      ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(sql);
    return result.rows.map(row => this.mapRowToAdmin(row));
  }

  /**
   * Check if an admin exists by username
   * @param username Admin username
   * @returns True if exists, false otherwise
   */
  async exists(username: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM admins WHERE username = ? LIMIT 1';
    const result = await this.db.queryOne(sql, [username]);
    return result !== null;
  }

  /**
   * Get total count of admins
   * @returns Total number of admins
   */
  async countTotal(): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM admins';
    const result = await this.db.queryOne(sql);
    return result ? result.count : 0;
  }

  /**
   * Convert Admin to SafeAdmin (without password hash)
   * @param admin Admin object
   * @returns SafeAdmin object
   */
  toSafeAdmin(admin: Admin): SafeAdmin {
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      created_at: admin.created_at,
    };
  }

  /**
   * Map database row to Admin object
   */
  private mapRowToAdmin(row: any): Admin {
    return {
      id: row.id,
      username: row.username,
      password_hash: row.password_hash,
      email: row.email,
      created_at: new Date(row.created_at),
    };
  }
}
