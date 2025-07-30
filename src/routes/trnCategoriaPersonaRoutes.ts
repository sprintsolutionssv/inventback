// src/routes/trnCategoriaPersonaRoutes.ts
import { Router, Request, Response } from 'express';
import { TrnCategoriaPersonaModel, TrnCategoriaPersonaDTO, TrnCategoriaPersonaFilter } from '../models/TrnCategoriaPersonaModel';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: TrnCategoriaPersona
 *   description: Historial de asignación de categorías a personas
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     TrnCategoriaPersonaInput:
 *       type: object
 *       required:
 *         - id_persona
 *         - id_categoria_persona
 *         - fecha_inicio_vigencia
 *         - nemonico
 *         - estado
 *       properties:
 *         id_persona:
 *           type: string
 *           format: uuid
 *         id_categoria_persona:
 *           type: string
 *           format: uuid
 *         fecha_inicio_vigencia:
 *           type: string
 *           format: date
 *         fecha_fin_vigencia:
 *           type: string
 *           format: date
 *           nullable: true
 *         nemonico:
 *           type: string
 *         estado:
 *           type: string
 *           format: uuid
 *
 *     TrnCategoriaPersonaTabla:
 *       type: object
 *       properties:
 *         id_persona:
 *           type: string
 *           format: uuid
 *         id_categoria_persona:
 *           type: string
 *           format: uuid
 *         fecha_inicio_vigencia:
 *           type: string
 *           format: date
 *         fecha_fin_vigencia:
 *           type: string
 *           format: date
 *           nullable: true
 *         nemonico:
 *           type: string
 *         estado:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             nombre:
 *               type: string
 *
 *     TrnCategoriaPersonaVista:
 *       type: object
 *       properties:
 *         id_persona:
 *           type: string
 *           format: uuid
 *         id_categoria_persona:
 *           type: string
 *           format: uuid
 *         nombre_categoria:
 *           type: string
 *         descripcion_categoria:
 *           type: string
 *
 *     Pagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         pages:
 *           type: integer
 */

/**
 * @swagger
 * /trn-categoria-persona:
 *   post:
 *     summary: Crear una nueva asignación de categoría para una persona
 *     tags: [TrnCategoriaPersona]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TrnCategoriaPersonaInput'
 *     responses:
 *       201:
 *         description: Historial de categoría registrado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: Historial de categoría registrado correctamente
 *                 id_persona:
 *                   type: string
 *                   format: uuid
 *                 id_categoria_persona:
 *                   type: string
 *                   format: uuid
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as TrnCategoriaPersonaDTO;
    await TrnCategoriaPersonaModel.create(dto);
    res.status(201).json({
      mensaje: 'Historial de categoría registrado correctamente',
      id_persona: dto.id_persona,
      id_categoria_persona: dto.id_categoria_persona
    });
  })
);

/**
 * @swagger
 * /trn-categoria-persona:
 *   get:
 *     summary: Listar historial de categorías (modo tabla o vista)
 *     tags: [TrnCategoriaPersona]
 *     parameters:
 *       - in: query
 *         name: modo
 *         schema:
 *           type: string
 *           enum: [tabla, vista]
 *           default: tabla
 *       - in: query
 *         name: id_persona
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: id_categoria_persona
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: fecha_inicio_vigencia
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_fin_vigencia
 *         schema:
 *           type: string
 *           format: date
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
 *         description: Lista de asignaciones con paginación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - $ref: '#/components/schemas/TrnCategoriaPersonaTabla'
 *                       - $ref: '#/components/schemas/TrnCategoriaPersonaVista'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const filters: TrnCategoriaPersonaFilter = {
      modo: (req.query.modo as 'tabla' | 'vista') || 'tabla',
      id_persona: req.query.id_persona as string,
      id_categoria_persona: req.query.id_categoria_persona as string,
      fecha_inicio_vigencia: req.query.fecha_inicio_vigencia as string,
      fecha_fin_vigencia: req.query.fecha_fin_vigencia as string,
      estado: req.query.estado as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };

    const result = await TrnCategoriaPersonaModel.findAll(filters);
    res.json(result);
  })
);

/**
 * @swagger
 * /trn-categoria-persona:
 *   put:
 *     summary: Actualizar una asignación de categoría existente
 *     tags: [TrnCategoriaPersona]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TrnCategoriaPersonaInput'
 *     responses:
 *       200:
 *         description: Historial de categoría actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: Historial de categoría actualizado correctamente
 */
router.put(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as TrnCategoriaPersonaDTO;
    await TrnCategoriaPersonaModel.update(dto);
    res.json({ mensaje: 'Historial de categoría actualizado correctamente' });
  })
);

/**
 * @swagger
 * /trn-categoria-persona:
 *   delete:
 *     summary: Inactivar una asignación de categoría (DELETE lógico)
 *     tags: [TrnCategoriaPersona]
 *     parameters:
 *       - in: query
 *         name: id_persona
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: id_categoria_persona
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: fecha_inicio_vigencia
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Historial de categoría inactivado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: Historial de categoría inactivado correctamente
 */
router.delete(
  '/',
  route(async (req: Request, res: Response) => {
    const { id_persona, id_categoria_persona, fecha_inicio_vigencia } = req.query as any;
    const inactiveStateId = process.env.INACTIVE_STATE_ID;
    if (!inactiveStateId) {
      throw new Error('INACTIVE_STATE_ID no está definido en el entorno');
    }
    await TrnCategoriaPersonaModel.deactivate(
      id_persona,
      id_categoria_persona,
      fecha_inicio_vigencia,
      inactiveStateId
    );
    res.json({ mensaje: 'Historial de categoría inactivado correctamente' });
  })
);

export default router;
