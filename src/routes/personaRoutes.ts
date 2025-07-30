// src/routes/personaRoutes.ts
import { Router, Request, Response } from 'express';
import { PersonaModel, PersonaDTO, PersonaFilter } from '../models/PersonaModel';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PersonaInput:
 *       type: object
 *       required:
 *         - id_nombre_persona
 *         - estado
 *       properties:
 *         id_empresa:
 *           type: string
 *           format: uuid
 *           example: "5c34a9d4-8f61-4db2-8f21-c0f3e4b3e889"
 *         id_categoria_persona:
 *           type: string
 *           format: uuid
 *           example: "09a4dafa-7c98-11ec-90d6-0242ac120003"
 *         id_nombre_persona:
 *           type: string
 *           format: uuid
 *           example: "d1f43d2c-a417-11ec-b909-0242ac120002"
 *         id_naturaleza:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: null
 *         estado:
 *           type: string
 *           format: uuid
 *           example: "bdf7bc5c-7c98-11ec-90d6-0242ac120003"
 *     PersonaResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/PersonaInput'
 *         - type: object
 *           properties:
 *             id_persona:
 *               type: string
 *               format: uuid
 *               example: "bd7c826e-9d75-4c82-a82c-e8513f9f5671"
 */

/**
 * @swagger
 * tags:
 *   name: Personas
 *   description: Operaciones sobre personas
 */

/**
 * @swagger
 * /personas:
 *   get:
 *     summary: Listar personas con filtros y paginación
 *     tags: [Personas]
 *     parameters:
 *       - in: query
 *         name: id_empresa
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: id_categoria
 *         schema:
 *           type: string
 *           format: uuid
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
 *         name: id_naturaleza
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
 *         description: Lista paginada de personas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PersonaResponse'
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
    const filters: PersonaFilter = {
      id_empresa: req.query.id_empresa as string,
      id_categoria: req.query.id_categoria as string,
      nombre: req.query.nombre as string,
      estado: req.query.estado as string,
      id_naturaleza: req.query.id_naturaleza as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    const result = await PersonaModel.findAll(filters);
    res.json(result);
  })
);

/**
 * @swagger
 * /personas/{id}:
 *   get:
 *     summary: Obtener detalle de una persona
 *     tags: [Personas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Datos de la persona
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PersonaResponse'
 *       404:
 *         description: Persona no encontrada
 */
router.get(
  '/:id',
  route(async (req: Request, res: Response) => {
    const persona = await PersonaModel.findById(req.params.id);
    if (!persona) return res.status(404).json({ error: 'Persona no encontrada' });
    res.json(persona);
  })
);

/**
 * @swagger
 * /personas:
 *   post:
 *     summary: Crear una nueva persona
 *     tags: [Personas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonaInput'
 *     responses:
 *       201:
 *         description: Persona creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_persona:
 *                   type: string
 *                   format: uuid
 *                 mensaje:
 *                   type: string
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as PersonaDTO;
    const id_persona = await PersonaModel.create(dto);
    res.status(201).json({ id_persona, mensaje: 'Persona registrada exitosamente.' });
  })
);

/**
 * @swagger
 * /personas/{id}:
 *   put:
 *     summary: Actualizar una persona existente
 *     tags: [Personas]
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
 *             $ref: '#/components/schemas/PersonaInput'
 *     responses:
 *       200:
 *         description: Persona actualizada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_persona:
 *                   type: string
 *                   format: uuid
 *                 mensaje:
 *                   type: string
 */
router.put(
  '/:id',
  route(async (req: Request, res: Response) => {
    const dto = req.body as PersonaDTO;
    await PersonaModel.update(req.params.id, dto);
    res.json({ id_persona: req.params.id, mensaje: 'Persona actualizada exitosamente.' });
  })
);

/**
 * @swagger
 * /personas/{id}:
 *   delete:
 *     summary: Inactivar una persona
 *     tags: [Personas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Persona inactivada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_persona:
 *                   type: string
 *                   format: uuid
 *                 mensaje:
 *                   type: string
 */
router.delete(
  '/:id',
  route(async (req: Request, res: Response) => {
    const INACTIVE_ID = process.env.INACTIVE_STATE_ID;
    if (!INACTIVE_ID) {
      throw new Error('INACTIVE_STATE_ID no está definido en el entorno');
    }
    await PersonaModel.deactivate(req.params.id, INACTIVE_ID);
    res.json({ id_persona: req.params.id, mensaje: 'Persona inactivada correctamente.' });
  })
);

export default router;
