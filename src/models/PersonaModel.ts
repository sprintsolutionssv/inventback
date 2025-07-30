import { Pool } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface PersonaDTO {
  id_empresa?: string;
  id_categoria_persona?: string;
  id_nombre_persona: string;
  id_naturaleza?: string | null;
  estado: string;
}

export interface PersonaFilter {
  id_empresa?: string;
  id_categoria?: string;
  nombre?: string;
  estado?: string;
  id_naturaleza?: string;
  page?: number;
  limit?: number;
}

export class PersonaModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  /** LISTADO con filtros y paginación */
  static async findAll(filters: PersonaFilter) {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.id_empresa) {
      clauses.push(`p.id_empresa = $${idx++}`);
      params.push(filters.id_empresa);
    }
    if (filters.id_categoria) {
      clauses.push(`p.id_categoria_persona = $${idx++}`);
      params.push(filters.id_categoria);
    }
    if (filters.nombre) {
      clauses.push(`np.nombre_completo ILIKE '%' || $${idx++} || '%'`);
      params.push(filters.nombre);
    }
    if (filters.estado) {
      clauses.push(`p.estado = $${idx++}`);
      params.push(filters.estado);
    }
    if (filters.id_naturaleza) {
      clauses.push(`p.id_naturaleza = $${idx++}`);
      params.push(filters.id_naturaleza);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const offset = (page - 1) * limit;

    // total
    const totRes = await pool.query(`SELECT COUNT(*) FROM persona p ${where}`, params);
    const total = parseInt(totRes.rows[0].count, 10);
    const pages = Math.ceil(total / limit);

    // datos con joins
    const dataRes = await pool.query(
      `
      SELECT
        p.id_persona,
        np.nombre_completo,
        e.nombre AS empresa,
        cp.nombre AS categoria,
        st.nombre AS estado,
        p.id_naturaleza
      FROM persona p
      LEFT JOIN nombre_persona np ON np.id_nombre_persona = p.id_nombre_persona
      LEFT JOIN empresa e ON e.id_empresa = p.id_empresa
      LEFT JOIN categoria_persona cp ON cp.id_categoria_persona = p.id_categoria_persona
      LEFT JOIN estado st ON st.id_estado = p.estado
      ${where}
      ORDER BY np.nombre_completo
      LIMIT $${idx++} OFFSET $${idx++}
      `,
      [...params, limit, offset]
    );

    return {
      data: dataRes.rows,
      pagination: { total, page, limit, pages }
    };
  }

  /** DETALLE por ID */
  static async findById(id: string) {
    const pool = await this.getPool();
    const res = await pool.query(
      `
      SELECT
        p.id_persona,
        json_build_object('id', e.id_empresa, 'nombre', e.nombre) AS empresa,
        json_build_object('id', cp.id_categoria_persona, 'nombre', cp.nombre) AS categoria,
        json_build_object('id', np.id_nombre_persona, 'nombre_completo', np.nombre_completo) AS nombre,
        p.id_naturaleza,
        json_build_object('id', st.id_estado, 'nombre', st.nombre) AS estado
      FROM persona p
      LEFT JOIN empresa e ON e.id_empresa = p.id_empresa
      LEFT JOIN categoria_persona cp ON cp.id_categoria_persona = p.id_categoria_persona
      LEFT JOIN nombre_persona np ON np.id_nombre_persona = p.id_nombre_persona
      LEFT JOIN estado st ON st.id_estado = p.estado
      WHERE p.id_persona = $1
      `,
      [id]
    );
    return res.rows[0] || null;
  }

  /** CREATE */
  static async create(dto: PersonaDTO): Promise<string> {
    const pool = await this.getPool();

    // defaults
    const id_empresa = dto.id_empresa || /* UUID default empresa */ null;
    const id_categoria_persona = dto.id_categoria_persona || /* UUID default cat */ null;
    const id_naturaleza = dto.id_naturaleza || null;

    const res = await pool.query<{ id_persona: string }>(
      `INSERT INTO persona
        (id_empresa, id_categoria_persona, id_nombre_persona, id_naturaleza, estado)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id_persona`,
      [
        id_empresa,
        id_categoria_persona,
        dto.id_nombre_persona,
        id_naturaleza,
        dto.estado
      ]
    );
    return res.rows[0].id_persona;
  }

  /** UPDATE */
  static async update(id: string, dto: PersonaDTO) {
    const pool = await this.getPool();
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries({
      id_empresa: dto.id_empresa,
      id_categoria_persona: dto.id_categoria_persona,
      id_nombre_persona: dto.id_nombre_persona,
      id_naturaleza: dto.id_naturaleza,
      estado: dto.estado
    })) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        params.push(val);
      }
    }
    if (!fields.length) return;

    params.push(id);
    await pool.query(
      `UPDATE persona SET ${fields.join(', ')} WHERE id_persona = $${idx}`,
      params
    );
  }

  /** DELETE lógico */
  static async deactivate(id: string, estadoInactivoId: string) {
    const pool = await this.getPool();
    await pool.query(
      `UPDATE persona SET estado = $1 WHERE id_persona = $2`,
      [estadoInactivoId, id]
    );
  }
}
