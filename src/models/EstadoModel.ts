import { Pool } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface EstadoDTO {
  codigo_estado: string;
  nombre: string;
  descripcion?: string;
  tipo_estado?: string;
  entidad_aplicable?: string;
  orden_visual?: number;
  color_hex?: string;
  icono?: string;
  es_final?: boolean;
  es_activo?: boolean;
  usuario_creacion: string;
}

export interface EstadoFilter {
  tipo_estado?: string;
  entidad_aplicable?: string;
  es_activo?: boolean;
  page?: number;
  limit?: number;
}

export class EstadoModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  /** Inserta un nuevo estado y devuelve el id generado */
  static async create(data: EstadoDTO): Promise<string> {
    const pool = await this.getPool();
    const {
      codigo_estado,
      nombre,
      descripcion = null,
      tipo_estado = null,
      entidad_aplicable = null,
      orden_visual = null,
      color_hex = null,
      icono = null,
      es_final = false,
      es_activo = true,
      usuario_creacion
    } = data;

    const result = await pool.query<{ id_estado: string }>(
      `INSERT INTO estado
         (codigo_estado,nombre,descripcion,tipo_estado,entidad_aplicable,
          orden_visual,color_hex,icono,es_final,es_activo,usuario_creacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id_estado;`,
      [
        codigo_estado,
        nombre,
        descripcion,
        tipo_estado,
        entidad_aplicable,
        orden_visual,
        color_hex,
        icono,
        es_final,
        es_activo,
        usuario_creacion
      ]
    );
    return result.rows[0].id_estado;
  }

  /** Listado con filtros y paginación */
  static async findAll(filters: EstadoFilter) {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.tipo_estado) {
      clauses.push(`tipo_estado = $${idx++}`);
      params.push(filters.tipo_estado);
    }
    if (filters.entidad_aplicable) {
      clauses.push(`entidad_aplicable = $${idx++}`);
      params.push(filters.entidad_aplicable);
    }
    if (filters.es_activo !== undefined) {
      clauses.push(`es_activo = $${idx++}`);
      params.push(filters.es_activo);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const offset = (page - 1) * limit;

    const totRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM estado ${where};`,
      params
    );
    const total = parseInt(totRes.rows[0].count, 10);
    const pages = Math.ceil(total / limit);

    const dataRes = await pool.query(
      `
      SELECT
        id_estado,
        codigo_estado,
        nombre,
        es_activo
      FROM estado
      ${where}
      ORDER BY nombre
      LIMIT $${idx++} OFFSET $${idx++};
      `,
      [...params, limit, offset]
    );

    return { data: dataRes.rows, pagination: { total, page, limit, pages } };
  }

  /** Detalle por ID */
  static async findById(id: string) {
    const pool = await this.getPool();
    const res = await pool.query(
      `
      SELECT
        id_estado,
        codigo_estado,
        nombre,
        descripcion,
        tipo_estado,
        entidad_aplicable,
        orden_visual,
        color_hex,
        icono,
        es_final,
        es_activo
      FROM estado
      WHERE id_estado = $1;
      `,
      [id]
    );
    return res.rows[0] || null;
  }

  /** Actualizar estado */
  static async update(id: string, dto: Partial<Omit<EstadoDTO, 'usuario_creacion'>>) {
    const pool = await this.getPool();
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(dto)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        params.push(val);
      }
    }
    if (!fields.length) return;
    params.push(id);
    await pool.query(
      `UPDATE estado SET ${fields.join(', ')} WHERE id_estado = $${idx};`,
      params
    );
  }

  /** Inactivar estado */
  static async deactivate(id: string) {
    const pool = await this.getPool();
    await pool.query(
      `UPDATE estado SET es_activo = false WHERE id_estado = $1;`,
      [id]
    );
  }
}
