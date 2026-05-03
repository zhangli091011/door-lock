/**
 * AccessLog Repository
 * 访问日志数据访问层
 * 
 * Implements insert and query operations for AccessLog model
 */

import { Database } from '../db';
import {
  AccessLog,
  CreateAccessLogInput,
  AccessLogFilter,
  PaginatedAccessLogs,
  AccessStatistics,
} from '../models/AccessLog';

export class AccessLogRepository {
  constructor(private db: Database) {}

  /**
   * Create a new access log entry
   * @param input AccessLog creation input
   * @returns Created access log
   */
  async create(input: CreateAccessLogInput): Promise<AccessLog> {
    const {
      uid,
      device_id,
      allowed,
      reason = null,
      source,
      card_name = null,
      device_name = null,
    } = input;

    const sql = `
      INSERT INTO access_logs (uid, device_id, allowed, reason, source, 
                              card_name, device_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      uid,
      device_id,
      allowed ? 1 : 0,
      reason,
      source,
      card_name,
      device_name,
    ];

    await this.db.execute(sql, params);

    // Get the last inserted ID
    const id = await this.db.getLastInsertId();

    // Fetch and return the created log
    const log = await this.findById(id);
    if (!log) {
      throw new Error('Failed to create access log');
    }

    return log;
  }

  /**
   * Find access log by ID
   * @param id Log ID
   * @returns AccessLog or null if not found
   */
  async findById(id: number): Promise<AccessLog | null> {
    const sql = `
      SELECT id, uid, device_id, timestamp, allowed, reason, source,
             card_name, device_name
      FROM access_logs
      WHERE id = ?
    `;
    
    const row = await this.db.queryOne(sql, [id]);
    return row ? this.mapRowToAccessLog(row) : null;
  }

  /**
   * Find access logs with filtering and pagination
   * @param filter AccessLog filter options
   * @returns Paginated access log list
   */
  async findAll(filter: AccessLogFilter = {}): Promise<PaginatedAccessLogs> {
    const {
      device_id,
      uid,
      allowed,
      start_time,
      end_time,
      page = 1,
      limit = 50,
    } = filter;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (device_id) {
      conditions.push('device_id = ?');
      params.push(device_id);
    }

    if (uid) {
      conditions.push('uid = ?');
      params.push(uid);
    }

    if (allowed !== undefined) {
      conditions.push('allowed = ?');
      params.push(allowed ? 1 : 0);
    }

    if (start_time) {
      conditions.push('timestamp >= ?');
      params.push(start_time.toISOString());
    }

    if (end_time) {
      conditions.push('timestamp <= ?');
      params.push(end_time.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM access_logs ${whereClause}`;
    const countResult = await this.db.queryOne(countSql, params);
    const total = countResult ? countResult.total : 0;

    // Get paginated results
    const dataSql = `
      SELECT id, uid, device_id, timestamp, allowed, reason, source,
             card_name, device_name
      FROM access_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, limit, offset];
    const result = await this.db.query(dataSql, dataParams);
    const logs = result.rows.map(row => this.mapRowToAccessLog(row));

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get recent access logs (last N entries)
   * @param limit Number of logs to retrieve
   * @returns Array of recent access logs
   */
  async findRecent(limit: number = 10): Promise<AccessLog[]> {
    const sql = `
      SELECT id, uid, device_id, timestamp, allowed, reason, source,
             card_name, device_name
      FROM access_logs
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    
    const result = await this.db.query(sql, [limit]);
    return result.rows.map(row => this.mapRowToAccessLog(row));
  }

  /**
   * Get access statistics for today
   * @returns Access statistics
   */
  async getTodayStatistics(): Promise<AccessStatistics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Count today's access attempts
    const accessSql = `
      SELECT COUNT(*) as count 
      FROM access_logs 
      WHERE timestamp >= ? AND allowed = 1
    `;
    const accessResult = await this.db.queryOne(accessSql, [todayStr]);
    const today_access = accessResult ? accessResult.count : 0;

    // Count today's denied attempts
    const deniedSql = `
      SELECT COUNT(*) as count 
      FROM access_logs 
      WHERE timestamp >= ? AND allowed = 0
    `;
    const deniedResult = await this.db.queryOne(deniedSql, [todayStr]);
    const today_denied = deniedResult ? deniedResult.count : 0;

    // Count total access attempts
    const totalSql = 'SELECT COUNT(*) as count FROM access_logs';
    const totalResult = await this.db.queryOne(totalSql);
    const total_access = totalResult ? totalResult.count : 0;

    return {
      today_access,
      today_denied,
      total_access,
    };
  }

  /**
   * Delete old access logs (older than specified date)
   * @param beforeDate Delete logs before this date
   * @returns Number of deleted logs
   */
  async deleteOldLogs(beforeDate: Date): Promise<number> {
    const sql = 'DELETE FROM access_logs WHERE timestamp < ?';
    return await this.db.execute(sql, [beforeDate.toISOString()]);
  }

  /**
   * Get access count by device for a time period
   * @param deviceId Device ID
   * @param startTime Start time
   * @param endTime End time
   * @returns Access count
   */
  async countByDevice(
    deviceId: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<number> {
    const conditions: string[] = ['device_id = ?'];
    const params: any[] = [deviceId];

    if (startTime) {
      conditions.push('timestamp >= ?');
      params.push(startTime.toISOString());
    }

    if (endTime) {
      conditions.push('timestamp <= ?');
      params.push(endTime.toISOString());
    }

    const sql = `
      SELECT COUNT(*) as count 
      FROM access_logs 
      WHERE ${conditions.join(' AND ')}
    `;
    
    const result = await this.db.queryOne(sql, params);
    return result ? result.count : 0;
  }

  /**
   * Get access count by card for a time period
   * @param uid Card UID
   * @param startTime Start time
   * @param endTime End time
   * @returns Access count
   */
  async countByCard(uid: string, startTime?: Date, endTime?: Date): Promise<number> {
    const conditions: string[] = ['uid = ?'];
    const params: any[] = [uid];

    if (startTime) {
      conditions.push('timestamp >= ?');
      params.push(startTime.toISOString());
    }

    if (endTime) {
      conditions.push('timestamp <= ?');
      params.push(endTime.toISOString());
    }

    const sql = `
      SELECT COUNT(*) as count 
      FROM access_logs 
      WHERE ${conditions.join(' AND ')}
    `;
    
    const result = await this.db.queryOne(sql, params);
    return result ? result.count : 0;
  }

  /**
   * Map database row to AccessLog object
   * Handles boolean conversion for SQLite
   */
  private mapRowToAccessLog(row: any): AccessLog {
    return {
      id: row.id,
      uid: row.uid,
      device_id: row.device_id,
      timestamp: new Date(row.timestamp),
      allowed: Boolean(row.allowed),
      reason: row.reason,
      source: row.source as 'cloud' | 'cache',
      card_name: row.card_name,
      device_name: row.device_name,
    };
  }
}
