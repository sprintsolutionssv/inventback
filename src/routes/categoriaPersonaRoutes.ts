import { Router, Request, Response } from 'express';
import { CategoriaPersonaModel, CategoriaPersonaDTO, CategoriaPersonaFilter } from '../models/CategoriaPersonaModel';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CategoriaPersonaInput:
 *       type: object
 *       required:
 *         - nombre
 *         - estado
 *       properties:
 *         nombre:
 *           type: string
 *           example: Empleado
 *         descripcion:
 *           type: string
 *           example: Personas contratadas formalmente
 *         estado:
 *           type: string
 *           format: uuid
 *
 *     CategoriaPersonaResponse:
 *       type: object
 *       properties:
 *         id_categoria_persona:
 *           type: string
 *           format: uuid
 *           example: a1b2c3d4...
 *         mensaje:
 *           type: string
 *           example: Categoría creada correctamente
 */

/**
 * @swagger
 * tags:
 *   name: CategoriasPersona
 *   description: Operaciones sobre categorías de persona
 */

/**
 * @swagger
 * /categorias-persona:
 *   get:
 *     summary: Listar categorías con filtros y paginación
 *     tags: [CategoriasPersona]
 *     parameters:
 *       - in: query
 *         name: nombre
 *         schema:
 *           type: string
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: Lista paginada de categorías
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_categoria_persona:
 *                         type: string
 *                       nombre:
 *                         type: string
 *                       descripcion:
 *                         type: string
 *                       estado:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           nombre:
 *                             type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const filters: CategoriaPersonaFilter = {
      nombre: req.query.nombre as string,
      estado: req.query.estado as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    const result = await CategoriaPersonaModel.findAll(filters);
    res.json(result);
  })
);

/**
 * @swagger
 * /categorias-persona/{id}:
 *   get:
 *     summary: Obtener detalle de una categoría
 *     tags: [CategoriasPersona]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Datos de la categoría
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_categoria_persona:
 *                   type: string
 *                 nombre:
 *                   type: string
 *                 descripcion:
 *                   type: string
 *                 estado:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     nombre:
 *                       type: string
 *       404:
 *         description: Categoría no encontrada
 */
router.get(
  '/:id',
  route(async (req: Request, res: Response) => {
    const categoria = await CategoriaPersonaModel.findById(req.params.id);
    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json(categoria);
  })
);

/**
 * @swagger
 * /categorias-persona:
 *   post:
 *     summary: Crear una nueva categoría
 *     tags: [CategoriasPersona]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaPersonaInput'
 *     responses:
 *       201:
 *         description: Categoría creada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaPersonaResponse'
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as CategoriaPersonaDTO;
    const id_categoria_persona = await CategoriaPersonaModel.create(dto);
    res.status(201).json({ id_categoria_persona, mensaje: 'Categoría creada correctamente' });
  })
);

/**
 * @swagger
 * /categorias-persona/{id}:
 *   put:
 *     summary: Actualizar una categoría existente
 *     tags: [CategoriasPersona]
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
 *             $ref: '#/components/schemas/CategoriaPersonaInput'
 *     responses:
 *       200:
 *         description: Categoría actualizada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_categoria_persona:
 *                   type: string
 *                 mensaje:
 *                   type: string
 */
router.put(
  '/:id',
  route(async (req: Request, res: Response) => {
    const dto = req.body as Partial<CategoriaPersonaDTO>;
    await CategoriaPersonaModel.update(req.params.id, dto);
    res.json({ id_categoria_persona: req.params.id, mensaje: 'Categoría actualizada correctamente' });
  })
);

/**
 * @swagger
 * /categorias-persona/{id}:
 *   delete:
 *     summary: Inactivar una categoría (eliminación lógica)
 *     tags: [CategoriasPersona]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Categoría inactivada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_categoria_persona:
 *                   type: string
 *                 mensaje:
 *                   type: string
 */
router.delete(
  '/:id',
  route(async (req: Request, res: Response) => {
    const INACTIVE_STATE_ID = process.env.INACTIVE_STATE_ID;
    if (!INACTIVE_STATE_ID) {
      throw new Error('INACTIVE_STATE_ID no está definido en el entorno');
    }
    await CategoriaPersonaModel.deactivate(req.params.id, INACTIVE_STATE_ID);
    res.json({ id_categoria_persona: req.params.id, mensaje: 'Categoría inactivada correctamente' });
  })
);

export default router;
