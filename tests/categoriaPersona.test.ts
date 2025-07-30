import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testEstadoActivoId: string;
let testEstadoInactivoId: string;
let nuevaCategoriaId: string;

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // Limpiamos tablas involucradas para evitar duplicados
  await pool.query('TRUNCATE categoria_persona CASCADE;');
  await pool.query('TRUNCATE estado CASCADE;');

  // Insertamos dos estados (activo e inactivo) para usar en tests
  const activoRes = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion)
    VALUES ('TST', 'Estado Test Activo', 'jest')
    RETURNING id_estado;
  `);
  testEstadoActivoId = activoRes.rows[0].id_estado;

  const inactRes = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
    VALUES ('INA', 'Estado Inactivo', 'jest', false)
    RETURNING id_estado;
  `);
  testEstadoInactivoId = inactRes.rows[0].id_estado;

  process.env.INACTIVE_STATE_ID = testEstadoInactivoId;
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('CRUD /api/categorias-persona', () => {
  it('POST /api/categorias-persona crea una categoría', async () => {
    const res = await request(app)
      .post('/api/categorias-persona')
      .send({
        nombre: 'Empleado',
        descripcion: 'Personas contratadas formalmente',
        estado: testEstadoActivoId
      })
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_categoria_persona');
    nuevaCategoriaId = res.body.id_categoria_persona;
  });

  it('GET /api/categorias-persona lista paginada', async () => {
    const res = await request(app).get('/api/categorias-persona?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('GET /api/categorias-persona/:id devuelve detalle', async () => {
    const res = await request(app).get(`/api/categorias-persona/${nuevaCategoriaId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_categoria_persona', nuevaCategoriaId);
  });

  it('PUT /api/categorias-persona/:id actualiza categoría', async () => {
    const res = await request(app)
      .put(`/api/categorias-persona/${nuevaCategoriaId}`)
      .send({
        nombre: 'Empleado Actualizado',
        descripcion: 'Descripción actualizada',
        estado: testEstadoActivoId
      })
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Categoría actualizada correctamente');
  });

  it('DELETE /api/categorias-persona/:id inactiva categoría', async () => {
    const res = await request(app).delete(`/api/categorias-persona/${nuevaCategoriaId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Categoría inactivada correctamente');
  });
});
