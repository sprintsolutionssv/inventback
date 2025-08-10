import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testEstadoId: string;
let almacId: string;
let estId: string;

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // Asegurar estado ACT
  const found = await pool.query<{ id_estado: string }>(
    `SELECT id_estado FROM estado WHERE codigo_estado='ACT' AND es_activo=TRUE LIMIT 1;`
  );
  if (found.rowCount) {
    testEstadoId = found.rows[0].id_estado;
  } else {
    const ins = await pool.query<{ id_estado: string }>(`
      INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
      VALUES ('ACT','Activo','jest',TRUE)
      RETURNING id_estado;
    `);
    testEstadoId = ins.rows[0].id_estado;
  }

  // Crear almacén base para tests globales de estantes
  const a = await pool.query<{ id_almacen: string }>(
    `INSERT INTO almacen (codigo,nombre,tipo,estado,usuario_creacion)
     VALUES ('ALM-G-1','AlmGlobal','PRINCIPAL',$1,'jest')
     RETURNING id_almacen;`,
    [testEstadoId]
  );
  almacId = a.rows[0].id_almacen;
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('POST /api/estantes', () => {
  it('201 Crea estante válido (global)', async () => {
    const res = await request(app)
      .post('/api/estantes')
      .send({ id_almacen: almacId, codigo: 'E-G-1', ubicacion: 'Z1' });
    expect(res.status).toBe(201);
    estId = res.body.id_estante;
  });

  it('409 Duplicado dentro del mismo almacén', async () => {
    const res = await request(app)
      .post('/api/estantes')
      .send({ id_almacen: almacId, codigo: 'E-G-1', ubicacion: 'Z2' });
    expect(res.status).toBe(409);
  });

  it('404 Almacén inexistente', async () => {
    const res = await request(app)
      .post('/api/estantes')
      .send({ id_almacen: '00000000-0000-0000-0000-000000000000', codigo: 'E-X', ubicacion: 'X' });
    expect(res.status).toBe(404);
  });

  it('400 Validación simple', async () => {
    const res = await request(app)
      .post('/api/estantes')
      .send({ id_almacen: almacId, codigo: '' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/estantes', () => {
  it('200 Lista estantes (global)', async () => {
    const res = await request(app).get('/api/estantes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('400 Parámetro inválido', async () => {
    const res = await request(app).get('/api/estantes').query({ page: 0 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/estantes/:id_estante', () => {
  it('200 Por ID válido', async () => {
    const res = await request(app).get(`/api/estantes/${estId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_estante', estId);
  });

  it('400 UUID inválido', async () => {
    const res = await request(app).get('/api/estantes/123');
    expect(res.status).toBe(400);
  });

  it('404 No existe', async () => {
    const res = await request(app).get('/api/estantes/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/estantes/:id_estante', () => {
  it('200 Actualiza correctamente', async () => {
    const res = await request(app)
      .put(`/api/estantes/${estId}`)
      .send({ id_almacen: almacId, codigo: 'E-G-1-EDIT', ubicacion: 'Z9' });
    expect(res.status).toBe(200);
  });

  it('409 Duplicado al actualizar', async () => {
    // Crear otro estante en el mismo almacén
    const another = await request(app)
      .post('/api/estantes')
      .send({ id_almacen: almacId, codigo: 'E-G-DUP', ubicacion: 'Z3' });
    expect(another.status).toBe(201);

    // Intentar chocar contra E-G-1-EDIT
    const res = await request(app)
      .put(`/api/estantes/${another.body.id_estante}`)
      .send({ id_almacen: almacId, codigo: 'E-G-1-EDIT', ubicacion: 'Z4' });
    expect(res.status).toBe(409);
  });

  it('404 No existe', async () => {
    const res = await request(app)
      .put('/api/estantes/00000000-0000-0000-0000-000000000000')
      .send({ id_almacen: almacId, codigo: 'E-X', ubicacion: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/estantes/:id_estante', () => {
  it('204 Elimina correctamente', async () => {
    const res = await request(app).delete(`/api/estantes/${estId}`);
    expect(res.status).toBe(204);
  });

  it('404 Ya borrado', async () => {
    const res = await request(app).delete(`/api/estantes/${estId}`);
    expect(res.status).toBe(404);
  });
});
