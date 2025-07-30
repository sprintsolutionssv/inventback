import { Pool } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface DocumentoPersonaDTO {
  id_persona: string;
  tipo_documento: string;
  numero_documento: string;
  entidad_emisora: string;
  fecha_emision: string;      // YYYY-MM-DD
  fecha_expiracion?: string | null;
  estado: string;             // UUID de estado
}

export interface DocumentoPersonaFilter {
  id_persona?: string;
  tipo_documento?: string;
  estado?: string;
  entidad_emisora?: string;
  fecha_emision?: string;
  page?: number;
  limit?: number;
}

export class DocumentoPersonaModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  /** Crear un documento-persona */
  static async create(data: DocumentoPersonaDTO): Promise<string> {
    const pool = await this.getPool();
    const {
      id_persona,
      tipo_documento,
      numero_documento,
      entidad_emisora,
      fecha_emision,
      fecha_expiracion = null,
      estado
    } = data;

    // resolver id_tipo_documento_persona
    const tipoRes = await pool.query<{ id_tipo_documento_persona: string }>(
      `SELECT id_tipo_documento_persona
         FROM tipo_documento_persona
        WHERE nombre = $1;`,
      [tipo_documento]
    );
    if (!tipoRes.rows.length) {
      throw new Error(`Tipo de documento "${tipo_documento}" no existe`);
    }
    const id_tipo = tipoRes.rows[0].id_tipo_documento_persona;

    // insertar
    await pool.query(
      `
      INSERT INTO trn_documento_persona
        (id_persona, id_tipo_documento_persona, numero, fecha_emision, emisor,
         fecha_inicio_vigencia, fecha_fin_vigencia, nemonico, estado)
      VALUES
        ($1, $2, $3, $4, $5, $4, $6,
         substring(gen_random_uuid()::text,1,30), $7);
      `,
      [
        id_persona,
        id_tipo,
        numero_documento,
        fecha_emision,
        entidad_emisora,
        fecha_expiracion,
        estado
      ]
    );

    // devolvemos la PK principal (id_persona)
    return id_persona;
  }

  /** Listar documentos de persona (tabla + paginación) */
  static async findAll(filters: DocumentoPersonaFilter) {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.id_persona) {
      clauses.push(`tcp.id_persona = $${idx++}`);
      params.push(filters.id_persona);
    }
    if (filters.tipo_documento) {
      clauses.push(`dtp.nombre = $${idx++}`);
      params.push(filters.tipo_documento);
    }
    if (filters.estado) {
      clauses.push(`tcp.estado = $${idx++}`);
      params.push(filters.estado);
    }
    if (filters.entidad_emisora) {
      clauses.push(`tcp.emisor = $${idx++}`);
      params.push(filters.entidad_emisora);
    }
    if (filters.fecha_emision) {
      clauses.push(`to_char(tcp.fecha_emision,'YYYY-MM-DD') = $${idx++}`);
      params.push(filters.fecha_emision);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const offset = (page - 1) * limit;

    // total
    const totRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
         FROM trn_documento_persona tcp
         JOIN tipo_documento_persona dtp ON dtp.id_tipo_documento_persona = tcp.id_tipo_documento_persona
       ${where};`,
      params
    );
    const total = parseInt(totRes.rows[0].count, 10);
    const pages = Math.ceil(total / limit);

    // datos
    const dataRes = await pool.query(
      `
      SELECT
        tcp.id_persona                             AS id_documento_persona,
        dtp.nombre                                 AS tipo_documento,
        tcp.numero                                 AS numero_documento,
        to_char(tcp.fecha_emision,'YYYY-MM-DD')    AS fecha_emision,
        tcp.emisor                                 AS entidad_emisora,
        json_build_object('id', st.id_estado, 'nombre', st.nombre) AS estado
      FROM trn_documento_persona tcp
      JOIN tipo_documento_persona dtp
        ON dtp.id_tipo_documento_persona = tcp.id_tipo_documento_persona
      LEFT JOIN estado st
        ON st.id_estado = tcp.estado
      ${where}
      ORDER BY tcp.fecha_inicio_vigencia DESC
      LIMIT $${idx++} OFFSET $${idx++};
      `,
      [...params, limit, offset]
    );

    return { data: dataRes.rows, pagination: { total, page, limit, pages } };
  }

  /** Obtener un documento-persona por id_persona (el más reciente) */
  static async findById(id_persona: string) {
    const pool = await this.getPool();
    const res = await pool.query(
      `
      SELECT
        tcp.id_persona                             AS id_documento_persona,
        dtp.nombre                                 AS tipo_documento,
        tcp.numero                                 AS numero_documento,
        to_char(tcp.fecha_emision,'YYYY-MM-DD')    AS fecha_emision,
        tcp.emisor                                 AS entidad_emisora,
        json_build_object('id', st.id_estado, 'nombre', st.nombre) AS estado
      FROM trn_documento_persona tcp
      JOIN tipo_documento_persona dtp
        ON dtp.id_tipo_documento_persona = tcp.id_tipo_documento_persona
      LEFT JOIN estado st
        ON st.id_estado = tcp.estado
      WHERE tcp.id_persona = $1
      ORDER BY tcp.fecha_inicio_vigencia DESC
      LIMIT 1;
      `,
      [id_persona]
    );
    return res.rows[0] || null;
  }

  /** Actualizar un documento-persona existente */
  static async update(
    id_persona: string,
    data: Partial<DocumentoPersonaDTO>
  ): Promise<void> {
    const pool = await this.getPool();
    const {
      numero_documento,
      fecha_emision,
      fecha_expiracion,
      entidad_emisora,
      estado
    } = data;

    // obtener PK real
    const pkRes = await pool.query<{
      id_tipo_documento_persona: string;
      fecha_inicio_vigencia: string;
    }>(
      `
      SELECT id_tipo_documento_persona,
             to_char(fecha_inicio_vigencia,'YYYY-MM-DD') AS fecha_inicio_vigencia
        FROM trn_documento_persona
       WHERE id_persona = $1
       ORDER BY fecha_inicio_vigencia DESC
       LIMIT 1;
      `,
      [id_persona]
    );
    if (!pkRes.rowCount) {
      throw new Error('Documento no encontrado para actualizar');
    }
    const { id_tipo_documento_persona, fecha_inicio_vigencia } = pkRes.rows[0];

    // actualizar
    await pool.query(
      `
      UPDATE trn_documento_persona
         SET numero             = COALESCE($2, numero),
             fecha_emision      = COALESCE($3, fecha_emision),
             fecha_fin_vigencia = COALESCE($4, fecha_fin_vigencia),
             emisor             = COALESCE($5, emisor),
             estado             = COALESCE($6, estado)
       WHERE id_persona               = $1
         AND id_tipo_documento_persona = $7
         AND fecha_inicio_vigencia     = $8;
      `,
      [
        id_persona,
        numero_documento,
        fecha_emision,
        fecha_expiracion,
        entidad_emisora,
        estado,
        id_tipo_documento_persona,
        fecha_inicio_vigencia
      ]
    );
  }

  /** Inactivar un documento-persona (DELETE lógico) */
  static async deactivate(id_persona: string): Promise<void> {
    const pool = await this.getPool();
    const inactiveStateId = process.env.INACTIVE_STATE_ID;
    if (!inactiveStateId) {
      throw new Error('INACTIVE_STATE_ID no está definido en el entorno');
    }

    // obtener PK real
    const pkRes = await pool.query<{
      id_tipo_documento_persona: string;
      fecha_inicio_vigencia: string;
    }>(
      `
      SELECT id_tipo_documento_persona,
             to_char(fecha_inicio_vigencia,'YYYY-MM-DD') AS fecha_inicio_vigencia
        FROM trn_documento_persona
       WHERE id_persona = $1
       ORDER BY fecha_inicio_vigencia DESC
       LIMIT 1;
      `,
      [id_persona]
    );
    if (!pkRes.rowCount) {
      throw new Error('Documento no encontrado para inactivar');
    }
    const { id_tipo_documento_persona, fecha_inicio_vigencia } = pkRes.rows[0];

    await pool.query(
      `
      UPDATE trn_documento_persona
         SET estado = $2
       WHERE id_persona               = $1
         AND id_tipo_documento_persona = $3
         AND fecha_inicio_vigencia     = $4;
      `,
      [id_persona, inactiveStateId, id_tipo_documento_persona, fecha_inicio_vigencia]
    );
  }
}
