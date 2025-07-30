import { Pool } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface CategoriaPersonaDTO {
  nombre: string;
  descripcion?: string;
  estado: string; // UUID de estado
}

export interface CategoriaPersonaFilter {
  nombre?: string;
  estado?: string;
  page?: number;
  limit?: number;
}

export class CategoriaPersonaModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  /** Crear nueva categoría */
  static async create(data: CategoriaPersonaDTO): Promise<string> {
    const pool = await this.getPool();
    const { nombre, descripcion = null, estado } = data;

    const result = await pool.query<{ id_categoria_persona: string }>(
      `
      INSERT INTO categoria_persona
        (nombre, descripcion, estado)
      VALUES ($1, $2, $3)
      RETURNING id_categoria_persona;
      `,
      [nombre, descripcion, estado]
    );
    return result.rows[0].id_categoria_persona;
  }

  /** Listar categorías con filtros y paginación */
  static async findAll(filters: CategoriaPersonaFilter) {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.nombre) {
      clauses.push(`cp.nombre ILIKE '%' || $${idx++} || '%'`);
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
      `SELECT COUNT(*) AS count FROM categoria_persona cp ${where};`,
      params
    );
    const total = parseInt(totRes.rows[0].count, 10);
    const pages = Math.ceil(total / limit);

    const dataRes = await pool.query(
      `
      SELECT
        cp.id_categoria_persona,
        cp.nombre,
        cp.descripcion,
        json_build_object('id', st.id_estado, 'nombre', st.nombre) AS estado
      FROM categoria_persona cp
      LEFT JOIN estado st ON st.id_estado = cp.estado
      ${where}
      ORDER BY cp.nombre
      LIMIT $${idx++} OFFSET $${idx++};
      `,
      [...params, limit, offset]
    );

    return {
      data: dataRes.rows,
      pagination: { total, page, limit, pages }
    };
  }

  /** Obtener una categoría por ID */
  static async findById(id: string) {
    const pool = await this.getPool();
    const res = await pool.query(
      `
      SELECT
        cp.id_categoria_persona,
        cp.nombre,
        cp.descripcion,
        json_build_object('id', st.id_estado, 'nombre', st.nombre) AS estado
      FROM categoria_persona cp
      LEFT JOIN estado st ON st.id_estado = cp.estado
      WHERE cp.id_categoria_persona = $1;
      `,
      [id]
    );
    return res.rows[0] || null;
  }

  /** Actualizar datos de una categoría */
  static async update(id: string, data: Partial<CategoriaPersonaDTO>) {
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
      `UPDATE categoria_persona SET ${fields.join(', ')} WHERE id_categoria_persona = $${idx};`,
      params
    );
  }

  /** Inactivar categoría (lógica DELETE) */
  static async deactivate(id: string, inactiveStateId: string) {
    const pool = await this.getPool();
    await pool.query(
      `UPDATE categoria_persona
       SET estado = $1
       WHERE id_categoria_persona = $2;`,
      [inactiveStateId, id]
    );
  }
}
