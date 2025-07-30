import { Router, Request, Response } from 'express';
import {
  DocumentoPersonaModel,
  DocumentoPersonaDTO,
  DocumentoPersonaFilter
} from '../models/DocumentoPersonaModel';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: DocumentoPersona
 *   description: Asociación de documentos a personas
 */

/**
 * @swagger
 * /documento-persona:
 *   post:
 *     summary: Crear Documento-Persona
 *     tags: [DocumentoPersona]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_persona
 *               - tipo_documento
 *               - numero_documento
 *               - entidad_emisora
 *               - fecha_emision
 *               - estado
 *             properties:
 *               id_persona:
 *                 type: string
 *                 format: uuid
 *               tipo_documento:
 *                 type: string
 *               numero_documento:
 *                 type: string
 *               entidad_emisora:
 *                 type: string
 *               fecha_emision:
 *                 type: string
 *                 format: date
 *               fecha_expiracion:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               estado:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Documento vinculado correctamente a la persona.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_documento_persona:
 *                   type: string
 *                   format: uuid
 *                 mensaje:
 *                   type: string
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as DocumentoPersonaDTO;
    const id = await DocumentoPersonaModel.create(dto);
    res.status(201).json({
      id_documento_persona: id,
      mensaje: 'Documento vinculado correctamente a la persona.'
    });
  })
);

/**
 * @swagger
 * /documento-persona:
 *   get:
 *     summary: Obtener Documentos de Persona
 *     tags: [DocumentoPersona]
 *     parameters:
 *       - in: query
 *         name: id_persona
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: tipo_documento
 *         schema:
 *           type: string
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: entidad_emisora
 *         schema:
 *           type: string
 *       - in: query
 *         name: fecha_emision
 *         schema:
 *           type: string
 *           format: date
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
 *         description: Lista paginada de documentos de persona
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const filters: DocumentoPersonaFilter = {
      id_persona: req.query.id_persona as string,
      tipo_documento: req.query.tipo_documento as string,
      estado: req.query.estado as string,
      entidad_emisora: req.query.entidad_emisora as string,
      fecha_emision: req.query.fecha_emision as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    const result = await DocumentoPersonaModel.findAll(filters);
    res.json(result);
  })
);

/**
 * @swagger
 * /documento-persona/{id}:
 *   get:
 *     summary: Obtener Documento-Persona por ID
 *     tags: [DocumentoPersona]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalle del documento
 *       404:
 *         description: No encontrado
 */
router.get(
  '/:id',
  route(async (req: Request, res: Response) => {
    const doc = await DocumentoPersonaModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(doc);
  })
);

/**
 * @swagger
 * /documento-persona/{id}:
 *   put:
 *     summary: Actualizar Documento-Persona
 *     tags: [DocumentoPersona]
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
 *               numero_documento:
 *                 type: string
 *               fecha_emision:
 *                 type: string
 *                 format: date
 *               fecha_expiracion:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               entidad_emisora:
 *                 type: string
 *               estado:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Documento actualizado exitosamente.
 */
router.put(
  '/:id',
  route(async (req: Request, res: Response) => {
    await DocumentoPersonaModel.update(req.params.id, req.body);
    res.json({
      id_documento_persona: req.params.id,
      mensaje: 'Documento actualizado exitosamente.'
    });
  })
);

/**
 * @swagger
 * /documento-persona/{id}:
 *   delete:
 *     summary: Eliminar Documento-Persona (lógica)
 *     tags: [DocumentoPersona]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Documento desasociado correctamente.
 */
router.delete(
  '/:id',
  route(async (req: Request, res: Response) => {
    await DocumentoPersonaModel.deactivate(req.params.id);
    res.json({
      id_documento_persona: req.params.id,
      mensaje: 'Documento desasociado correctamente.'
    });
  })
);

export default router;
