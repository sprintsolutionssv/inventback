import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testEstadoId: string;

let almId: string;
let otherAlmId: string;
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
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('POST /api/almacenes', () => {
  it('201 Crea almacén válido', async () => {
    const res = await request(app)
      .post('/api/almacenes')
      .send({ codigo: 'ALM-01', nombre: 'Principal', tipo: 'PRINCIPAL', direccion: 'Calle 1' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_almacen');
    almId = res.body.id_almacen;
  });

  it('409 Código duplicado', async () => {
    const res = await request(app)
      .post('/api/almacenes')
      .send({ codigo: 'ALM-01', nombre: 'Otro', tipo: 'SECUNDARIO' });
    expect(res.status).toBe(409);
  });

  it('400 Validación fallida', async () => {
    const res = await request(app)
      .post('/api/almacenes')
      .send({ codigo: '', nombre: '', tipo: '' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/almacenes', () => {
  beforeAll(async () => {
    const r = await pool.query<{ id_almacen: string }>(
      `INSERT INTO almacen (codigo,nombre,tipo,estado,usuario_creacion)
       VALUES ('ALM-02','Otro','SECUNDARIO',$1,'jest')
       RETURNING id_almacen;`,
      [testEstadoId]
    );
    otherAlmId = r.rows[0].id_almacen;
  });

  it('200 Lista almacenes', async () => {
    const res = await request(app).get('/api/almacenes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toHaveProperty('total_items');
  });

  it('400 Parámetro inválido', async () => {
    const res = await request(app).get('/api/almacenes').query({ page: 0 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/almacenes/:id_almacen', () => {
  it('200 Por ID válido', async () => {
    const res = await request(app).get(`/api/almacenes/${almId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_almacen', almId);
  });

  it('400 UUID inválido', async () => {
    const res = await request(app).get('/api/almacenes/123');
    expect(res.status).toBe(400);
  });

  it('404 No existe', async () => {
    const res = await request(app).get('/api/almacenes/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/almacenes/:id_almacen', () => {
  it('200 Actualiza correctamente', async () => {
    const res = await request(app)
      .put(`/api/almacenes/${almId}`)
      .send({ codigo: 'ALM-01-EDIT', nombre: 'Principal Edit', tipo: 'PRINCIPAL', direccion: 'Calle 2' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('404 Al actualizar inexistente', async () => {
    const res = await request(app)
      .put('/api/almacenes/00000000-0000-0000-0000-000000000000')
      .send({ codigo: 'X', nombre: 'X', tipo: 'SECUNDARIO' });
    expect(res.status).toBe(404);
  });

  it('409 Código duplicado al actualizar', async () => {
    const r = await pool.query<{ id_almacen: string }>(
      `INSERT INTO almacen (codigo,nombre,tipo,estado,usuario_creacion)
       VALUES ('ALM-DUP','Dup','SECUNDARIO',$1,'jest')
       RETURNING id_almacen;`,
      [testEstadoId]
    );
    const dupId = r.rows[0].id_almacen;

    const res = await request(app)
      .put(`/api/almacenes/${dupId}`)
      .send({ codigo: 'ALM-01-EDIT', nombre: 'Dup', tipo: 'SECUNDARIO' });
    expect(res.status).toBe(409);
  });
});

/** --------- ESTANTES anidados --------- */

describe('ESTANTES anidados en /api/almacenes/:id_almacen/estantes', () => {
  it('201 Crea estante dentro del almacén', async () => {
    const res = await request(app)
      .post(`/api/almacenes/${almId}/estantes`)
      .send({ codigo: 'E-01', ubicacion: 'A1' });
    expect(res.status).toBe(201);
    estId = res.body.id_estante;
  });

  it('409 Código de estante duplicado en el mismo almacén', async () => {
    const res = await request(app)
      .post(`/api/almacenes/${almId}/estantes`)
      .send({ codigo: 'E-01', ubicacion: 'A2' });
    expect(res.status).toBe(409);
  });

  it('200 Lista estantes del almacén', async () => {
    const res = await request(app).get(`/api/almacenes/${almId}/estantes`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('200 Obtiene estante por ID (anidado)', async () => {
    const res = await request(app).get(`/api/almacenes/${almId}/estantes/${estId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_estante', estId);
  });

  it('200 Actualiza estante (anidado)', async () => {
    const res = await request(app)
      .put(`/api/almacenes/${almId}/estantes/${estId}`)
      .send({ codigo: 'E-01-EDIT', ubicacion: 'A3' });
    expect(res.status).toBe(200);
  });

  it('204 Elimina estante (anidado)', async () => {
    const res = await request(app).delete(`/api/almacenes/${almId}/estantes/${estId}`);
    expect(res.status).toBe(204);
  });
});

describe('DELETE /api/almacenes/:id_almacen', () => {
  it('204 Elimina correctamente', async () => {
    const res = await request(app).delete(`/api/almacenes/${otherAlmId}`);
    expect(res.status).toBe(204);
  });

  it('404 Ya borrado', async () => {
    const res = await request(app).delete(`/api/almacenes/${otherAlmId}`);
    expect(res.status).toBe(404);
  });
});
