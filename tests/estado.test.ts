import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let nuevoId: string;

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('CRUD /api/estados', () => {
  it('POST /api/estados crea un estado', async () => {
    const res = await request(app)
      .post('/api/estados')
      .send({
        codigo_estado: 'TST',
        nombre: 'Test Estado',
        usuario_creacion: 'jest'
      })
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_estado');
    nuevoId = res.body.id_estado;
  });

  it('GET /api/estados lista paginada', async () => {
    const res = await request(app).get('/api/estados?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('GET /api/estados/:id devuelve detalle', async () => {
    const res = await request(app).get(`/api/estados/${nuevoId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_estado', nuevoId);
  });

  it('PUT /api/estados/:id actualiza', async () => {
    const res = await request(app)
      .put(`/api/estados/${nuevoId}`)
      .send({ nombre: 'Test Estado (Upd)', es_activo: true })
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Estado actualizado correctamente');
  });
 
});
