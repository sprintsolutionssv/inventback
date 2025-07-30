import { Pool, QueryConfig } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface ProductoFilter {
  page?: number;
  size?: number;
  sort?: string;
  sku?: string;
  categoria?: string;
  precio_min?: number;
  precio_max?: number;
}

export interface ProductoDTO {
  sku: string;
  nombre: string;
  descripcion?: string;
  unidad_medida: string;
  categoria: string;
  precio_base: number;
  total_unidades: number;
  saldo: number;
  fecha_inicio?: string;       // YYYY-MM-DD
  fecha_vencimiento?: string;  // YYYY-MM-DD
  proveedores?: string[];
  usuario_creacion?: string;
}

export interface ProductoDetailDTO extends ProductoDTO {
  id_producto: string;
  estado: string;
  fecha_creacion: string;
}

export default class ProductoModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  static async findAll(filters: ProductoFilter) {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.sku) {
      clauses.push(`p.sku ILIKE '%'||$${idx++}||'%'`);
      params.push(filters.sku);
    }
    if (filters.categoria) {
      clauses.push(`p.categoria ILIKE '%'||$${idx++}||'%'`);
      params.push(filters.categoria);
    }
    if (filters.precio_min != null) {
      clauses.push(`p.precio_base >= $${idx++}`);
      params.push(filters.precio_min);
    }
    if (filters.precio_max != null) {
      clauses.push(`p.precio_base <= $${idx++}`);
      params.push(filters.precio_max);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const order = filters.sort
      ? (() => {
          const dir = filters.sort!.startsWith('-') ? 'DESC' : 'ASC';
          const fld = filters.sort!.replace(/^-/, '');
          if (['sku','nombre','categoria','precio_base','total_unidades','saldo'].includes(fld)) {
            return `ORDER BY p.${fld} ${dir}`;
          }
          return 'ORDER BY p.nombre ASC';
        })()
      : 'ORDER BY p.nombre ASC';

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const size = filters.size && filters.size > 0 ? filters.size : 20;
    const offset = (page - 1) * size;

    const tot = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM producto p ${where};`,
      params
    );
    const total_items = parseInt(tot.rows[0].count, 10);
    const total_pages = Math.ceil(total_items / size);

    const q = `
      SELECT
        p.id_producto, p.sku, p.nombre, p.descripcion, p.unidad_medida, p.categoria,
        p.precio_base, p.total_unidades, p.saldo,
        p.fecha_inicio, p.fecha_vencimiento,
        p.estado, p.fecha_creacion, p.usuario_creacion
      FROM producto p
      ${where}
      ${order}
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const dataRes = await pool.query(q, [...params, size, offset]);

    return {
      data: dataRes.rows,
      pagination: { page, size, total_pages, total_items }
    };
  }

  static async findById(id: string): Promise<ProductoDetailDTO> {
    const pool = await this.getPool();
    const q = `
      SELECT
        id_producto, sku, nombre, descripcion, unidad_medida, categoria,
        precio_base, total_unidades, saldo,
        fecha_inicio, fecha_vencimiento,
        estado, fecha_creacion, usuario_creacion
      FROM producto
      WHERE id_producto = $1;
    `;
    const res = await pool.query<ProductoDetailDTO>(q, [id]);
    if (res.rowCount === 0) {
      throw { status: 404, message: 'Producto no encontrado' };
    }
    return res.rows[0];
  }

  static async create(dto: ProductoDTO): Promise<{ id_producto: string; message: string }> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ex = await client.query('SELECT 1 FROM producto WHERE sku = $1', [dto.sku]);
      if (ex.rowCount) throw { status: 409, message: 'SKU ya existe' };

      const st = await client.query<{ id_estado: string }>(
        `SELECT id_estado FROM estado WHERE codigo_estado = 'ACT' AND es_activo = TRUE LIMIT 1;`
      );
      if (st.rowCount === 0) throw { status: 500, message: 'Estado activo no configurado' };
      const activeState = st.rows[0].id_estado;

      const insert: QueryConfig = {
        text: `
          INSERT INTO producto
            (sku,nombre,descripcion,unidad_medida,categoria,
             precio_base,total_unidades,saldo,fecha_inicio,fecha_vencimiento,
             estado,usuario_creacion)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          RETURNING id_producto;
        `,
        values: [
          dto.sku,
          dto.nombre,
          dto.descripcion || null,
          dto.unidad_medida,
          dto.categoria,
          dto.precio_base,
          dto.total_unidades,
          dto.saldo,
          dto.fecha_inicio || null,
          dto.fecha_vencimiento || null,
          activeState,
          dto.usuario_creacion || null
        ]
      };
      const r = await client.query<{ id_producto: string }>(insert);
      await client.query('COMMIT');
      return { id_producto: r.rows[0].id_producto, message: 'Producto creado exitosamente.' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async update(
    id: string,
    dto: ProductoDTO
  ): Promise<{ id_producto: string; message: string }> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ex = await client.query('SELECT sku FROM producto WHERE id_producto = $1', [id]);
      if (ex.rowCount === 0) throw { status: 404, message: 'Producto no encontrado' };

      if (dto.sku !== ex.rows[0].sku) {
        const dup = await client.query('SELECT 1 FROM producto WHERE sku = $1', [dto.sku]);
        if (dup.rowCount) throw { status: 409, message: 'SKU ya existe' };
      }

      await client.query(
        `
        UPDATE producto SET
          sku = $1,
          nombre = $2,
          descripcion = $3,
          unidad_medida = $4,
          categoria = $5,
          precio_base = $6,
          total_unidades = $7,
          saldo = $8,
          fecha_inicio = $9,
          fecha_vencimiento = $10,
          usuario_creacion = $11
        WHERE id_producto = $12;
        `,
        [
          dto.sku,
          dto.nombre,
          dto.descripcion || null,
          dto.unidad_medida,
          dto.categoria,
          dto.precio_base,
          dto.total_unidades,
          dto.saldo,
          dto.fecha_inicio || null,
          dto.fecha_vencimiento || null,
          dto.usuario_creacion || null,
          id
        ]
      );

      await client.query('COMMIT');
      return { id_producto: id, message: 'Producto actualizado exitosamente.' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async delete(id: string): Promise<void> {
    const pool = await this.getPool();
    const res = await pool.query('DELETE FROM producto WHERE id_producto = $1', [id]);
    if (res.rowCount === 0) {
      throw { status: 404, message: 'Producto no encontrado' };
    }
  }
}
