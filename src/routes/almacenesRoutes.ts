import { Router, Request, Response } from 'express';
import { route } from '../utils/route';
import AlmacenModel, { AlmacenDTO, AlmacenFilter } from '../models/AlmacenModel';
import EstanteModel, { EstanteDTO, EstanteFilter } from '../models/EstanteModel';

const router = Router();

const isUUID = (v?: string) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const requiredStr = (v: any) => typeof v === 'string' && v.trim().length > 0;

const parsePageParams = (q: Record<string, string>) => {
  const page = q.page ? Number(q.page) : 1;
  const size = q.size ? Number(q.size) : 20;
  if (!Number.isFinite(page) || !Number.isFinite(size) || page < 1 || size < 1) {
    return { error: 'Parámetros de paginación inválidos (page>=1, size>=1).' };
  }
  return { page, size };
};

/**
 * @swagger
 * tags:
 *   name: Almacenes
 *   description: Gestión de almacenes y estantes (anidados)
 *
 * components:
 *   schemas:
 *     AlmacenDTO:
 *       type: object
 *       required: [codigo, nombre, tipo]
 *       properties:
 *         codigo: { type: string }
 *         nombre: { type: string }
 *         tipo:   { type: string }
 *         direccion: { type: string }
 *
 *     AlmacenDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/AlmacenDTO'
 *         - type: object
 *           properties:
 *             id_almacen: { type: string, format: uuid }
 *             estado: { type: string }
 *             fecha_creacion: { type: string, format: date }
 *             usuario_creacion: { type: string }
 *             total_estantes: { type: integer }
 *
 *     PaginatedAlmacenes:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/AlmacenDetail' }
 *         pagination:
 *           type: object
 *           properties:
 *             page: { type: integer }
 *             size: { type: integer }
 *             total_pages: { type: integer }
 *             total_items: { type: integer }
 *
 *     EstanteDTO:
 *       type: object
 *       required: [codigo]
 *       properties:
 *         codigo: { type: string }
 *         ubicacion: { type: string }
 *
 *     EstanteDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/EstanteDTO'
 *         - type: object
 *           properties:
 *             id_estante: { type: string, format: uuid }
 *             id_almacen: { type: string, format: uuid }
 *             estado: { type: string }
 *             fecha_creacion: { type: string, format: date }
 *             usuario_creacion: { type: string }
 */

/**
 * @swagger
 * /api/almacenes:
 *   post:
 *     summary: Crear almacén
 *     tags: [Almacenes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AlmacenDTO' }
 *     responses:
 *       201: { description: Creado }
 *       400: { description: Bad Request }
 *       409: { description: Código duplicado }
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const b = req.body as AlmacenDTO;
    if (!requiredStr(b.codigo) || !requiredStr(b.nombre) || !requiredStr(b.tipo)) {
      return res.status(400).json({ error: 'Campos requeridos: codigo, nombre, tipo.' });
    }
    try {
      const result = await AlmacenModel.create(b);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/almacenes:
 *   get:
 *     summary: Listar almacenes
 *     tags: [Almacenes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *       - in: query
 *         name: codigo
 *         schema: { type: string }
 *       - in: query
 *         name: nombre
 *         schema: { type: string }
 *       - in: query
 *         name: tipo
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista paginada, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedAlmacenes' } } } }
 *       400: { description: Parámetros inválidos }
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const pag = parsePageParams(q);
    if ('error' in pag) return res.status(400).json({ error: pag.error });

    const filters: AlmacenFilter = {
      page: pag.page,
      size: pag.size,
      sort: q.sort,
      codigo: q.codigo,
      nombre: q.nombre,
      tipo: q.tipo
    };
    try {
      const result = await AlmacenModel.findAll(filters);
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  })
);

/**
 * @swagger
 * /api/almacenes/{id_almacen}:
 *   get:
 *     summary: Obtener almacén por ID
 *     tags: [Almacenes]
 *     parameters:
 *       - in: path
 *         name: id_almacen
 *         schema: { type: string, format: uuid }
 *         required: true
 *     responses:
 *       200: { description: Detalle }
 *       400: { description: UUID inválido }
 *       404: { description: No encontrado }
 */
