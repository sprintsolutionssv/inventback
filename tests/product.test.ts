// tests/product.test.ts
import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testEstadoId: string;
let prodId: string;
let otherId: string;

// Helper para SKUs únicos por corrida
const rand = () => Math.random().toString(36).slice(2, 8).toUpperCase();

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // Asegurar estado ACT sin usar ON CONFLICT
  const found = await pool.query<{ id_estado: string }>(
    `SELECT id_estado FROM estado WHERE codigo_estado='ACT' AND es_activo=TRUE LIMIT 1;`
  );
  if (found.rowCount) {
    testEstadoId = found.rows[0].id_estado;
  } else {
    const ins = await pool.query<{ id_estado: string }>(`
      INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
      VALUES ('ACT','Activo','jest',TRUE)
      RETURNING id_estado;
    `);
    testEstadoId = ins.rows[0].id_estado;
  }
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('POST /api/productos', () => {
  it('201 Crea producto válido', async () => {
    const sku = `P-${rand()}`;
    const res = await request(app)
      .post('/api/productos')
      .send({
        sku,
        nombre: 'Test',
        unidad_medida: 'u',
        categoria: 'cat',
        precio_base: 5,
        total_unidades: 10,
        saldo: 10,
        fecha_inicio: '2025-07-01',
        fecha_vencimiento: '2025-12-31'
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_producto');
    prodId = res.body.id_producto;
  });

  it('409 SKU duplicado', async () => {
    // Reutiliza el mismo SKU que el anterior: obtiene 409
    const res0 = await request(app).get(`/api/productos/${prodId}`);
    expect(res0.status).toBe(200);
    const sku = res0.body.sku as string;

    const res = await request(app)
      .post('/api/productos')
      .send({
        sku,
        nombre: 'Dup',
        unidad_medida: 'u',
        categoria: 'cat',
        precio_base: 1,
        total_unidades: 1,
        saldo: 1
      });
    expect(res.status).toBe(409);
  });

  it('400 Validación fallida (body inválido)', async () => {
    const res = await request(app)
      .post('/api/productos')
      .send({
        sku: '',
        nombre: '',
        unidad_medida: '',
        categoria: '',
        precio_base: -1,
        total_unidades: 0,
        saldo: 1
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/productos', () => {
  beforeAll(async () => {
    // Inserta otro producto directo para asegurar listado/paginación
    const r = await pool.query<{ id_producto: string }>(
      `INSERT INTO producto
         (sku,nombre,unidad_medida,categoria,precio_base,total_unidades,saldo,estado,usuario_creacion)
       VALUES
         ($1,'Otro','u','cat',1,1,1,$2,'jest')
       RETURNING id_producto;`,
      [`PX-${rand()}`, testEstadoId]
    );
    otherId = r.rows[0].id_producto;
  });

  it('200 Lista productos', async () => {
    const res = await request(app).get('/api/productos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toHaveProperty('total_items');
  });

  it('400 Parámetro inválido (page=0)', async () => {
    const res = await request(app).get('/api/productos').query({ page: 0 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/productos/:id_producto', () => {
  it('200 Por ID válido', async () => {
    const res = await request(app).get(`/api/productos/${prodId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_producto', prodId);
  });

  it('400 UUID inválido', async () => {
    const res = await request(app).get('/api/productos/123');
    expect(res.status).toBe(400);
  });

  it('404 No existe', async () => {
    const res = await request(app).get('/api/productos/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/productos/:id_producto', () => {
  it('200 Actualiza correctamente', async () => {
    const res = await request(app)
      .put(`/api/productos/${prodId}`)
      .send({
        sku: `P-${rand()}-EDIT`,
        nombre: 'Editado',
        unidad_medida: 'u',
        categoria: 'cat',
        precio_base: 6,
        total_unidades: 12,
        saldo: 12
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Producto actualizado exitosamente.');
  });

  it('404 Al actualizar inexistente', async () => {
    const res = await request(app)
      .put('/api/productos/00000000-0000-0000-0000-000000000000')
      .send({
        sku: `PX-${rand()}`,
        nombre: 'X',
        unidad_medida: 'u',
        categoria: 'c',
        precio_base: 0,
        total_unidades: 1,
        saldo: 1
      });
    expect(res.status).toBe(404);
  });

  it('409 SKU duplicado al actualizar', async () => {
    // Crea un producto con un SKU específico
    const skuDup = `P-${rand()}-DUP`;
    const r = await pool.query<{ id_producto: string }>(
      `INSERT INTO producto
         (sku,nombre,unidad_medida,categoria,precio_base,total_unidades,saldo,estado,usuario_creacion)
       VALUES
         ($1,'Dup','u','c',1,1,1,$2,'jest')
       RETURNING id_producto;`,
      [skuDup, testEstadoId]
    );
    const dupId = r.rows[0].id_producto;

    // Obtén el SKU actual del prodId para intentar duplicarlo
    const current = await request(app).get(`/api/productos/${prodId}`);
    expect(current.status).toBe(200);
    const takenSku = current.body.sku as string;

    const res = await request(app)
      .put(`/api/productos/${dupId}`)
      .send({
        sku: takenSku, // choca contra el SKU ya tomado del producto principal
        nombre: 'DupEdit',
        unidad_medida: 'u',
        categoria: 'c',
        precio_base: 1,
        total_unidades: 1,
        saldo: 1
      });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/productos/:id_producto', () => {
  it('204 Elimina correctamente', async () => {
    const res = await request(app).delete(`/api/productos/${otherId}`);
    expect(res.status).toBe(204);
  });

  it('404 Ya borrado', async () => {
    const res = await request(app).delete(`/api/productos/${otherId}`);
    expect(res.status).toBe(404);
  });
});
