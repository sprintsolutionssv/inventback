// tests/documento.test.ts
import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testEstadoActivoId: string;
let testEstadoInactivoId: string;
let testPersonaId: string;
let tipoDuiId: string;
let tipoPasaporteId: string;
let idDocumentCreated: string;

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // 1) Limpiar tablas
  await pool.query('TRUNCATE trn_documento_persona CASCADE;');
  await pool.query('TRUNCATE tipo_documento_persona CASCADE;');
  await pool.query('TRUNCATE persona CASCADE;');
  await pool.query('TRUNCATE estado CASCADE;');

  // 2) Crear un estado “ACT”
  const st = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
    VALUES ('ACT','Activo','jest',TRUE)
    RETURNING id_estado;
  `);
  testEstadoActivoId = st.rows[0].id_estado;

   // 2b) Crear un estado “INA” y exponerlo en la variable de entorno
  const ina = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
    VALUES ('INA','Inactivo','jest',FALSE)
    RETURNING id_estado;
  `);
  testEstadoInactivoId = ina.rows[0].id_estado;
  process.env.INACTIVE_STATE_ID = testEstadoInactivoId;

  // 3) Crear una persona mínima
  const prs = await pool.query<{ id_persona: string }>(`
    INSERT INTO persona (estado)
    VALUES ($1)
    RETURNING id_persona;
  `, [testEstadoActivoId]);
  testPersonaId = prs.rows[0].id_persona;

  // 4) Crear tipos de documento
  const tp = await pool.query<{ id_tipo_documento_persona: string; nombre: string }>(`
    INSERT INTO tipo_documento_persona (nombre, estado)
    VALUES ('DUI',$1),('Pasaporte',$1)
    RETURNING id_tipo_documento_persona, nombre;
  `, [testEstadoActivoId]);
  tipoDuiId = tp.rows.find(r => r.nombre === 'DUI')!.id_tipo_documento_persona;
  tipoPasaporteId = tp.rows.find(r => r.nombre === 'Pasaporte')!.id_tipo_documento_persona;
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('CRUD /api/documentos', () => {
  it('POST crea un documento', async () => {
    const res = await request(app)
      .post('/api/documentos')
      .send({
        id_persona: testPersonaId,
        tipo_documento: 'DUI',
        numero_documento: '01234567-8',
        entidad_emisora: 'RNPN',
        fecha_emision: '2021-04-15',
        estado: testEstadoActivoId
      })
      .set('Accept','application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_documento');
    expect(res.body).toHaveProperty('mensaje','Documento registrado exitosamente');
    idDocumentCreated = res.body.id_documento;
  });

  it('GET lista paginada', async () => {
    const res = await request(app).get('/api/documentos?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 5 });
  });

  it('GET por ID devuelve detalle', async () => {
    const res = await request(app).get(`/api/documentos/${idDocumentCreated}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tipo_documento','DUI');
  });

  it('PUT actualiza documento', async () => {
    const res = await request(app)
      .put(`/api/documentos/${idDocumentCreated}`)
      .send({
        tipo_documento: 'Pasaporte',
        numero_documento: 'P12345678',
        entidad_emisora: 'Ministerio de Relaciones Exteriores',
        fecha_emision: '2022-01-01',
        estado: testEstadoActivoId
      })
      .set('Accept','application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje','Documento actualizado correctamente');
  });

 it('DELETE /api/documentos/:id inactiva documento', async () => {
  const res = await request(app)
    .delete(`/api/documentos/${idDocumentCreated}`)
    .set('Accept', 'application/json');

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('mensaje', 'Documento inactivado correctamente');
  expect(res.body).toHaveProperty('id_documento', idDocumentCreated);
});

});
