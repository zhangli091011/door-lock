/**
 * Card Repository
 * 卡片数据访问层
 * 
 * Implements CRUD operations for Card model
 */

import { Database } from '../db';
import { Card, CreateCardInput, UpdateCardInput, CardFilter, PaginatedCards } from '../models/Card';

export class CardRepository {
  constructor(private db: Database) {}

  /**
   * Find card by UID
   * @param uid Card UID
   * @returns Card or null if not found
   */
  async findByUid(uid: string): Promise<Card | null> {
    const sql = `
      SELECT uid, name, enabled, access_start, access_end, 
             time_slots, allowed_devices, cacheable, 
             created_at, updated_at
      FROM cards
      WHERE uid = ?
    `;
    
    const row = await this.db.queryOne(sql, [uid]);
    return row ? this.mapRowToCard(row) : null;
  }

  /**
   * Find all cards with optional filtering and pagination
   * @param filter Card filter options
   * @returns Paginated card list
   */
  async findAll(filter: CardFilter = {}): Promise<PaginatedCards> {
    const { enabled, search, page = 1, limit = 20 } = filter;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (enabled !== undefined) {
      conditions.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }

    if (search) {
      conditions.push('(uid LIKE ? OR name LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM cards ${whereClause}`;
    const countResult = await this.db.queryOne(countSql, params);
    const total = countResult ? countResult.total : 0;

    // Get paginated results
    const dataSql = `
      SELECT uid, name, enabled, access_start, access_end, 
             time_slots, allowed_devices, cacheable, 
             created_at, updated_at
      FROM cards
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, limit, offset];
    const result = await this.db.query(dataSql, dataParams);
    const cards = result.rows.map(row => this.mapRowToCard(row));

    return {
      cards,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new card
   * @param input Card creation input
   * @returns Created card
   */
  async create(input: CreateCardInput): Promise<Card> {
    const {
      uid,
      name,
      enabled = true,
      access_start = null,
      access_end = null,
      time_slots = null,
      allowed_devices = null,
      cacheable = true,
    } = input;

    const sql = `
      INSERT INTO cards (uid, name, enabled, access_start, access_end, 
                        time_slots, allowed_devices, cacheable)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      uid,
      name,
      enabled ? 1 : 0,
      access_start,
      access_end,
      time_slots,
      allowed_devices,
      cacheable ? 1 : 0,
    ];

    await this.db.execute(sql, params);

    // Fetch and return the created card
    const card = await this.findByUid(uid);
    if (!card) {
      throw new Error('Failed to create card');
    }

    return card;
  }

  /**
   * Update an existing card
   * @param uid Card UID
   * @param input Card update input
   * @returns Updated card or null if not found
   */
  async update(uid: string, input: UpdateCardInput): Promise<Card | null> {
    // Check if card exists
    const existingCard = await this.findByUid(uid);
    if (!existingCard) {
      return null;
    }

    // Build UPDATE clause dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }

    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(input.enabled ? 1 : 0);
    }

    if (input.access_start !== undefined) {
      updates.push('access_start = ?');
      params.push(input.access_start);
    }

    if (input.access_end !== undefined) {
      updates.push('access_end = ?');
      params.push(input.access_end);
    }

    if (input.time_slots !== undefined) {
      updates.push('time_slots = ?');
      params.push(input.time_slots);
    }

    if (input.allowed_devices !== undefined) {
      updates.push('allowed_devices = ?');
      params.push(input.allowed_devices);
    }

    if (input.cacheable !== undefined) {
      updates.push('cacheable = ?');
      params.push(input.cacheable ? 1 : 0);
    }

    if (updates.length === 0) {
      // No updates to perform
      return existingCard;
    }

    // Add updated_at timestamp
    updates.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `
      UPDATE cards
      SET ${updates.join(', ')}
      WHERE uid = ?
    `;

    params.push(uid);
    await this.db.execute(sql, params);

    // Fetch and return the updated card
    return await this.findByUid(uid);
  }

  /**
   * Delete a card
   * @param uid Card UID
   * @returns True if deleted, false if not found
   */
  async delete(uid: string): Promise<boolean> {
    const sql = 'DELETE FROM cards WHERE uid = ?';
    const affectedRows = await this.db.execute(sql, [uid]);
    return affectedRows > 0;
  }

  /**
   * Check if a card exists
   * @param uid Card UID
   * @returns True if exists, false otherwise
   */
  async exists(uid: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM cards WHERE uid = ? LIMIT 1';
    const result = await this.db.queryOne(sql, [uid]);
    return result !== null;
  }

  /**
   * Get count of enabled cards
   * @returns Number of enabled cards
   */
  async countEnabled(): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM cards WHERE enabled = 1';
    const result = await this.db.queryOne(sql);
    return result ? result.count : 0;
  }

  /**
   * Get total count of cards
   * @returns Total number of cards
   */
  async countTotal(): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM cards';
    const result = await this.db.queryOne(sql);
    return result ? result.count : 0;
  }

  /**
   * Map database row to Card object
   * Handles boolean conversion for SQLite
   */
  private mapRowToCard(row: any): Card {
    return {
      uid: row.uid,
      name: row.name,
      enabled: Boolean(row.enabled),
      access_start: row.access_start ? new Date(row.access_start) : null,
      access_end: row.access_end ? new Date(row.access_end) : null,
      time_slots: row.time_slots,
      allowed_devices: row.allowed_devices,
      cacheable: Boolean(row.cacheable),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
