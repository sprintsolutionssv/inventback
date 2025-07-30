import { Pool } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface ClienteFilter {
  nit?: string;
  nrc?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  page?: number;
  limit?: number;
}

export interface ClienteDTO {
  nombre: {
    primer_nombre: string;
    segundo_nombre?: string;
    tercer_nombre?: string;
    primer_apellido: string;
    segundo_apellido?: string;
    tercer_apellido?: string;
  };
  documentos: {
    tipo_documento: string;
    numero_documento: string;
    entidad_emisora?: string;
    fecha_emision: string; // YYYY-MM-DD
  }[];
  contacto: {
    correo: string;
    telefono: string; // ####-####
  };
}

export class ClienteModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  /**
   * Listar clientes usando la vista `vista_clientes`, con filtros parciales y paginación.
   */
  static async findAll(filters: ClienteFilter) {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.nit) {
      clauses.push(`v.nit ILIKE '%' || $${idx++} || '%'`);
      params.push(filters.nit);
    }
    if (filters.nrc) {
      clauses.push(`v.nrc ILIKE '%' || $${idx++} || '%'`);
      params.push(filters.nrc);
    }
    if (filters.nombre) {
      clauses.push(`v.nombre_completo ILIKE '%' || $${idx++} || '%'`);
      params.push(filters.nombre);
    }
    if (filters.email) {
      clauses.push(`v.email_principal ILIKE '%' || $${idx++} || '%'`);
      params.push(filters.email);
    }
    if (filters.telefono) {
      clauses.push(`v.telefono_principal ILIKE '%' || $${idx++} || '%'`);
      params.push(filters.telefono);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const offset = (page - 1) * limit;

    const totRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM vista_clientes v ${where};`,
      params
    );
    const total = parseInt(totRes.rows[0].count, 10);
    const pages = Math.ceil(total / limit);

    const dataRes = await pool.query(
      `
      SELECT
        v.id_persona,
        v.nombre_completo,
        v.primer_nombre,
        v.segundo_nombre,
        v.primer_apellido,
        v.nit,
        v.nrc,
        v.email_principal,
        v.telefono_principal
      FROM vista_clientes v
      ${where}
      ORDER BY v.nombre_completo
      LIMIT $${idx++} OFFSET $${idx++};
      `,
      [...params, limit, offset]
    );

    return {
      data: dataRes.rows,
      pagination: { page, limit, total, pages }
    };
  }

  /**
   * Crear o vincular persona como cliente (idempotente)
   */
  static async create(dto: ClienteDTO): Promise<{ id_persona: string; message: string }> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1) Validar formato de teléfono
      const phoneRegex = /^\d{4}-\d{4}$/;
      if (!phoneRegex.test(dto.contacto.telefono)) {
        throw new Error('Formato de teléfono inválido');
      }

      // 2) Obtener estado activo
      const { rows: stRows } = await client.query<{ id_estado: string }>(
        `SELECT id_estado FROM estado WHERE codigo_estado = 'ACT' AND es_activo = TRUE LIMIT 1;`
      );
      if (!stRows.length) {
        throw new Error('Estado activo no configurado');
      }
      const activeStateId = stRows[0].id_estado;

      // 3) Buscar por cada documento si la persona ya existe
      for (const doc of dto.documentos) {
        const { rows: dtRows } = await client.query<{ id_tipo_documento_persona: string }>(
          `SELECT id_tipo_documento_persona FROM tipo_documento_persona WHERE nombre = $1;`,
          [doc.tipo_documento]
        );
        if (!dtRows.length) {
          throw new Error(`Tipo de documento ${doc.tipo_documento} no configurado`);
        }
        const docTypeId = dtRows[0].id_tipo_documento_persona;

        const existDoc = await client.query<{ id_persona: string }>(
          `SELECT id_persona
             FROM trn_documento_persona
            WHERE id_tipo_documento_persona = $1
              AND numero = $2
              AND estado = $3;`,
          [docTypeId, doc.numero_documento, activeStateId]
        );
        if (existDoc.rowCount) {
          const existingPersonaId = existDoc.rows[0].id_persona;

          // 3a) Vincular categoría Cliente si no existe
          const { rows: catRows } = await client.query<{ id_categoria_persona: string }>(
            `SELECT id_categoria_persona FROM categoria_persona WHERE nombre = 'Cliente';`
          );
          if (!catRows.length) {
            throw new Error('Categoría Cliente no configurada');
          }
          const cliCatId = catRows[0].id_categoria_persona;

          const existMap = await client.query(
            `SELECT 1 FROM trn_categoria_persona WHERE id_persona = $1 AND id_categoria_persona = $2;`,
            [existingPersonaId, cliCatId]
          );
          if (existMap.rowCount === 0) {
            await client.query(
              `INSERT INTO trn_categoria_persona
                 (id_persona, id_categoria_persona, fecha_inicio_vigencia, nemonico, estado)
               VALUES ($1, $2, CURRENT_DATE, 'CLTE', $3);`,
              [existingPersonaId, cliCatId, activeStateId]
            );
          }

          await client.query('COMMIT');
          return {
            id_persona: existingPersonaId,
            message: 'Persona ya existente, mapeo como cliente realizado.'
          };
        }
      }

      // 4) Si no existe: crear nombre_persona
      const fullName = [
        dto.nombre.primer_nombre,
        dto.nombre.segundo_nombre,
        dto.nombre.tercer_nombre,
        dto.nombre.primer_apellido,
        dto.nombre.segundo_apellido,
        dto.nombre.tercer_apellido
      ].filter(Boolean).join(' ');
      const nemonicoName =
        dto.nombre.primer_nombre.charAt(0) + dto.nombre.primer_apellido.charAt(0);

      const { rows: nameRows } = await client.query<{ id_nombre_persona: string }>(
        `INSERT INTO nombre_persona
           (primer_nombre, segundo_nombre, tercer_nombre, primer_apellido, segundo_apellido, tercer_apellido, nombre_completo, fecha_inicio_vigencia, nemonico)
         VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,$8)
         RETURNING id_nombre_persona;`,
        [
          dto.nombre.primer_nombre,
          dto.nombre.segundo_nombre || null,
          dto.nombre.tercer_nombre || null,
          dto.nombre.primer_apellido,
          dto.nombre.segundo_apellido || null,
          dto.nombre.tercer_apellido || null,
          fullName,
          nemonicoName
        ]
      );
      const newNameId = nameRows[0].id_nombre_persona;

      // 5) Crear persona
      const { rows: persRows } = await client.query<{ id_persona: string }>(
        `INSERT INTO persona
           (id_categoria_persona, id_nombre_persona, estado)
         VALUES
           ((SELECT id_categoria_persona FROM categoria_persona WHERE nombre = 'Cliente'), $1, $2)
         RETURNING id_persona;`,
        [newNameId, activeStateId]
      );
      const newPersonaId = persRows[0].id_persona;

      // 6) Insertar documentos
      for (const doc of dto.documentos) {
        const { rows: dt2 } = await client.query<{ id_tipo_documento_persona: string }>(
          `SELECT id_tipo_documento_persona FROM tipo_documento_persona WHERE nombre = $1;`,
          [doc.tipo_documento]
        );
        await client.query(
          `INSERT INTO trn_documento_persona
             (id_persona, id_tipo_documento_persona, numero, emisor, fecha_emision, fecha_inicio_vigencia, nemonico, estado)
           VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$6,$7);`,
          [
            newPersonaId,
            dt2[0].id_tipo_documento_persona,
            doc.numero_documento,
            doc.entidad_emisora || null,
            doc.fecha_emision,
            doc.tipo_documento,
            activeStateId
          ]
        );
      }

      // 7) Insertar contactos
      const { rows: phRows } = await client.query<{ id_tipo_contacto_persona: string }>(
        `SELECT id_tipo_contacto_persona FROM tipo_contacto_persona WHERE nombre = 'Teléfono';`
      );
      await client.query(
        `INSERT INTO trn_contacto_persona
           (id_persona, id_tipo_contacto_persona, principal, fecha_inicio_vigencia, nemonico, valor, estado)
         VALUES ($1,$2,TRUE,CURRENT_DATE,'PH',$3,$4);`,
        [newPersonaId, phRows[0].id_tipo_contacto_persona, dto.contacto.telefono, activeStateId]
      );
      const { rows: emRows } = await client.query<{ id_tipo_contacto_persona: string }>(
        `SELECT id_tipo_contacto_persona FROM tipo_contacto_persona WHERE nombre = 'Email';`
      );
      await client.query(
        `INSERT INTO trn_contacto_persona
           (id_persona, id_tipo_contacto_persona, principal, fecha_inicio_vigencia, nemonico, valor, estado)
         VALUES ($1,$2,TRUE,CURRENT_DATE,'EM',$3,$4);`,
        [newPersonaId, emRows[0].id_tipo_contacto_persona, dto.contacto.correo, activeStateId]
      );

      // 8) Vincular categoría Cliente
      const { rows: cat2 } = await client.query<{ id_categoria_persona: string }>(
        `SELECT id_categoria_persona FROM categoria_persona WHERE nombre = 'Cliente';`
      );
      await client.query(
        `INSERT INTO trn_categoria_persona
           (id_persona, id_categoria_persona, fecha_inicio_vigencia, nemonico, estado)
         VALUES ($1,$2,CURRENT_DATE,'CLTE',$3);`,
        [newPersonaId, cat2[0].id_categoria_persona, activeStateId]
      );

      await client.query('COMMIT');
      return {
        id_persona: newPersonaId,
        message: 'Persona creada y vinculada como cliente correctamente.'
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
