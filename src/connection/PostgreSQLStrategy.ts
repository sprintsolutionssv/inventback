import { Pool } from 'pg';
import config from '../config/Config';
import { IConnectionStrategy } from './IConnectionStrategy';

export default class PostgreSQLStrategy implements IConnectionStrategy {
  public name = 'postgres';
  private pool: Pool | null = null;

  /** Conecta o devuelve un pool ya iniciado */
  async connect(): Promise<Pool> {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: config.DATABASE_URL });
      this.pool.on('error', err =>
        console.error('[PostgreSQLStrategy] Pool error:', err)
      );
      console.log('[PostgreSQLStrategy] Connected to PostgreSQL');
    }
    return this.pool;
  }

  /** Cierra el pool si existe */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log('[PostgreSQLStrategy] Disconnected from PostgreSQL');
      this.pool = null;
    }
  }

  /** Devuelve el pool activo */
  getConnection(): Pool {
    if (!this.pool) {
      throw new Error('PostgreSQL connection has not been established.');
    }
    return this.pool;
  }
}
