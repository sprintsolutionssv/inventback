// src/models/DocumentoModel.ts
import { Pool } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface DocumentoDTO {
  id_persona: string;
  tipo_documento: string;
  numero_documento: string;
  entidad_emisora: string;
  fecha_emision: string; // YYYY-MM-DD
  estado: string;        // UUID de estado
}

export interface DocumentoFilter {
  id_persona?: string;
  tipo_documento?: string;
  numero_documento?: string;
  estado?: string;
  entidad_emisora?: string;
  fecha_emision?: string;
  page?: number;
  limit?: number;
}

export class DocumentoModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  /** Crear o actualizar (upsert) un documento */
  static async create(data: DocumentoDTO): Promise<string> {
    const pool = await this.getPool();
    const {
      id_persona,
      tipo_documento,
      numero_documento,
      entidad_emisora,
      fecha_emision,
      estado
    } = data;

    // 1) Resolver id_tipo_documento_persona
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

    // 2) Upsert: si existe la clave (id_persona, id_tipo, fecha_emision) actualiza, si no inserta
    const res = await pool.query<{ id_documento: string }>(
      `
      INSERT INTO trn_documento_persona
        (id_persona, id_tipo_documento_persona, numero, fecha_emision, emisor,
         fecha_inicio_vigencia, nemonico, estado)
      VALUES
        ($1, $2, $3, $4, $5, $4,
         substring(gen_random_uuid()::text,1,30), $6)
      ON CONFLICT (id_persona, id_tipo_documento_persona, fecha_inicio_vigencia)
      DO UPDATE SET
        numero        = EXCLUDED.numero,
        fecha_emision = EXCLUDED.fecha_emision,
        emisor        = EXCLUDED.emisor,
        estado        = EXCLUDED.estado
      RETURNING id_persona AS id_documento;
      `,
      [
        id_persona,
        id_tipo,
        numero_documento,
        fecha_emision,
        entidad_emisora,
        estado
      ]
    );

    return res.rows[0].id_documento;
  }

  /** Listar documentos con filtros + paginación */
  static async findAll(filters: DocumentoFilter) {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.id_persona) {
      clauses.push(`tcp.id_persona = $${idx++}`);
      params.push(filters.id_persona);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const offset = (page - 1) * limit;

    const totRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM trn_documento_persona tcp ${where};`,
      params
    );
    const total = parseInt(totRes.rows[0].count, 10);
    const pages = Math.ceil(total / limit);

    const dataRes = await pool.query(
      `
      SELECT
        tcp.id_persona                             AS id_documento,
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

    return {
      data: dataRes.rows,
      pagination: { total, page, limit, pages }
    };
  }

  /** Obtener el documento más reciente para un id_persona */
  static async findById(id_persona: string) {
    const pool = await this.getPool();
    const res = await pool.query(
      `
      SELECT
        tcp.id_persona                          AS id_documento,
        dtp.nombre                              AS tipo_documento,
        tcp.numero                              AS numero_documento,
        to_char(tcp.fecha_emision,'YYYY-MM-DD') AS fecha_emision,
        tcp.emisor                              AS entidad_emisora,
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

  /** Actualizar el documento más reciente */
  static async update(id_persona: string, data: Partial<DocumentoDTO>) {
    const pool = await this.getPool();
    const { numero_documento, fecha_emision, entidad_emisora, estado } = data;

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
    if (!pkRes.rowCount) throw new Error('Documento no encontrado para actualizar');

    const { id_tipo_documento_persona, fecha_inicio_vigencia } = pkRes.rows[0];
    await pool.query(
      `
      UPDATE trn_documento_persona
         SET numero        = COALESCE($2, numero),
             fecha_emision = COALESCE($3, fecha_emision),
             emisor        = COALESCE($4, emisor),
             estado        = COALESCE($5, estado)
       WHERE id_persona               = $1
         AND id_tipo_documento_persona = $6
         AND fecha_inicio_vigencia     = $7;
      `,
      [
        id_persona,
        numero_documento,
        fecha_emision,
        entidad_emisora,
        estado,
        id_tipo_documento_persona,
        fecha_inicio_vigencia
      ]
    );
  }

  /** Inactivar (lógica “delete”) el documento más reciente */
  static async deactivate(id_persona: string) {
    const pool = await this.getPool();
    const inactiveStateId = process.env.INACTIVE_STATE_ID;
    if (!inactiveStateId) throw new Error('INACTIVE_STATE_ID no está definido');

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
    if (!pkRes.rowCount) throw new Error('Documento no encontrado para inactivar');

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
