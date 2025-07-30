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

  // 1) Estado ACTIVO
  const st = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
    VALUES ('ACT','Activo','jest',TRUE)
    RETURNING id_estado;
  `);
  testEstadoId = st.rows[0].id_estado;

  // 2) Categoría Proveedor
  await pool.query(
    `INSERT INTO categoria_persona (nombre, descripcion, estado)
     VALUES ('Proveedor','Proveedores activos',$1)
     ON CONFLICT (nombre) DO NOTHING;`,
    [testEstadoId]
  );

  // 3) Tipos de documento y contacto
  await pool.query(
    `INSERT INTO tipo_documento_persona (nombre, estado)
     VALUES ('NIT',$1),('DUI',$1)
     ON CONFLICT (nombre) DO NOTHING;`,
    [testEstadoId]
  );
  await pool.query(
    `INSERT INTO tipo_contacto_persona (nombre, estado)
     VALUES ('Email',$1),('Teléfono',$1)
     ON CONFLICT (nombre) DO NOTHING;`,
    [testEstadoId]
  );
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('POST /api/proveedores', () => {
  const payload = {
    nombre: {
      primer_nombre: 'Carlos',
      segundo_nombre: 'Andrés',
      primer_apellido: 'Ramírez',
      segundo_apellido: 'Martínez'
    },
    documentos: [
      {
        tipo_documento: 'NIT',
        numero_documento: '0614-290898-101-3',
        entidad_emisora: 'Ministerio de Hacienda',
        fecha_emision: '2015-01-01'
      },
      {
        tipo_documento: 'DUI',
        numero_documento: '01234567-8',
        entidad_emisora: 'RNPN',
        fecha_emision: '2010-05-12'
      }
    ],
    contacto: {
      correo: 'proveedor@example.com',
      telefono: '7845-0021'
    }
  };

  it('Crea una nueva persona y la vincula como proveedor', async () => {
    const res = await request(app)
      .post('/api/proveedores')
      .send(payload)
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_persona');
    expect(res.body).toHaveProperty(
      'mensaje',
      'Persona creada y vinculada como proveedor correctamente.'
    );
  });

  it('Para un segundo POST no duplica y devuelve mapeo existente', async () => {
    const res = await request(app)
      .post('/api/proveedores')
      .send(payload)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_persona');
    expect(res.body).toHaveProperty(
      'mensaje',
      'Persona ya existente, mapeo como proveedor realizado.'
    );
  });
});
