import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testEstadoId: string;
let prodId: string;
let otherId: string;

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // Crear estado ACTIVO
  const { rows } = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
    VALUES ('ACT','Activo','jest',TRUE)
    RETURNING id_estado;
  `);
  testEstadoId = rows[0].id_estado;
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('POST /api/productos', () => {
  it('201 Crea producto válido', async () => {
    const res = await request(app)
      .post('/api/productos')
      .send({
        sku: 'P-100',
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
    const res = await request(app)
      .post('/api/productos')
      .send({
        sku: 'P-100',
        nombre: 'Dup',
        unidad_medida: 'u',
        categoria: 'cat',
        precio_base: 1,
        total_unidades: 1,
        saldo: 1
      });
    expect(res.status).toBe(409);
  });

  it('400 Validación fallida', async () => {
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
    const r = await pool.query<{ id_producto: string }>(
      `INSERT INTO producto
         (sku,nombre,unidad_medida,categoria,precio_base,total_unidades,saldo,estado,usuario_creacion)
       VALUES
         ('PX','Otro','u','cat',1,1,1,$1,'jest')
       RETURNING id_producto;`,
      [testEstadoId]
    );
    otherId = r.rows[0].id_producto;
  });

  it('200 Lista productos', async () => {
    const res = await request(app).get('/api/productos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toHaveProperty('total_items');
  });

  it('400 Parámetro inválido', async () => {
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
    expect((await request(app).get('/api/productos/123')).status).toBe(400);
  });

  it('404 No existe', async () => {
    expect(
      (await request(app).get('/api/productos/00000000-0000-0000-0000-000000000000'))
        .status
    ).toBe(404);
  });
});

describe('PUT /api/productos/:id_producto', () => {
  it('200 Actualiza correctamente', async () => {
    const res = await request(app)
      .put(`/api/productos/${prodId}`)
      .send({
        sku: 'P-100-EDIT',
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
        sku: 'X',
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
    const r = await pool.query<{ id_producto: string }>(
      `INSERT INTO producto
         (sku,nombre,unidad_medida,categoria,precio_base,total_unidades,saldo,estado,usuario_creacion)
       VALUES
         ('P-DUP','Dup','u','c',1,1,1,$1,'jest')
       RETURNING id_producto;`,
      [testEstadoId]
    );
    const dupId = r.rows[0].id_producto;

    const res = await request(app)
      .put(`/api/productos/${dupId}`)
      .send({
        sku: 'P-100-EDIT',
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
    expect(
      (await request(app).delete(`/api/productos/${otherId}`)).status
    ).toBe(204);
  });

  it('404 Ya borrado', async () => {
    expect(
      (await request(app).delete(`/api/productos/${otherId}`)).status
    ).toBe(404);
  });
});
