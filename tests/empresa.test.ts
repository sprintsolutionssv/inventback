// tests/empresa.test.ts
import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testActiveStateId: string;
let testInactiveStateId: string;
let newEmpresaId: string;

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // Insertar estados de prueba
  const actRes = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion)
    VALUES ('ACT', 'Activo', 'jest')
    RETURNING id_estado;
  `);
  testActiveStateId = actRes.rows[0].id_estado;
  process.env.ACTIVE_STATE_ID = testActiveStateId;

  const inaRes = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion)
    VALUES ('INA', 'Inactivo', 'jest')
    RETURNING id_estado;
  `);
  testInactiveStateId = inaRes.rows[0].id_estado;
  process.env.INACTIVE_STATE_ID = testInactiveStateId;

  // Limpiar la tabla empresa antes de los tests
  await pool.query('TRUNCATE empresa RESTART IDENTITY CASCADE;');
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('CRUD /api/empresas', () => {
  it('POST /api/empresas crea una empresa', async () => {
    const res = await request(app)
      .post('/api/empresas')
      .set('Content-Type', 'application/json')
      .send({
        nombre: 'Comercial Delta S.A. de C.V.',
        nit: '0614-290898-101-3',
        nrc: '123456-7',
        correo_contacto: 'contacto@delta.com.sv'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_empresa');
    newEmpresaId = res.body.id_empresa;
  });

  it('GET /api/empresas lista paginada', async () => {
    const res = await request(app).get('/api/empresas?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('GET /api/empresas/:id devuelve detalle', async () => {
    const res = await request(app).get(`/api/empresas/${newEmpresaId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_empresa', newEmpresaId);
  });

  it('PUT /api/empresas/:id actualiza empresa', async () => {
    const res = await request(app)
      .put(`/api/empresas/${newEmpresaId}`)
      .set('Content-Type', 'application/json')
      .send({
        nombre: 'Delta Zona Oriental',
        correo_contacto: 'nuevo@delta.com.sv'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Empresa actualizada correctamente.');
  });

  it('DELETE /api/empresas/:id inactiva empresa', async () => {
    const res = await request(app).delete(`/api/empresas/${newEmpresaId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Empresa inactivada correctamente.');
  });
});