router.get(
  '/:id_almacen',
  route(async (req: Request, res: Response) => {
    const { id_almacen } = req.params;
    if (!isUUID(id_almacen)) return res.status(400).json({ error: 'UUID inválido' });
    try {
      const a = await AlmacenModel.findById(id_almacen);
      res.json(a);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/almacenes/{id_almacen}:
 *   put:
 *     summary: Actualizar almacén
 *     tags: [Almacenes]
 *     parameters:
 *       - in: path
 *         name: id_almacen
 *         schema: { type: string, format: uuid }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AlmacenDTO' }
 *     responses:
 *       200: { description: Actualizado }
 *       400: { description: Bad Request / UUID inválido }
 *       404: { description: No encontrado }
 *       409: { description: Código duplicado }
 */
router.put(
  '/:id_almacen',
  route(async (req: Request, res: Response) => {
    const { id_almacen } = req.params;
    if (!isUUID(id_almacen)) return res.status(400).json({ error: 'UUID inválido' });
    const b = req.body as AlmacenDTO;
    if (!requiredStr(b.codigo) || !requiredStr(b.nombre) || !requiredStr(b.tipo)) {
      return res.status(400).json({ error: 'Campos requeridos: codigo, nombre, tipo.' });
    }
    try {
      const result = await AlmacenModel.update(id_almacen, b);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/almacenes/{id_almacen}:
 *   delete:
 *     summary: Eliminar almacén
 *     tags: [Almacenes]
 *     parameters:
 *       - in: path
 *         name: id_almacen
 *         schema: { type: string, format: uuid }
 *         required: true
 *     responses:
 *       204: { description: Eliminado }
 *       400: { description: UUID inválido }
 *       404: { description: No encontrado }
 */
router.delete(
  '/:id_almacen',
  route(async (req: Request, res: Response) => {
    const { id_almacen } = req.params;
    if (!isUUID(id_almacen)) return res.status(400).json({ error: 'UUID inválido' });
    try {
      await AlmacenModel.delete(id_almacen);
      res.status(204).end();
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/** ----------- ESTANTES anidados por almacén ----------- */

/**
 * @swagger
 * /api/almacenes/{id_almacen}/estantes:
 *   get:
 *     summary: Listar estantes por almacén
 *     tags: [Almacenes]
 *     parameters:
 *       - in: path
 *         name: id_almacen
 *         schema: { type: string, format: uuid }
 *         required: true
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *       - in: query
 *         name: codigo
 *         schema: { type: string }
 *       - in: query
 *         name: ubicacion
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista paginada }
 *       400: { description: Parámetros inválidos / UUID inválido }
 */
router.get(
  '/:id_almacen/estantes',
  route(async (req: Request, res: Response) => {
    const { id_almacen } = req.params;
    if (!isUUID(id_almacen)) return res.status(400).json({ error: 'UUID inválido' });

    const q = req.query as Record<string, string>;
    const pag = parsePageParams(q);
    if ('error' in pag) return res.status(400).json({ error: pag.error });

    const filters: EstanteFilter = {
      page: pag.page,
      size: pag.size,
      sort: q.sort,
      codigo: q.codigo,
      ubicacion: q.ubicacion
    };
    try {
      const result = await EstanteModel.findAllByAlmacen(id_almacen, filters);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/almacenes/{id_almacen}/estantes:
 *   post:
 *     summary: Crear estante en almacén
 *     tags: [Almacenes]
 *     parameters:
 *       - in: path
 *         name: id_almacen
 *         schema: { type: string, format: uuid }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EstanteDTO' }
 *     responses:
 *       201: { description: Creado }
 *       400: { description: Bad Request / UUID inválido }
 *       404: { description: Almacén no existe }
 *       409: { description: Código duplicado en almacén }
 */
router.post(
  '/:id_almacen/estantes',
  route(async (req: Request, res: Response) => {
    const { id_almacen } = req.params;
    if (!isUUID(id_almacen)) return res.status(400).json({ error: 'UUID inválido' });
    const b = req.body as EstanteDTO;
    if (!requiredStr(b.codigo)) return res.status(400).json({ error: 'codigo es requerido.' });

    try {
      const dto: EstanteDTO = { id_almacen, codigo: b.codigo, ubicacion: b.ubicacion };
      const result = await EstanteModel.create(dto);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/almacenes/{id_almacen}/estantes/{id_estante}:
 *   get:
 *     summary: Obtener estante por ID (anidado)
 *     tags: [Almacenes]
 *     parameters:
 *       - in: path
 *         name: id_almacen
 *         schema: { type: string, format: uuid }
 *         required: true
 *       - in: path
 *         name: id_estante
 *         schema: { type: string, format: uuid }
 *         required: true
 *     responses:
 *       200: { description: Detalle }
 *       400: { description: UUID inválido }
 *       404: { description: No encontrado }
 */
router.get(
  '/:id_almacen/estantes/:id_estante',
  route(async (req: Request, res: Response) => {
    const { id_almacen, id_estante } = req.params;
    if (!isUUID(id_almacen) || !isUUID(id_estante)) {
      return res.status(400).json({ error: 'UUID inválido' });
    }
    try {
      const e = await EstanteModel.findById(id_estante);
      res.json(e);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/almacenes/{id_almacen}/estantes/{id_estante}:
 *   put:
 *     summary: Actualizar estante (anidado)
 *     tags: [Almacenes]
 *     parameters:
 *       - in: path
 *         name: id_almacen
 *         schema: { type: string, format: uuid }
 *         required: true
 *       - in: path
 *         name: id_estante
 *         schema: { type: string, format: uuid }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EstanteDTO' }
 *     responses:
 *       200: { description: Actualizado }
 *       400: { description: Bad Request / UUID inválido }
 *       404: { description: No encontrado }
 *       409: { description: Código duplicado en almacén }
 */
router.put(
  '/:id_almacen/estantes/:id_estante',
  route(async (req: Request, res: Response) => {
    const { id_almacen, id_estante } = req.params;
    if (!isUUID(id_almacen) || !isUUID(id_estante)) {
      return res.status(400).json({ error: 'UUID inválido' });
    }
    const b = req.body as EstanteDTO;
    if (!requiredStr(b.codigo)) return res.status(400).json({ error: 'codigo es requerido.' });

    try {
      const dto: EstanteDTO = { id_almacen, codigo: b.codigo, ubicacion: b.ubicacion };
      const result = await EstanteModel.update(id_estante, dto);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/almacenes/{id_almacen}/estantes/{id_estante}:
 *   delete:
 *     summary: Eliminar estante (anidado)
 *     tags: [Almacenes]
 *     parameters:
 *       - in: path
 *         name: id_almacen
 *         schema: { type: string, format: uuid }
 *         required: true
 *       - in: path
 *         name: id_estante
 *         schema: { type: string, format: uuid }
 *         required: true
 *     responses:
 *       204: { description: Eliminado }
 *       400: { description: UUID inválido }
 *       404: { description: No encontrado }
 */
router.delete(
  '/:id_almacen/estantes/:id_estante',
  route(async (req: Request, res: Response) => {
    const { id_almacen, id_estante } = req.params;
    if (!isUUID(id_almacen) || !isUUID(id_estante)) {
      return res.status(400).json({ error: 'UUID inválido' });
    }
    try {
      await EstanteModel.delete(id_estante);
      res.status(204).end();
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

export default router;
