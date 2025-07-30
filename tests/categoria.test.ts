// tests/categoria.test.ts
import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let activeStateId: string;
let inactiveStateId: string;
let newCatId: string;

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  await pool.query('TRUNCATE categoria_persona CASCADE;');
  await pool.query('TRUNCATE estado CASCADE;');

  const act = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado,nombre,usuario_creacion,es_activo)
    VALUES ('ACT','Activo','jest',true) RETURNING id_estado;
  `);
  activeStateId = act.rows[0].id_estado;

  const ina = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado,nombre,usuario_creacion,es_activo)
    VALUES ('INA','Inactivo','jest',false) RETURNING id_estado;
  `);
  inactiveStateId = ina.rows[0].id_estado;
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('CRUD /api/categoria', () => {
  it('POST /api/categoria crea categoría', async () => {
    const res = await request(app)
      .post('/api/categoria')
      .send({ nombre: 'Asociado', descripcion: 'Persona asociada', estado: activeStateId })
      .set('Accept', 'application/json');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_categoria_persona');
    expect(res.body).toHaveProperty('mensaje', 'Categoría creada correctamente');
    newCatId = res.body.id_categoria_persona;
  });

  it('GET /api/categoria lista categorías', async () => {
    const res = await request(app).get('/api/categoria?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 5 });
    expect(res.body.data.find((c: any) => c.id_categoria_persona === newCatId)).toBeTruthy();
  });

  it('GET /api/categoria/:id devuelve detalle', async () => {
    const res = await request(app).get(`/api/categoria/${newCatId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_categoria_persona', newCatId);
    expect(res.body).toHaveProperty('nombre', 'Asociado');
  });

  it('PUT /api/categoria/:id actualiza categoría', async () => {
    const res = await request(app)
      .put(`/api/categoria/${newCatId}`)
      .send({ nombre: 'AsociadoX', descripcion: 'Desc X', estado: activeStateId })
      .set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Categoría actualizada correctamente');
  });

  it('DELETE /api/categoria/:id inactiva categoría', async () => {
    const res = await request(app)
      .delete(`/api/categoria/${newCatId}`)
      .set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_categoria_persona', newCatId);
    expect(res.body).toHaveProperty('mensaje', 'Categoría inactivada correctamente');
  });
});
