import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let estadoActId: string;
let estadoInaId: string;
let personaId: string;
let idCreado: string;

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // limpiar
  await pool.query('TRUNCATE trn_documento_persona CASCADE;');
  await pool.query('TRUNCATE tipo_documento_persona CASCADE;');
  await pool.query('TRUNCATE persona CASCADE;');
  await pool.query('TRUNCATE estado CASCADE;');

  // crear estados
  const st1 = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado,nombre,usuario_creacion,es_activo)
    VALUES ('ACT','Activo','jest',TRUE) RETURNING id_estado;
  `);
  estadoActId = st1.rows[0].id_estado;

  const st2 = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado,nombre,usuario_creacion,es_activo)
    VALUES ('INA','Inactivo','jest',FALSE) RETURNING id_estado;
  `);
  estadoInaId = st2.rows[0].id_estado;
  process.env.INACTIVE_STATE_ID = estadoInaId;

  // crear persona
  const pr = await pool.query<{ id_persona: string }>(`
    INSERT INTO persona (estado) VALUES ($1) RETURNING id_persona;
  `, [estadoActId]);
  personaId = pr.rows[0].id_persona;

  // crear tipos de documento
  await pool.query(`
    INSERT INTO tipo_documento_persona (nombre, estado)
    VALUES ('DUI', $1), ('Pasaporte', $1);
  `, [estadoActId]);
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('CRUD /api/documento-persona', () => {
  it('POST vincula documento a persona', async () => {
    const res = await request(app)
      .post('/api/documento-persona')
      .send({
        id_persona: personaId,
        tipo_documento: 'DUI',
        numero_documento: '01234567-8',
        entidad_emisora: 'RNPN',
        fecha_emision: '2020-01-15',
        fecha_expiracion: null,
        estado: estadoActId
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_documento_persona', personaId);
    expect(res.body).toHaveProperty('mensaje', 'Documento vinculado correctamente a la persona.');
    idCreado = res.body.id_documento_persona;
  });

  it('GET lista documentos de persona', async () => {
    const res = await request(app)
      .get(`/api/documento-persona?id_persona=${personaId}&page=1&limit=5`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 5 });
  });

  it('GET por ID devuelve detalle', async () => {
    const res = await request(app)
      .get(`/api/documento-persona/${idCreado}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tipo_documento', 'DUI');
    expect(res.body).toHaveProperty('numero_documento', '01234567-8');
  });

  it('PUT actualiza documento-persona', async () => {
    const res = await request(app)
      .put(`/api/documento-persona/${idCreado}`)
      .send({
        numero_documento: '99999999-0',
        fecha_expiracion: '2030-12-31',
        estado: estadoInaId
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Documento actualizado exitosamente.');
    expect(res.body).toHaveProperty('id_documento_persona', idCreado);
  });

  it('DELETE desasocia documento (lógica)', async () => {
    const res = await request(app)
      .delete(`/api/documento-persona/${idCreado}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Documento desasociado correctamente.');
    expect(res.body).toHaveProperty('id_documento_persona', idCreado);
  });
});
