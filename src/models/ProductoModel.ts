// src/models/ProductoModel.ts
import { Pool, QueryConfig } from 'pg';
import ConnectionManager from '../connection/ConnectionManager';

export interface ProveedorSummary {
  id_persona: string;
  nombre_completo: string;
}

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
  proveedores?: string[];      // IDs de proveedores
}

export interface ProductoDetailDTO {
  id_producto: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  unidad_medida: string;
  categoria: string;
  precio_base: number;
  total_unidades: number;
  saldo: number;
  fecha_inicio?: string;
  fecha_vencimiento?: string;
  estado: string;
  fecha_creacion: string;
  usuario_creacion?: string;
  proveedores: ProveedorSummary[];
}

export default class ProductoModel {
  private static async getPool(): Promise<Pool> {
    return (await ConnectionManager.getConnection('postgres')) as Pool;
  }

  /** Listado con agregación de proveedores y nombre desde nombre_persona */
  static async findAll(filters: ProductoFilter): Promise<{
    data: ProductoDetailDTO[];
    pagination: { page: number; size: number; total_pages: number; total_items: number };
  }> {
    const pool = await this.getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.sku) {
      clauses.push(`p.sku ILIKE '%' || $${idx++} || '%'`);
      params.push(filters.sku);
    }
    if (filters.categoria) {
      clauses.push(`p.categoria ILIKE '%' || $${idx++} || '%'`);
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

    // total count
    const totRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM producto p ${where};`,
      params
    );
    const total_items = parseInt(totRes.rows[0].count, 10);
    const total_pages = Math.ceil(total_items / size);

    // main query: join producto_proveedor -> persona -> nombre_persona
    const q = `
      SELECT
        p.id_producto, p.sku, p.nombre, p.descripcion, p.unidad_medida, p.categoria,
        p.precio_base, p.total_unidades, p.saldo,
        p.fecha_inicio, p.fecha_vencimiento,
        p.estado, p.fecha_creacion, p.usuario_creacion,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id_persona', pp.id_persona_proveedor,
              'nombre_completo', np.nombre_completo
            )
          ) FILTER (WHERE pp.id_persona_proveedor IS NOT NULL),
          '[]'
        ) AS proveedores
      FROM producto p
      LEFT JOIN producto_proveedor pp 
        ON pp.id_producto = p.id_producto
      LEFT JOIN persona per 
        ON pp.id_persona_proveedor = per.id_persona
      LEFT JOIN nombre_persona np 
        ON per.id_nombre_persona = np.id_nombre_persona
        AND np.fecha_fin_vigencia IS NULL
      ${where}
      GROUP BY p.id_producto
      ${order}
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const dataRes = await pool.query<any>(q, [...params, size, offset]);

    return {
      data: dataRes.rows.map(r => ({
        id_producto: r.id_producto,
        sku: r.sku,
        nombre: r.nombre,
        descripcion: r.descripcion,
        unidad_medida: r.unidad_medida,
        categoria: r.categoria,
        precio_base: parseFloat(r.precio_base),
        total_unidades: r.total_unidades,
        saldo: r.saldo,
        fecha_inicio: r.fecha_inicio ? r.fecha_inicio.toISOString().substring(0,10) : undefined,
        fecha_vencimiento: r.fecha_vencimiento ? r.fecha_vencimiento.toISOString().substring(0,10) : undefined,
        estado: r.estado,
        fecha_creacion: r.fecha_creacion.toISOString().substring(0,10),
        usuario_creacion: r.usuario_creacion,
        proveedores: r.proveedores as ProveedorSummary[]
      })),
      pagination: { page, size, total_pages, total_items }
    };
  }

  /** Detalle por ID, igual con nombre desde nombre_persona */
  static async findById(id: string): Promise<ProductoDetailDTO> {
    const pool = await this.getPool();
    const q = `
      SELECT
        p.id_producto, p.sku, p.nombre, p.descripcion, p.unidad_medida, p.categoria,
        p.precio_base, p.total_unidades, p.saldo,
        p.fecha_inicio, p.fecha_vencimiento,
        p.estado, p.fecha_creacion, p.usuario_creacion,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id_persona', pp.id_persona_proveedor,
              'nombre_completo', np.nombre_completo
            )
          ) FILTER (WHERE pp.id_persona_proveedor IS NOT NULL),
          '[]'
        ) AS proveedores
      FROM producto p
      LEFT JOIN producto_proveedor pp 
        ON pp.id_producto = p.id_producto
      LEFT JOIN persona per 
        ON pp.id_persona_proveedor = per.id_persona
      LEFT JOIN nombre_persona np 
        ON per.id_nombre_persona = np.id_nombre_persona
        AND np.fecha_fin_vigencia IS NULL
      WHERE p.id_producto = $1
      GROUP BY p.id_producto;
    `;
    const res = await pool.query<any>(q, [id]);
    if (res.rowCount === 0) throw { status: 404, message: 'Producto no encontrado' };
    const r = res.rows[0];
    return {
      id_producto: r.id_producto,
      sku: r.sku,
      nombre: r.nombre,
      descripcion: r.descripcion,
      unidad_medida: r.unidad_medida,
      categoria: r.categoria,
      precio_base: parseFloat(r.precio_base),
      total_unidades: r.total_unidades,
      saldo: r.saldo,
      fecha_inicio: r.fecha_inicio ? r.fecha_inicio.toISOString().substring(0,10) : undefined,
      fecha_vencimiento: r.fecha_vencimiento ? r.fecha_vencimiento.toISOString().substring(0,10) : undefined,
      estado: r.estado,
      fecha_creacion: r.fecha_creacion.toISOString().substring(0,10),
      usuario_creacion: r.usuario_creacion,
      proveedores: r.proveedores as ProveedorSummary[]
    };
  }


  /** Crea producto y relaciones a proveedores */
  static async create(dto: ProductoDTO): Promise<{ id_producto: string; message: string }> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // validación SKU único
      const ex = await client.query('SELECT 1 FROM producto WHERE sku = $1', [dto.sku]);
      if (ex.rowCount) throw { status: 409, message: 'SKU ya existe' };

      // estado activo
      const st = await client.query<{ id_estado: string }>(
        `SELECT id_estado FROM estado WHERE codigo_estado='ACT' AND es_activo=TRUE LIMIT 1;`
      );
      if (!st.rowCount) throw { status: 500, message: 'Estado activo no configurado' };
      const activeState = st.rows[0].id_estado;

      // inserto producto
      const insert: QueryConfig = {
        text: `
          INSERT INTO producto
            (sku,nombre,descripcion,unidad_medida,categoria,
             precio_base,total_unidades,saldo,fecha_inicio,fecha_vencimiento,
             estado,usuario_creacion)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
          null
        ]
      };
      const r = await client.query<{ id_producto: string }>(insert);
      const newId = r.rows[0].id_producto;

      // ASIGNAR proveedores
      if (dto.proveedores && dto.proveedores.length) {
        for (const idProv of dto.proveedores) {
          await client.query(
            `INSERT INTO producto_proveedor
               (id_producto, id_persona_proveedor, fecha_creacion, usuario_creacion)
             VALUES ($1, $2, CURRENT_DATE, NULL);`,
            [newId, idProv]
          );
        }
      }

      await client.query('COMMIT');
      return { id_producto: newId, message: 'Producto creado exitosamente.' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Actualiza producto y resetea relaciones a proveedores */
 // src/models/ProductoModel.ts

static async update(
  id: string,
  dto: ProductoDTO
): Promise<{ id_producto: string; message: string }> {
  const pool = await this.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Verificar existencia y unicidad de SKU
    const ex = await client.query('SELECT sku FROM producto WHERE id_producto = $1', [id]);
    if (ex.rowCount === 0) throw { status: 404, message: 'Producto no encontrado' };
    if (dto.sku !== ex.rows[0].sku) {
      const dup = await client.query('SELECT 1 FROM producto WHERE sku = $1', [dto.sku]);
      if (dup.rowCount) throw { status: 409, message: 'SKU ya existe' };
    }

    // 2) Actualizar campos básicos del producto (sin usuario_creacion)
    await client.query(
      `
      UPDATE producto SET
        sku               = $1,
        nombre            = $2,
        descripcion       = $3,
        unidad_medida     = $4,
        categoria         = $5,
        precio_base       = $6,
        total_unidades    = $7,
        saldo             = $8,
        fecha_inicio      = $9,
        fecha_vencimiento = $10
      WHERE id_producto = $11;
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
        id
      ]
    );

    // 3) Sincronizar proveedores
    if (Array.isArray(dto.proveedores)) {
      // Borrar todas las relaciones antiguas
      await client.query(
        `DELETE FROM producto_proveedor WHERE id_producto = $1;`,
        [id]
      );
      // Insertar las nuevas
      for (const provId of dto.proveedores) {
        await client.query(
          `INSERT INTO producto_proveedor (id_producto, id_persona_proveedor, fecha_creacion)
           VALUES ($1, $2, CURRENT_DATE);`,
          [id, provId]
        );
      }
    }

    await client.query('COMMIT');
    return { id_producto: id, message: 'Producto actualizado exitosamente.' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

  /** Elimina (física) o lanza 404 si no existe */
  static async delete(id: string): Promise<void> {
    const pool = await this.getPool();
    const res = await pool.query('DELETE FROM producto WHERE id_producto = $1', [id]);
    if (!res.rowCount) throw { status: 404, message: 'Producto no encontrado' };
  }
}
