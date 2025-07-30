// src/models/TrnCategoriaPersonaModel.ts
import { Pool } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface TrnCategoriaPersonaDTO {
  id_persona: string;
  id_categoria_persona: string;
  fecha_inicio_vigencia: string; // ISO date string (YYYY-MM-DD)
  fecha_fin_vigencia?: string | null;
  nemonico: string;
  estado: string; // UUID del estado
}

export interface TrnCategoriaPersonaFilter {
  modo?: 'tabla' | 'vista';
  id_persona?: string;
  id_categoria_persona?: string;
  fecha_inicio_vigencia?: string;
  fecha_fin_vigencia?: string;
  estado?: string;
  page?: number;
  limit?: number;
  // Si necesitas filtrar por nemonico, agrégalo aquí y en la consulta SQL.
}

export class TrnCategoriaPersonaModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  /** Crear nueva asignación */
  static async create(data: TrnCategoriaPersonaDTO): Promise<void> {
    const pool = await this.getPool();
    const {
      id_persona,
      id_categoria_persona,
      fecha_inicio_vigencia,
      fecha_fin_vigencia = null,
      nemonico,
      estado
    } = data;

    // 1) Verificar que no exista la misma combinación de PK:
    const existsRes = await pool.query(
      `
      SELECT 1
        FROM trn_categoria_persona
       WHERE id_persona = $1
         AND id_categoria_persona = $2
         AND fecha_inicio_vigencia = $3
      `,
      [id_persona, id_categoria_persona, fecha_inicio_vigencia]
    );
    if (existsRes.rowCount! > 0) {
      throw new Error('Ya existe un registro con esa combinación de id_persona, id_categoria_persona y fecha_inicio_vigencia');
    }

    // 2) Verificar unicidad de nemonico para la misma persona+categoría:
    const nemRes = await pool.query(
      `
      SELECT 1
        FROM trn_categoria_persona
       WHERE id_persona = $1
         AND id_categoria_persona = $2
         AND nemonico = $3
      `,
      [id_persona, id_categoria_persona, nemonico]
    );
    if (nemRes.rowCount! > 0) {
      throw new Error('El nemonico ya existe para esa asignación de persona y categoría');
    }

    // 3) Validar rangos de fechas:
    if (fecha_fin_vigencia && fecha_inicio_vigencia > fecha_fin_vigencia) {
      throw new Error('fecha_inicio_vigencia no puede ser posterior a fecha_fin_vigencia');
    }

    // 4) Insertar:
    await pool.query(
      `
      INSERT INTO trn_categoria_persona
        (id_persona, id_categoria_persona, fecha_inicio_vigencia, fecha_fin_vigencia, nemonico, estado)
      VALUES
        ($1, $2, $3, $4, $5, $6);
      `,
      [id_persona, id_categoria_persona, fecha_inicio_vigencia, fecha_fin_vigencia, nemonico, estado]
    );
  }

  /** Actualizar una asignación existente */
  static async update(data: TrnCategoriaPersonaDTO): Promise<void> {
    const pool = await this.getPool();
    const {
      id_persona,
      id_categoria_persona,
      fecha_inicio_vigencia,
      fecha_fin_vigencia = null,
      nemonico,
      estado
    } = data;

    // 1) Asegurarse de que existe el registro original:
    const existsRes = await pool.query(
      `
      SELECT 1
        FROM trn_categoria_persona
       WHERE id_persona = $1
         AND id_categoria_persona = $2
         AND fecha_inicio_vigencia = $3
      `,
      [id_persona, id_categoria_persona, fecha_inicio_vigencia]
    );
    if (existsRes.rowCount! === 0) {
      throw new Error('No existe la asignación para actualizar');
    }

    // 2) Validar unicidad de nemonico si cambió:
    const nemRes = await pool.query(
      `
      SELECT 1
        FROM trn_categoria_persona
       WHERE id_persona = $1
         AND id_categoria_persona = $2
         AND nemonico = $3
         AND NOT (fecha_inicio_vigencia = $4)
      `,
      [id_persona, id_categoria_persona, nemonico, fecha_inicio_vigencia]
    );
    if (nemRes.rowCount! > 0) {
      throw new Error('El nemonico ya existe para esa asignación');
    }

    // 3) Validar fecha_inicio ≤ fecha_fin:
    if (fecha_fin_vigencia && fecha_inicio_vigencia > fecha_fin_vigencia) {
      throw new Error('fecha_inicio_vigencia no puede ser posterior a fecha_fin_vigencia');
    }

    // 4) Actualizar campos:
    await pool.query(
      `
      UPDATE trn_categoria_persona
         SET fecha_fin_vigencia = $4,
             nemonico            = $5,
             estado              = $6
       WHERE id_persona           = $1
         AND id_categoria_persona  = $2
         AND fecha_inicio_vigencia = $3;
      `,
      [id_persona, id_categoria_persona, fecha_inicio_vigencia, fecha_fin_vigencia, nemonico, estado]
    );
  }

  /** Inactivar una asignación (DELETE lógico) */
  static async deactivate(
    id_persona: string,
    id_categoria_persona: string,
    fecha_inicio_vigencia: string,
    inactiveStateId: string
  ): Promise<void> {
    const pool = await this.getPool();
    // Verificar existencia
    const existsRes = await pool.query(
      `
      SELECT 1
        FROM trn_categoria_persona
       WHERE id_persona = $1
         AND id_categoria_persona = $2
         AND fecha_inicio_vigencia = $3
      `,
      [id_persona, id_categoria_persona, fecha_inicio_vigencia]
    );
    if (existsRes.rowCount! === 0) {
      throw new Error('No existe la asignación para inactivar');
    }

    // Hacer update solo del estado
    await pool.query(
      `
      UPDATE trn_categoria_persona
         SET estado = $4
       WHERE id_persona = $1
         AND id_categoria_persona = $2
         AND fecha_inicio_vigencia = $3;
      `,
      [id_persona, id_categoria_persona, fecha_inicio_vigencia, inactiveStateId]
    );
  }

  /**
   * Listar asignaciones con paginación.
   * Si `modo = 'vista'`, toma los datos de la vista `vista_categoria_persona`.
   * En modo 'tabla', lee directamente de `trn_categoria_persona`.
   */
  static async findAll(filters: TrnCategoriaPersonaFilter) {
    const pool = await this.getPool();
    const modo = filters.modo === 'vista' ? 'vista' : 'tabla';
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.id_persona) {
      clauses.push(`${modo === 'tabla' ? 'tcp' : 'vcp'}.id_persona = $${idx++}`);
      params.push(filters.id_persona);
    }
    if (filters.id_categoria_persona) {
      clauses.push(`${modo === 'tabla' ? 'tcp' : 'vcp'}.id_categoria_persona = $${idx++}`);
      params.push(filters.id_categoria_persona);
    }
    if (filters.estado && modo === 'tabla') {
      clauses.push(`tcp.estado = $${idx++}`);
      params.push(filters.estado);
    }
    if (filters.fecha_inicio_vigencia && modo === 'tabla') {
      clauses.push(`tcp.fecha_inicio_vigencia = $${idx++}`);
      params.push(filters.fecha_inicio_vigencia);
    }
    if (filters.fecha_fin_vigencia && modo === 'tabla') {
      clauses.push(`tcp.fecha_fin_vigencia = $${idx++}`);
      params.push(filters.fecha_fin_vigencia);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const offset = (page - 1) * limit;

    let total = 0;
    let dataRows: any[] = [];

    if (modo === 'tabla') {
      // Conteo total
      const totRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM trn_categoria_persona tcp ${where};`,
        params
      );
      total = parseInt(totRes.rows[0].count, 10);
      const pages = Math.ceil(total / limit);

      const dataRes = await pool.query(
        `
        SELECT
          tcp.id_persona,
          tcp.id_categoria_persona,
           tcp.fecha_inicio_vigencia::text AS fecha_inicio_vigencia,
          tcp.fecha_fin_vigencia,
          tcp.nemonico,
          json_build_object('id', st.id_estado, 'nombre', st.nombre) AS estado
        FROM trn_categoria_persona tcp
        LEFT JOIN estado st ON st.id_estado = tcp.estado
        ${where}
        ORDER BY tcp.fecha_inicio_vigencia DESC
        LIMIT $${idx++} OFFSET $${idx++};
        `,
        [...params, limit, offset]
      );
      dataRows = dataRes.rows;
      return { data: dataRows, pagination: { total, page, limit, pages } };
    } else {
      // Modo 'vista'
      const totRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM vista_categoria_persona vcp ${where};`,
        params
      );
      total = parseInt(totRes.rows[0].count, 10);
      const pages = Math.ceil(total / limit);

      const dataRes = await pool.query(
        `
        SELECT
          vcp.id_persona,
          vcp.id_categoria_persona,
          vcp.nombre_categoria,
          vcp.descripcion AS descripcion_categoria
        FROM vista_categoria_persona vcp
        ${where}
        ORDER BY vcp.id_persona
        LIMIT $${idx++} OFFSET $${idx++};
        `,
        [...params, limit, offset]
      );
      dataRows = dataRes.rows;
      return { data: dataRows, pagination: { total, page, limit, pages } };
    }
  }
}
