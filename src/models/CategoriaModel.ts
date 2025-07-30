// src/models/CategoriaModel.ts
import { Pool } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface CategoriaDTO {
  nombre: string;
  descripcion?: string;
  estado: string; // UUID de estado
}

export interface CategoriaFilter {
  nombre?: string;
  estado?: string;
  page?: number;
  limit?: number;
}

export class CategoriaModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  static async create(data: CategoriaDTO): Promise<string> {
    const pool = await this.getPool();
    const { nombre, descripcion = null, estado } = data;
    const res = await pool.query<{ id_categoria_persona: string }>(
      `INSERT INTO categoria_persona (nombre, descripcion, estado)
       VALUES ($1, $2, $3)
       RETURNING id_categoria_persona;`,
      [nombre, descripcion, estado]
    );
    return res.rows[0].id_categoria_persona;
  }

  static async findAll(filters: CategoriaFilter) {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.nombre) {
      clauses.push(`cp.nombre ILIKE '%'||$${idx++}||'%'`);
      params.push(filters.nombre);
    }
    if (filters.estado) {
      clauses.push(`cp.estado = $${idx++}`);
      params.push(filters.estado);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const offset = (page - 1) * limit;

    const totRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
         FROM categoria_persona cp
         JOIN estado st ON cp.estado = st.id_estado AND st.es_activo = true
       ${where};`,
      params
    );
    const total = parseInt(totRes.rows[0].count, 10);
    const pages = Math.ceil(total / limit);

    const dataRes = await pool.query(
      `SELECT
         cp.id_categoria_persona,
         cp.nombre,
         cp.descripcion,
         json_build_object('id', st.id_estado, 'nombre', st.nombre) AS estado
       FROM categoria_persona cp
       JOIN estado st ON cp.estado = st.id_estado AND st.es_activo = true
       ${where}
       ORDER BY cp.nombre
       LIMIT $${idx++} OFFSET $${idx++};`,
      [...params, limit, offset]
    );

    return { data: dataRes.rows, pagination: { total, page, limit, pages } };
  }

  static async findById(id: string) {
    const pool = await this.getPool();
    const res = await pool.query(
      `SELECT
         cp.id_categoria_persona,
         cp.nombre,
         cp.descripcion,
         json_build_object('id', st.id_estado, 'nombre', st.nombre) AS estado
       FROM categoria_persona cp
       JOIN estado st ON cp.estado = st.id_estado AND st.es_activo = true
       WHERE cp.id_categoria_persona = $1;`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async update(id: string, data: Partial<CategoriaDTO>) {
    const pool = await this.getPool();
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.nombre !== undefined) {
      fields.push(`nombre = $${idx++}`);
      params.push(data.nombre);
    }
    if (data.descripcion !== undefined) {
      fields.push(`descripcion = $${idx++}`);
      params.push(data.descripcion);
    }
    if (data.estado !== undefined) {
      fields.push(`estado = $${idx++}`);
      params.push(data.estado);
    }
    if (!fields.length) return;

    params.push(id);
    await pool.query(
      `UPDATE categoria_persona
         SET ${fields.join(', ')}
       WHERE id_categoria_persona = $${idx};`,
      params
    );
  }

  static async deactivateLogical(id: string): Promise<void> {
    const pool = await this.getPool();

    // 1) Buscar un estado inactivo
    const stRes = await pool.query<{ id_estado: string }>(
      `SELECT id_estado FROM estado WHERE es_activo = false LIMIT 1;`
    );
    if (!stRes.rows.length) {
      throw new Error('No existe estado inactivo en la BD');
    }
    const inactiveStateId = stRes.rows[0].id_estado;

    // 2) Hacer el update
    await pool.query(
      `UPDATE categoria_persona
         SET estado = $1
       WHERE id_categoria_persona = $2;`,
      [inactiveStateId, id]
    );
  }
}
