// src/models/EmpresaModel.ts
import { Pool } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface EmpresaDTO {
  nombre: string;
  nit: string;
  nrc: string;
  correo_contacto: string;
  estado?: string
}

export interface EmpresaFilter {
  nombre?: string;
  nit?: string;
  nrc?: string;
  correo_contacto?: string;
  estado?: string;
  page?: number;
  limit?: number;
}

export class EmpresaModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

   static async create(data: EmpresaDTO): Promise<string> {
    const pool = await this.getPool();
    const {
      nombre,
      nit,
      nrc,
      correo_contacto,
      estado: estadoFromBody,
    } = data;

    // Si el payload trae estado, se usará; si no, tomamos el default
    const activeStateId = estadoFromBody ?? process.env.ACTIVE_STATE_ID;
    if (!activeStateId) {
      throw new Error('ACTIVE_STATE_ID no está definido en las variables de entorno');
    }

    const result = await pool.query<{ id_empresa: string }>(
      `
      INSERT INTO empresa
        (nombre, nit, nrc, correo_contacto, estado)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id_empresa;
      `,
      [nombre, nit, nrc, correo_contacto, activeStateId]
    );

    return result.rows[0].id_empresa;
  }


  static async findAll(filters: EmpresaFilter) {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.nombre) {
      clauses.push(`e.nombre ILIKE '%' || $${idx++} || '%'`);
      params.push(filters.nombre);
    }
    if (filters.nit) {
      clauses.push(`e.nit = $${idx++}`);
      params.push(filters.nit);
    }
    if (filters.nrc) {
      clauses.push(`e.nrc = $${idx++}`);
      params.push(filters.nrc);
    }
    if (filters.correo_contacto) {
      clauses.push(`e.correo_contacto = $${idx++}`);
      params.push(filters.correo_contacto);
    }
    if (filters.estado) {
      clauses.push(`e.estado = $${idx++}`);
      params.push(filters.estado);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const offset = (page - 1) * limit;

    const totRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM empresa e ${where};`,
      params
    );
    const total = parseInt(totRes.rows[0].count, 10);
    const pages = Math.ceil(total / limit);

    const dataRes = await pool.query(
      `
      SELECT
        e.id_empresa,
        e.nombre,
        e.nit,
        e.nrc,
        e.correo_contacto,
        json_build_object('id', st.id_estado, 'nombre', st.nombre, 'es_activo', st.es_activo) AS estado,
        e.fecha_creacion
      FROM empresa e
      LEFT JOIN estado st ON st.id_estado = e.estado
      ${where}
      ORDER BY e.nombre
      LIMIT $${idx++} OFFSET $${idx++};
    `,
      [...params, limit, offset]
    );

    return {
      data: dataRes.rows,
      pagination: { total, page, limit, pages }
    };
  }

  static async findById(id: string) {
    const pool = await this.getPool();
    const res = await pool.query(
      `
      SELECT
        e.id_empresa,
        e.nombre,
        e.nit,
        e.nrc,
        e.correo_contacto,
        json_build_object('id', st.id_estado, 'nombre', st.nombre, 'es_activo', st.es_activo) AS estado,
        e.fecha_creacion
      FROM empresa e
      LEFT JOIN estado st ON st.id_estado = e.estado
      WHERE e.id_empresa = $1;
    `,
      [id]
    );
    return res.rows[0] || null;
  }

  /** Actualizar datos de una empresa, incluyendo la columna estado */
  static async update(
    id: string,
    data: Partial<EmpresaDTO> & { estado?: string }
  ) {
    const pool = await this.getPool();
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.nombre !== undefined) {
      fields.push(`nombre = $${idx++}`);
      params.push(data.nombre);
    }
    if (data.nit !== undefined) {
      fields.push(`nit = $${idx++}`);
      params.push(data.nit);
    }
    if (data.nrc !== undefined) {
      fields.push(`nrc = $${idx++}`);
      params.push(data.nrc);
    }
    if (data.correo_contacto !== undefined) {
      fields.push(`correo_contacto = $${idx++}`);
      params.push(data.correo_contacto);
    }
    if (data.estado !== undefined) {
      fields.push(`estado = $${idx++}`);
      params.push(data.estado);
    }

    if (!fields.length) return;
    params.push(id);
    await pool.query(
      `UPDATE empresa SET ${fields.join(', ')} WHERE id_empresa = $${idx};`,
      params
    );
  }

  static async deactivate(id: string, inactiveStateId: string) {
    const pool = await this.getPool();
    await pool.query(
      `UPDATE empresa SET estado = $1 WHERE id_empresa = $2;`,
      [inactiveStateId, id]
    );
  }
}
