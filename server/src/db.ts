/**
 * Database Connection Management Module
 * 数据库连接管理模块
 * 
 * Supports both SQLite and PostgreSQL databases
 * 支持SQLite和PostgreSQL两种数据库
 */

// 动态导入sqlite3（可选依赖）
let sqlite3: any;
try {
  sqlite3 = require('sqlite3');
} catch (e) {
  // sqlite3未安装，仅在使用SQLite时会报错
  sqlite3 = null;
}

import { Pool } from 'pg';

/**
 * Database type enum
 */
export enum DatabaseType {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql'
}

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  type: DatabaseType;
  // SQLite specific
  sqlitePath?: string;
  // PostgreSQL specific
  postgresUrl?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

/**
 * Query result interface
 */
export interface QueryResult {
  rows: any[];
  rowCount: number;
}

/**
 * Database connection class
 * Provides unified interface for SQLite and PostgreSQL
 */
export class Database {
  private type: DatabaseType;
  private sqliteDb?: any; // 使用any因为sqlite3是可选的
  private pgPool?: Pool;

  constructor(config: DatabaseConfig) {
    this.type = config.type;

    if (this.type === DatabaseType.SQLITE) {
      if (!sqlite3) {
        throw new Error('SQLite is not installed. Please install sqlite3 package or use PostgreSQL.');
      }
      if (!config.sqlitePath) {
        throw new Error('SQLite path is required for SQLite database');
      }
      this.sqliteDb = new sqlite3.Database(config.sqlitePath, (err: any) => {
        if (err) {
          console.error('Failed to connect to SQLite database:', err);
          throw err;
        }
        console.log('Connected to SQLite database:', config.sqlitePath);
      });
    } else if (this.type === DatabaseType.POSTGRESQL) {
      const poolConfig = config.postgresUrl
        ? { connectionString: config.postgresUrl }
        : {
            host: config.host || 'localhost',
            port: config.port || 5432,
            database: config.database,
            user: config.user,
            password: config.password,
          };

      this.pgPool = new Pool(poolConfig);
      console.log('PostgreSQL connection pool created');
    } else {
      throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  /**
   * Execute a query with parameters
   * @param sql SQL query string
   * @param params Query parameters
   * @returns Query result
   */
  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (this.type === DatabaseType.SQLITE) {
      return this.querySQLite(sql, params);
    } else {
      return this.queryPostgreSQL(sql, params);
    }
  }

  /**
   * Execute SQLite query
   */
  private querySQLite(sql: string, params: any[]): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      if (!this.sqliteDb) {
        return reject(new Error('SQLite database not initialized'));
      }

      this.sqliteDb.all(sql, params, (err: any, rows: any) => {
        if (err) {
          return reject(err);
        }
        resolve({
          rows: rows || [],
          rowCount: rows ? rows.length : 0,
        });
      });
    });
  }

  /**
   * Execute PostgreSQL query
   */
  private async queryPostgreSQL(sql: string, params: any[]): Promise<QueryResult> {
    if (!this.pgPool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    // Convert SQLite-style placeholders (?) to PostgreSQL-style ($1, $2, ...)
    let paramIndex = 0;
    const convertedSql = sql.replace(/\?/g, () => {
      paramIndex++;
      return `$${paramIndex}`;
    });

    const result = await this.pgPool.query(convertedSql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  }

  /**
   * Execute a query that returns a single row
   * @param sql SQL query string
   * @param params Query parameters
   * @returns Single row or null
   */
  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    const result = await this.query(sql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Execute an INSERT/UPDATE/DELETE query
   * @param sql SQL query string
   * @param params Query parameters
   * @returns Number of affected rows
   */
  async execute(sql: string, params: any[] = []): Promise<number> {
    if (this.type === DatabaseType.SQLITE) {
      return this.executeSQLite(sql, params);
    } else {
      return this.executePostgreSQL(sql, params);
    }
  }

  /**
   * Execute SQLite INSERT/UPDATE/DELETE
   */
  private executeSQLite(sql: string, params: any[]): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.sqliteDb) {
        return reject(new Error('SQLite database not initialized'));
      }

      this.sqliteDb.run(sql, params, function (this: any, err: any) {
        if (err) {
          return reject(err);
        }
        resolve(this.changes);
      });
    });
  }

  /**
   * Execute PostgreSQL INSERT/UPDATE/DELETE
   */
  private async executePostgreSQL(sql: string, params: any[]): Promise<number> {
    if (!this.pgPool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const result = await this.pgPool.query(sql, params);
    return result.rowCount || 0;
  }

  /**
   * Get the last inserted ID (SQLite only)
   * For PostgreSQL, use RETURNING clause in the query
   */
  async getLastInsertId(): Promise<number> {
    if (this.type === DatabaseType.SQLITE) {
      const result = await this.queryOne('SELECT last_insert_rowid() as id');
      return result ? result.id : 0;
    } else {
      throw new Error('getLastInsertId is only supported for SQLite. Use RETURNING clause for PostgreSQL.');
    }
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<void> {
    if (this.type === DatabaseType.SQLITE) {
      await this.execute('BEGIN TRANSACTION');
    } else {
      await this.execute('BEGIN');
    }
  }

  /**
   * Commit a transaction
   */
  async commit(): Promise<void> {
    await this.execute('COMMIT');
  }

  /**
   * Rollback a transaction
   */
  async rollback(): Promise<void> {
    await this.execute('ROLLBACK');
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.type === DatabaseType.SQLITE && this.sqliteDb) {
      return new Promise((resolve, reject) => {
        this.sqliteDb!.close((err: any) => {
          if (err) {
            return reject(err);
          }
          console.log('SQLite database connection closed');
          resolve();
        });
      });
    } else if (this.type === DatabaseType.POSTGRESQL && this.pgPool) {
      await this.pgPool.end();
      console.log('PostgreSQL connection pool closed');
    }
  }

  /**
   * Get database type
   */
  getType(): DatabaseType {
    return this.type;
  }
}

/**
 * Create database instance from environment variables
 */
export function createDatabaseFromEnv(): Database {
  const dbType = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase();

  if (dbType === 'sqlite') {
    const sqlitePath = process.env.DATABASE_PATH || './data/access_control.db';
    return new Database({
      type: DatabaseType.SQLITE,
      sqlitePath,
    });
  } else if (dbType === 'postgresql' || dbType === 'postgres') {
    const postgresUrl = process.env.DATABASE_URL;
    if (postgresUrl) {
      return new Database({
        type: DatabaseType.POSTGRESQL,
        postgresUrl,
      });
    } else {
      return new Database({
        type: DatabaseType.POSTGRESQL,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'access_control',
        user: process.env.DB_USER || 'access_user',
        password: process.env.DB_PASSWORD || '',
      });
    }
  } else {
    throw new Error(`Unsupported database type: ${dbType}`);
  }
}
