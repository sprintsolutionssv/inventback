// src/routes/categoriaRoutes.ts
import { Router, Request, Response } from 'express';
import { CategoriaModel, CategoriaDTO, CategoriaFilter } from '../models/CategoriaModel';
import ConnectionManager from '../connection/ConnectionManager';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Categoria
 *   description: Gestión de categorías de persona
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CategoriaInput:
 *       type: object
 *       required:
 *         - nombre
 *         - estado
 *       properties:
 *         nombre:
 *           type: string
 *           example: Asociado
 *         descripcion:
 *           type: string
 *           example: Persona con rol de asociado
 *         estado:
 *           type: string
 *           format: uuid
 *     CategoriaResponse:
 *       type: object
 *       properties:
 *         id_categoria_persona:
 *           type: string
 *           format: uuid
 *         mensaje:
 *           type: string
 *           example: Categoría creada correctamente
 */

/**
 * @swagger
 * /api/categoria:
 *   post:
 *     summary: Crear nueva categoría
 *     tags: [Categoria]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaInput'
 *     responses:
 *       201:
 *         description: Categoría creada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaResponse'
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as CategoriaDTO;
    const id_categoria_persona = await CategoriaModel.create(dto);
    res.status(201).json({ id_categoria_persona, mensaje: 'Categoría creada correctamente' });
  })
);

/**
 * @swagger
 * /api/categoria:
 *   get:
 *     summary: Listar categorías activas con filtros y paginación
 *     tags: [Categoria]
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
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const filters: CategoriaFilter = {
      nombre: req.query.nombre as string,
      estado: req.query.estado as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    const result = await CategoriaModel.findAll(filters);
    res.json(result);
  })
);

/**
 * @swagger
 * /api/categoria/{id}:
 *   get:
 *     summary: Obtener detalle de una categoría
 *     tags: [Categoria]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalle de la categoría
 *       404:
 *         description: Categoría no encontrada
 */
router.get(
  '/:id',
  route(async (req: Request, res: Response) => {
    const categoria = await CategoriaModel.findById(req.params.id);
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(categoria);
  })
);

/**
 * @swagger
 * /api/categoria/{id}:
 *   put:
 *     summary: Actualizar una categoría
 *     tags: [Categoria]
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
 *             $ref: '#/components/schemas/CategoriaInput'
 *     responses:
 *       200:
 *         description: Categoría actualizada correctamente
 */
router.put(
  '/:id',
  route(async (req: Request, res: Response) => {
    await CategoriaModel.update(req.params.id, req.body as Partial<CategoriaDTO>);
    res.json({ id_categoria_persona: req.params.id, mensaje: 'Categoría actualizada correctamente' });
  })
);

/**
 * @swagger
 * /api/categoria/{id}:
 *   delete:
 *     summary: Inactivar una categoría (eliminación lógica)
 *     tags: [Categoria]
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
     await CategoriaModel.deactivateLogical(req.params.id);
     res.json({
       id_categoria_persona: req.params.id,
       mensaje: 'Categoría inactivada correctamente'
     });
   })
 );

export default router;
