// tests/trnCategoriaPersona.test.ts
import request from 'supertest';
import { app } from '../src/index';
import ConnectionManager from '../src/connection/ConnectionManager';
import PostgreSQLStrategy from '../src/connection/PostgreSQLStrategy';
import { Pool } from 'pg';

let pool: Pool;
let testEstadoActivoId: string;
let testEstadoInactivoId: string;
let testPersonaId: string;
let testCategoriaId: string;
let nuevoPersonaCatInicio: string; // fecha en ISO (YYYY-MM-DD)

beforeAll(async () => {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  pool = (await ConnectionManager.getConnection('postgres')) as Pool;

  // 1) Crear un estado “ACT” de prueba
  const actRes = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
    VALUES ('ACT', 'Activo', 'jest', TRUE)
    RETURNING id_estado;
  `);
  testEstadoActivoId = actRes.rows[0].id_estado;

  // 2) Crear un estado “INA” de prueba
  const inaRes = await pool.query<{ id_estado: string }>(`
    INSERT INTO estado (codigo_estado, nombre, usuario_creacion, es_activo)
    VALUES ('INA', 'Inactivo', 'jest', FALSE)
    RETURNING id_estado;
  `);
  testEstadoInactivoId = inaRes.rows[0].id_estado;
  process.env.INACTIVE_STATE_ID = testEstadoInactivoId;

  // 3) Crear una persona mínima de prueba (solo estado)
  const personaRes = await pool.query<{ id_persona: string }>(`
    INSERT INTO persona (estado)
    VALUES ($1)
    RETURNING id_persona;
  `, [testEstadoActivoId]);
  testPersonaId = personaRes.rows[0].id_persona;

  // 4) Crear una categoría_persona de prueba (necesita estado activo)
  const catRes = await pool.query<{ id_categoria_persona: string }>(`
    INSERT INTO categoria_persona (nombre, descripcion, estado)
    VALUES ('Empleado', 'Personas contratadas formalmente', $1)
    RETURNING id_categoria_persona;
  `, [testEstadoActivoId]);
  testCategoriaId = catRes.rows[0].id_categoria_persona;
});

afterAll(async () => {
  await ConnectionManager.closeAllConnections();
});

describe('CRUD /api/trn-categoria-persona', () => {
  it('POST /api/trn-categoria-persona crea un historial', async () => {
    const hoy = new Date();
    nuevoPersonaCatInicio = hoy.toISOString().slice(0, 10);

    const res = await request(app)
      .post('/api/trn-categoria-persona')
      .send({
        id_persona: testPersonaId,
        id_categoria_persona: testCategoriaId,
        fecha_inicio_vigencia: nuevoPersonaCatInicio,
        fecha_fin_vigencia: null,
        nemonico: 'CLIENTE2024',
        estado: testEstadoActivoId
      })
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('mensaje', 'Historial de categoría registrado correctamente');
    expect(res.body).toHaveProperty('id_persona', testPersonaId);
    expect(res.body).toHaveProperty('id_categoria_persona', testCategoriaId);
  });

  it('GET /api/trn-categoria-persona lista en modo tabla', async () => {
    const res = await request(app)
      .get(`/api/trn-categoria-persona?modo=tabla&id_persona=${testPersonaId}&page=1&limit=5`)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');

    // Verificar que aparece nuestro registro con fecha_inicio_vigencia
    const encontrado = (res.body.data as any[]).find(
      (item) => item.fecha_inicio_vigencia === nuevoPersonaCatInicio
    );
    expect(encontrado).toBeDefined();
    expect(encontrado.id_persona).toBe(testPersonaId);
  });

  it('GET /api/trn-categoria-persona lista en modo vista', async () => {
    const res = await request(app)
      .get(`/api/trn-categoria-persona?modo=vista&id_persona=${testPersonaId}&page=1&limit=5`)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');

    // En modo vista, debemos recibir { id_persona, id_categoria_persona, nombre_categoria, descripcion_categoria }
    const recs = res.body.data as any[];
    if (recs.length > 0) {
      expect(recs[0]).toHaveProperty('id_persona');
      expect(recs[0]).toHaveProperty('id_categoria_persona');
      expect(recs[0]).toHaveProperty('nombre_categoria');
      expect(recs[0]).toHaveProperty('descripcion_categoria');
    }
  });

  it('PUT /api/trn-categoria-persona actualiza registro', async () => {
    const nuevaFechaFin = new Date();
    nuevaFechaFin.setDate(nuevaFechaFin.getDate() + 30);
    const nuevaFin = nuevaFechaFin.toISOString().slice(0, 10);

    const res = await request(app)
      .put('/api/trn-categoria-persona')
      .send({
        id_persona: testPersonaId,
        id_categoria_persona: testCategoriaId,
        fecha_inicio_vigencia: nuevoPersonaCatInicio,
        fecha_fin_vigencia: nuevaFin,
        nemonico: 'CLIENTE2024_ACTUALIZADO',
        estado: testEstadoInactivoId
      })
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Historial de categoría actualizado correctamente');
  });

  it('DELETE /api/trn-categoria-persona inactiva registro', async () => {
    const res = await request(app)
      .delete(
        `/api/trn-categoria-persona?id_persona=${testPersonaId}` +
        `&id_categoria_persona=${testCategoriaId}` +
        `&fecha_inicio_vigencia=${nuevoPersonaCatInicio}`
      )
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Historial de categoría inactivado correctamente');
  });
});
