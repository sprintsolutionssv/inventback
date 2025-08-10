import { Router, Request, Response } from 'express';
import { route } from '../utils/route';
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
 *   name: Estantes
 *   description: Gestión global de estantes
 *
 * components:
 *   schemas:
 *     EstanteDTO:
 *       type: object
 *       required: [id_almacen, codigo]
 *       properties:
 *         id_almacen: { type: string, format: uuid }
 *         codigo: { type: string }
 *         ubicacion: { type: string }
 *
 *     EstanteDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/EstanteDTO'
 *         - type: object
 *           properties:
 *             id_estante: { type: string, format: uuid }
 *             estado: { type: string }
 *             fecha_creacion: { type: string, format: date }
 *             usuario_creacion: { type: string }
 *
 *     PaginatedEstantes:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/EstanteDetail' }
 *         pagination:
 *           type: object
 *           properties:
 *             page: { type: integer }
 *             size: { type: integer }
 *             total_pages: { type: integer }
 *             total_items: { type: integer }
 */

/**
 * @swagger
 * /api/estantes:
 *   post:
 *     summary: Crear estante
 *     tags: [Estantes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EstanteDTO' }
 *     responses:
 *       201: { description: Creado }
 *       400: { description: Bad Request }
 *       404: { description: Almacén no existe }
 *       409: { description: Código duplicado en almacén }
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const b = req.body as EstanteDTO;
    if (!isUUID(b.id_almacen)) return res.status(400).json({ error: 'id_almacen inválido' });
    if (!requiredStr(b.codigo)) return res.status(400).json({ error: 'codigo es requerido' });

    try {
      const result = await EstanteModel.create(b);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/estantes:
 *   get:
 *     summary: Listar estantes
 *     tags: [Estantes]
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
 *         name: ubicacion
 *         schema: { type: string }
 *       - in: query
 *         name: id_almacen
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lista paginada }
 *       400: { description: Parámetros inválidos }
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const pag = parsePageParams(q);
    if ('error' in pag) return res.status(400).json({ error: pag.error });

    if (q.id_almacen && !isUUID(q.id_almacen)) {
      return res.status(400).json({ error: 'id_almacen inválido' });
    }

    const filters: EstanteFilter = {
      page: pag.page,
      size: pag.size,
      sort: q.sort,
      codigo: q.codigo,
      ubicacion: q.ubicacion,
      id_almacen: q.id_almacen
    };
    try {
      const result = await EstanteModel.findAll(filters);
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  })
);

/**
 * @swagger
 * /api/estantes/{id_estante}:
 *   get:
 *     summary: Obtener estante por ID
 *     tags: [Estantes]
 *     parameters:
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
  '/:id_estante',
  route(async (req: Request, res: Response) => {
    const { id_estante } = req.params;
    if (!isUUID(id_estante)) return res.status(400).json({ error: 'UUID inválido' });
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
 * /api/estantes/{id_estante}:
 *   put:
 *     summary: Actualizar estante
 *     tags: [Estantes]
 *     parameters:
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
  '/:id_estante',
  route(async (req: Request, res: Response) => {
    const { id_estante } = req.params;
    const b = req.body as EstanteDTO;
    if (!isUUID(id_estante)) return res.status(400).json({ error: 'UUID inválido' });
    if (!isUUID(b.id_almacen)) return res.status(400).json({ error: 'id_almacen inválido' });
    if (!requiredStr(b.codigo)) return res.status(400).json({ error: 'codigo es requerido' });

    try {
      const result = await EstanteModel.update(id_estante, b);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/estantes/{id_estante}:
 *   delete:
 *     summary: Eliminar estante
 *     tags: [Estantes]
 *     parameters:
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
  '/:id_estante',
  route(async (req: Request, res: Response) => {
    const { id_estante } = req.params;
    if (!isUUID(id_estante)) return res.status(400).json({ error: 'UUID inválido' });
    try {
      await EstanteModel.delete(id_estante);
      res.status(204).end();
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

export default router;
