import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testEstadoId: string;

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // 1) Estado Activo
  const st = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
    VALUES ('ACT','Activo','jest',TRUE)
    RETURNING id_estado;
  `);
  testEstadoId = st.rows[0].id_estado;

  // 2) Categoría 'Cliente'
  await pool.query(
    `INSERT INTO categoria_persona (nombre, descripcion, estado)
     VALUES ('Cliente','Clientes del sistema',$1)
     ON CONFLICT (nombre) DO NOTHING;`,
    [testEstadoId]
  );

  // 3) Tipos documento y contacto
  await pool.query(
    `INSERT INTO tipo_documento_persona (nombre, estado)
     VALUES ('NIT',$1),('DUI',$1)
     ON CONFLICT (nombre) DO NOTHING;`,
    [testEstadoId]
  );
  await pool.query(
    `INSERT INTO tipo_contacto_persona (nombre, estado)
     VALUES ('Teléfono',$1),('Email',$1)
     ON CONFLICT (nombre) DO NOTHING;`,
    [testEstadoId]
  );
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('POST /api/clientes', () => {
  const payload = {
    nombre: {
      primer_nombre: 'Juan',
      segundo_nombre: 'Carlos',
      primer_apellido: 'López',
      segundo_apellido: 'Gómez'
    },
    documentos: [
      {
        tipo_documento: 'NIT',
        numero_documento: '0614-555555-101-9',
        entidad_emisora: 'Ministerio de Hacienda',
        fecha_emision: '2018-06-15'
      },
      {
        tipo_documento: 'DUI',
        numero_documento: '98765432-1',
        entidad_emisora: 'RNPN',
        fecha_emision: '2012-11-20'
      }
    ],
    contacto: {
      correo: 'cliente@example.com',
      telefono: '7777-1234'
    }
  };

  it('Crea una nueva persona y la vincula como cliente', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .send(payload)
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_persona');
    expect(res.body).toHaveProperty(
      'mensaje',
      'Persona creada y vinculada como cliente correctamente.'
    );
  });

  it('Al reintentar no duplica y devuelve mapeo existente', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .send(payload)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_persona');
    expect(res.body).toHaveProperty(
      'mensaje',
      'Persona ya existente, mapeo como cliente realizado.'
    );
  });
});
