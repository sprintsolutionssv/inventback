import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testEstadoId: string;
let testNombreId: string;
let nuevoId: string;

beforeAll(async () => {
  // Arranca la conexión
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // Crea un estado de prueba
  const stateRes = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion)
    VALUES ('TST', 'Test Estado', 'jest')
    RETURNING id_estado;
  `);
  testEstadoId = stateRes.rows[0].id_estado;

  // Crea un nombre_persona de prueba
  const nameRes = await pool.query<{ id_nombre_persona: string }>(`
    INSERT INTO nombre_persona (nombre_completo, fecha_inicio_vigencia, nemonico)
    VALUES ('Persona Test', CURRENT_DATE, 'TEST')
    RETURNING id_nombre_persona;
  `);
  testNombreId = nameRes.rows[0].id_nombre_persona;

  // Crea un estado "inactivo" para DELETE
  const inactRes = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion)
    VALUES ('INA', 'Inactivo', 'jest')
    RETURNING id_estado;
  `);
  process.env.INACTIVE_STATE_ID = inactRes.rows[0].id_estado;
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('CRUD /api/personas', () => {
  it('POST /api/personas crea una persona', async () => {
    const res = await request(app)
      .post('/api/personas')
      .send({
        id_empresa: null,
        id_categoria_persona: null,
        id_nombre_persona: testNombreId,
        id_naturaleza: null,
        estado: testEstadoId
      })
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_persona');
    nuevoId = res.body.id_persona;
  });

  it('GET /api/personas lista paginada', async () => {
    const res = await request(app).get('/api/personas?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('GET /api/personas/:id devuelve detalle', async () => {
    const res = await request(app).get(`/api/personas/${nuevoId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_persona', nuevoId);
  });

  it('PUT /api/personas/:id actualiza', async () => {
    const res = await request(app)
      .put(`/api/personas/${nuevoId}`)
      .send({ id_naturaleza: testNombreId })
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Persona actualizada exitosamente.');
  });

  it('DELETE /api/personas/:id inactiva', async () => {
    const res = await request(app).delete(`/api/personas/${nuevoId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Persona inactivada correctamente.');
  });
});
