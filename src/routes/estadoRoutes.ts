// src/routes/estadoRoutes.ts
import { Router, Request, Response } from 'express';
import { EstadoModel, EstadoDTO, EstadoFilter } from '../models/EstadoModel';
import { route } from '../utils/route';

const router = Router();


/**
 * @swagger
 * /estados:
 *   get:
 *     summary: Listar estados con filtros y paginación
 *     tags: [Estados]
 *     parameters:
 *       - in: query
 *         name: tipo_estado
 *         schema:
 *           type: string
 *       - in: query
 *         name: entidad_aplicable
 *         schema:
 *           type: string
 *       - in: query
 *         name: es_activo
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista paginada de estados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EstadoListItem'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     pages: { type: integer }
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const filters: EstadoFilter = {
      tipo_estado: req.query.tipo_estado as string,
      entidad_aplicable: req.query.entidad_aplicable as string,
      es_activo: req.query.es_activo !== undefined ? req.query.es_activo === 'true' : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    const result = await EstadoModel.findAll(filters);
    res.json(result);
  })
);

/**
 * @swagger
 * /estados/{id}:
 *   get:
 *     summary: Obtener detalle de un estado
 *     tags: [Estados]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalle de estado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EstadoDetail'
 *       404:
 *         description: Estado no encontrado
 */
router.get(
  '/:id',
  route(async (req: Request, res: Response) => {
    const estado = await EstadoModel.findById(req.params.id);
    if (!estado) return res.status(404).json({ error: 'Estado no encontrado' });
    res.json(estado);
  })
);



/**
 * @swagger
 * /estados:
 *    post:
 *     summary: Crea un nuevo estado genérico
 *     tags: [Estados]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EstadoInput'
 *     responses:
 *       201:
 *         description: Estado creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EstadoResponse'
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as EstadoDTO;
    const id_estado = await EstadoModel.create(dto);
    res.status(201).json({ id_estado, mensaje: 'Estado creado correctamente' });
  })
);
/**
 * @swagger
 * /estados/{id}:
 *   put:
 *     summary: Actualizar un estado existente
 *     tags: [Estados]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               descripcion: { type: string }
 *               es_activo: { type: boolean }
 *     responses:
 *       200:
 *         description: Estado actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_estado: { type: string }
 *                 mensaje: { type: string }
 */
router.put(
  '/:id',
  route(async (req: Request, res: Response) => {
    await EstadoModel.update(req.params.id, req.body);
    res.json({ id_estado: req.params.id, mensaje: 'Estado actualizado correctamente' });
  })
);

/**
 * @swagger
 * /estados/{id}:
 *   delete:
 *     summary: Inactivar un estado (lógica DELETE)
 *     tags: [Estados]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Estado inactivado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_estado: { type: string }
 *                 mensaje: { type: string }
 */
router.delete(
  '/:id',
  route(async (req: Request, res: Response) => {
    await EstadoModel.deactivate(req.params.id);
    res.json({ id_estado: req.params.id, mensaje: 'Estado inactivado correctamente' });
  })
);

export default router;