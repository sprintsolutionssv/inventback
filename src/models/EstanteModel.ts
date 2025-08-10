import { Pool, QueryConfig } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface EstanteFilter {
  page?: number;
  size?: number;
  sort?: string;
  codigo?: string;
  ubicacion?: string;
  id_almacen?: string;
}

export interface EstanteDTO {
  id_almacen: string;
  codigo: string;
  ubicacion?: string;
}

export interface EstanteDetailDTO {
  id_estante: string;
  id_almacen: string;
  codigo: string;
  ubicacion?: string;
  estado: string;
  fecha_creacion: string;
  usuario_creacion?: string;
  almacen?: { id_almacen: string; codigo: string; nombre: string } | null;
}

export default class EstanteModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  static async findAll(filters: EstanteFilter): Promise<{
    data: EstanteDetailDTO[];
    pagination: { page: number; size: number; total_pages: number; total_items: number };
  }> {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (filters.codigo) {
      clauses.push(`e.codigo ILIKE '%' || $${i++} || '%'`);
      params.push(filters.codigo);
    }
    if (filters.ubicacion) {
      clauses.push(`e.ubicacion ILIKE '%' || $${i++} || '%'`);
      params.push(filters.ubicacion);
    }
    if (filters.id_almacen) {
      clauses.push(`e.id_almacen = $${i++}`);
      params.push(filters.id_almacen);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const order = filters.sort
      ? (() => {
          const dir = filters.sort!.startsWith('-') ? 'DESC' : 'ASC';
          const fld = filters.sort!.replace(/^-/, '');
          const allowed = ['codigo', 'ubicacion', 'fecha_creacion'];
          return `ORDER BY e.${allowed.includes(fld) ? fld : 'codigo'} ${dir}`;
        })()
      : 'ORDER BY e.codigo ASC';

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const size = filters.size && filters.size > 0 ? filters.size : 20;
    const offset = (page - 1) * size;

    const totRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM estante e ${where};`,
      params
    );
    const total_items = parseInt(totRes.rows[0].count, 10);
    const total_pages = Math.ceil(total_items / size);

    const q = `
      SELECT
        e.id_estante, e.id_almacen, e.codigo, e.ubicacion,
        e.estado, e.fecha_creacion, e.usuario_creacion,
        jsonb_build_object(
          'id_almacen', a.id_almacen,
          'codigo', a.codigo,
          'nombre', a.nombre
        ) AS almacen
      FROM estante e
      LEFT JOIN almacen a ON a.id_almacen = e.id_almacen
      ${where}
      ${order}
      LIMIT $${i++} OFFSET $${i++};
    `;
    const res = await pool.query<any>(q, [...params, size, offset]);

    return {
      data: res.rows.map(r => ({
        id_estante: r.id_estante,
        id_almacen: r.id_almacen,
        codigo: r.codigo,
        ubicacion: r.ubicacion,
        estado: r.estado,
        fecha_creacion: r.fecha_creacion?.toISOString?.().substring(0,10) ?? r.fecha_creacion,
        usuario_creacion: r.usuario_creacion,
        almacen: r.almacen
      })),
      pagination: { page, size, total_pages, total_items }
    };
  }

  static async findAllByAlmacen(id_almacen: string, filters: EstanteFilter) {
    return this.findAll({ ...filters, id_almacen });
  }

  static async findById(id: string): Promise<EstanteDetailDTO> {
    const pool = await this.getPool();
    const q = `
      SELECT
        e.id_estante, e.id_almacen, e.codigo, e.ubicacion,
        e.estado, e.fecha_creacion, e.usuario_creacion,
        jsonb_build_object(
          'id_almacen', a.id_almacen,
          'codigo', a.codigo,
          'nombre', a.nombre
        ) AS almacen
      FROM estante e
      LEFT JOIN almacen a ON a.id_almacen = e.id_almacen
      WHERE e.id_estante = $1;
    `;
    const res = await pool.query<any>(q, [id]);
    if (!res.rowCount) throw { status: 404, message: 'Estante no encontrado' };
    const r = res.rows[0];
    return {
      id_estante: r.id_estante,
      id_almacen: r.id_almacen,
      codigo: r.codigo,
      ubicacion: r.ubicacion,
      estado: r.estado,
      fecha_creacion: r.fecha_creacion?.toISOString?.().substring(0,10) ?? r.fecha_creacion,
      usuario_creacion: r.usuario_creacion,
      almacen: r.almacen
    };
  }

  static async create(dto: EstanteDTO): Promise<{ id_estante: string; message: string }> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // almacén debe existir
      const al = await client.query('SELECT 1 FROM almacen WHERE id_almacen = $1', [dto.id_almacen]);
      if (!al.rowCount) throw { status: 404, message: 'Almacén no existe' };

      // código único dentro del almacén
      const dup = await client.query(
        'SELECT 1 FROM estante WHERE id_almacen = $1 AND codigo = $2',
        [dto.id_almacen, dto.codigo]
      );
      if (dup.rowCount) throw { status: 409, message: 'Código de estante duplicado en el almacén' };

      const st = await client.query<{ id_estado: string }>(
        `SELECT id_estado FROM estado WHERE codigo_estado='ACT' AND es_activo=TRUE LIMIT 1;`
      );
      if (!st.rowCount) throw { status: 500, message: 'Estado activo no configurado' };
      const activeState = st.rows[0].id_estado;

      const insert: QueryConfig = {
        text: `
          INSERT INTO estante
            (id_almacen, codigo, ubicacion, estado, usuario_creacion)
          VALUES ($1,$2,$3,$4,NULL)
          RETURNING id_estante;
        `,
        values: [dto.id_almacen, dto.codigo, dto.ubicacion || null, activeState]
      };
      const r = await client.query<{ id_estante: string }>(insert);
      await client.query('COMMIT');
      return { id_estante: r.rows[0].id_estante, message: 'Estante creado exitosamente.' };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async update(
    id: string,
    dto: EstanteDTO
  ): Promise<{ id_estante: string; message: string }> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ex = await client.query<{ id_almacen: string; codigo: string }>(
        'SELECT id_almacen, codigo FROM estante WHERE id_estante = $1',
        [id]
      );
      if (!ex.rowCount) throw { status: 404, message: 'Estante no encontrado' };

      // validar almacén destino
      const targetAl = dto.id_almacen;
      const al = await client.query('SELECT 1 FROM almacen WHERE id_almacen = $1', [targetAl]);
      if (!al.rowCount) throw { status: 404, message: 'Almacén no existe' };

      // unicidad (por almacén)
      const movingOrRenaming =
        ex.rows[0].id_almacen !== targetAl || ex.rows[0].codigo !== dto.codigo;
      if (movingOrRenaming) {
        const dup = await client.query(
          'SELECT 1 FROM estante WHERE id_almacen = $1 AND codigo = $2',
          [targetAl, dto.codigo]
        );
        if (dup.rowCount) throw { status: 409, message: 'Código de estante duplicado en el almacén' };
      }

      await client.query(
        `
        UPDATE estante SET
          id_almacen = $1,
          codigo     = $2,
          ubicacion  = $3
        WHERE id_estante = $4;
        `,
        [dto.id_almacen, dto.codigo, dto.ubicacion || null, id]
      );

      await client.query('COMMIT');
      return { id_estante: id, message: 'Estante actualizado exitosamente.' };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async delete(id: string): Promise<void> {
    const pool = await this.getPool();
    const res = await pool.query('DELETE FROM estante WHERE id_estante = $1', [id]);
    if (!res.rowCount) throw { status: 404, message: 'Estante no encontrado' };
  }
}
