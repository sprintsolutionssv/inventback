import { Pool, QueryConfig } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface AlmacenFilter {
  page?: number;
  size?: number;
  sort?: string;
  codigo?: string;
  nombre?: string;
  tipo?: string;
}

export interface AlmacenDTO {
  codigo: string;
  nombre: string;
  tipo: string;
  direccion?: string;
}

export interface AlmacenDetailDTO {
  id_almacen: string;
  codigo: string;
  nombre: string;
  tipo: string;
  direccion?: string;
  estado: string;
  fecha_creacion: string;
  usuario_creacion?: string;
  total_estantes: number;
}

export default class AlmacenModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  static async findAll(filters: AlmacenFilter): Promise<{
    data: AlmacenDetailDTO[];
    pagination: { page: number; size: number; total_pages: number; total_items: number };
  }> {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (filters.codigo) {
      clauses.push(`a.codigo ILIKE '%' || $${i++} || '%'`);
      params.push(filters.codigo);
    }
    if (filters.nombre) {
      clauses.push(`a.nombre ILIKE '%' || $${i++} || '%'`);
      params.push(filters.nombre);
    }
    if (filters.tipo) {
      clauses.push(`a.tipo ILIKE '%' || $${i++} || '%'`);
      params.push(filters.tipo);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const order = filters.sort
      ? (() => {
          const dir = filters.sort!.startsWith('-') ? 'DESC' : 'ASC';
          const fld = filters.sort!.replace(/^-/, '');
          const allowed = ['codigo', 'nombre', 'tipo', 'fecha_creacion'];
          return `ORDER BY a.${allowed.includes(fld) ? fld : 'nombre'} ${dir}`;
        })()
      : 'ORDER BY a.nombre ASC';

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const size = filters.size && filters.size > 0 ? filters.size : 20;
    const offset = (page - 1) * size;

    const totRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM almacen a ${where};`,
      params
    );
    const total_items = parseInt(totRes.rows[0].count, 10);
    const total_pages = Math.ceil(total_items / size);

    const q = `
      SELECT
        a.id_almacen, a.codigo, a.nombre, a.tipo, a.direccion,
        a.estado, a.fecha_creacion, a.usuario_creacion,
        COALESCE(COUNT(e.id_estante), 0) AS total_estantes
      FROM almacen a
      LEFT JOIN estante e ON e.id_almacen = a.id_almacen
      ${where}
      GROUP BY a.id_almacen
      ${order}
      LIMIT $${i++} OFFSET $${i++};
    `;
    const res = await pool.query<any>(q, [...params, size, offset]);

    return {
      data: res.rows.map(r => ({
        id_almacen: r.id_almacen,
        codigo: r.codigo,
        nombre: r.nombre,
        tipo: r.tipo,
        direccion: r.direccion,
        estado: r.estado,
        fecha_creacion: r.fecha_creacion?.toISOString?.().substring(0,10) ?? r.fecha_creacion,
        usuario_creacion: r.usuario_creacion,
        total_estantes: Number(r.total_estantes)
      })),
      pagination: { page, size, total_pages, total_items }
    };
  }

  static async findById(id: string): Promise<AlmacenDetailDTO> {
    const pool = await this.getPool();
    const q = `
      SELECT
        a.id_almacen, a.codigo, a.nombre, a.tipo, a.direccion,
        a.estado, a.fecha_creacion, a.usuario_creacion,
        COALESCE(COUNT(e.id_estante), 0) AS total_estantes
      FROM almacen a
      LEFT JOIN estante e ON e.id_almacen = a.id_almacen
      WHERE a.id_almacen = $1
      GROUP BY a.id_almacen;
    `;
    const res = await pool.query<any>(q, [id]);
    if (!res.rowCount) throw { status: 404, message: 'Almacén no encontrado' };
    const r = res.rows[0];
    return {
      id_almacen: r.id_almacen,
      codigo: r.codigo,
      nombre: r.nombre,
      tipo: r.tipo,
      direccion: r.direccion,
      estado: r.estado,
      fecha_creacion: r.fecha_creacion?.toISOString?.().substring(0,10) ?? r.fecha_creacion,
      usuario_creacion: r.usuario_creacion,
      total_estantes: Number(r.total_estantes)
    };
  }

  static async create(dto: AlmacenDTO): Promise<{ id_almacen: string; message: string }> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dup = await client.query('SELECT 1 FROM almacen WHERE codigo = $1', [dto.codigo]);
      if (dup.rowCount) throw { status: 409, message: 'Código ya existe' };

      const st = await client.query<{ id_estado: string }>(
        `SELECT id_estado FROM estado WHERE codigo_estado='ACT' AND es_activo=TRUE LIMIT 1;`
      );
      if (!st.rowCount) throw { status: 500, message: 'Estado activo no configurado' };
      const activeState = st.rows[0].id_estado;

      const insert: QueryConfig = {
        text: `
          INSERT INTO almacen
            (codigo, nombre, tipo, direccion, estado, usuario_creacion)
          VALUES ($1,$2,$3,$4,$5,NULL)
          RETURNING id_almacen;
        `,
        values: [dto.codigo, dto.nombre, dto.tipo, dto.direccion || null, activeState]
      };
      const r = await client.query<{ id_almacen: string }>(insert);
      await client.query('COMMIT');
      return { id_almacen: r.rows[0].id_almacen, message: 'Almacén creado exitosamente.' };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async update(
    id: string,
    dto: AlmacenDTO
  ): Promise<{ id_almacen: string; message: string }> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ex = await client.query('SELECT codigo FROM almacen WHERE id_almacen = $1', [id]);
      if (!ex.rowCount) throw { status: 404, message: 'Almacén no encontrado' };
      if (dto.codigo !== ex.rows[0].codigo) {
        const dup = await client.query('SELECT 1 FROM almacen WHERE codigo = $1', [dto.codigo]);
        if (dup.rowCount) throw { status: 409, message: 'Código ya existe' };
      }

      await client.query(
        `
        UPDATE almacen SET
          codigo = $1,
          nombre = $2,
          tipo = $3,
          direccion = $4
        WHERE id_almacen = $5;
        `,
        [dto.codigo, dto.nombre, dto.tipo, dto.direccion || null, id]
      );

      await client.query('COMMIT');
      return { id_almacen: id, message: 'Almacén actualizado exitosamente.' };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async delete(id: string): Promise<void> {
    const pool = await this.getPool();
    const res = await pool.query('DELETE FROM almacen WHERE id_almacen = $1', [id]);
    if (!res.rowCount) throw { status: 404, message: 'Almacén no encontrado' };
  }
}
