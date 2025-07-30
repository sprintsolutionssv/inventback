import { Router, Request, Response } from 'express';
import {
  DocumentoModel,
  DocumentoDTO,
  DocumentoFilter
} from '../models/DocumentoModel';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Documentos
 *   description: Gestión de documentos de persona
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DocumentoInput:
 *       type: object
 *       required:
 *         - id_persona
 *         - tipo_documento
 *         - numero_documento
 *         - entidad_emisora
 *         - fecha_emision
 *         - estado
 *       properties:
 *         id_persona:
 *           type: string
 *           format: uuid
 *         tipo_documento:
 *           type: string
 *           example: DUI
 *         numero_documento:
 *           type: string
 *           example: '01234567-8'
 *         entidad_emisora:
 *           type: string
 *           example: RNPN
 *         fecha_emision:
 *           type: string
 *           format: date
 *         estado:
 *           type: string
 *           format: uuid
 *     DocumentoResponse:
 *       type: object
 *       properties:
 *         id_documento:
 *           type: string
 *           format: uuid
 *         mensaje:
 *           type: string
 */

/**
 * @swagger
 * /documentos:
 *   post:
 *     summary: Crear nuevo documento
 *     tags: [Documentos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentoInput'
 *     responses:
 *       201:
 *         description: Documento registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DocumentoResponse'
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as DocumentoDTO;
    const id_documento = await DocumentoModel.create(dto);
    res
      .status(201)
      .json({ id_documento, mensaje: 'Documento registrado exitosamente' });
  })
);

/**
 * @swagger
 * /documentos:
 *   get:
 *     summary: Listar documentos con filtros y paginación
 *     tags: [Documentos]
 *     parameters:
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
 *       - in: query
 *         name: id_persona
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista paginada de documentos
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const filters: DocumentoFilter = {
      id_persona: req.query.id_persona as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    const result = await DocumentoModel.findAll(filters);
    res.json(result);
  })
);

/**
 * @swagger
 * /documentos/{id}:
 *   get:
 *     summary: Obtener detalle de un documento
 *     tags: [Documentos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Datos del documento
 *       404:
 *         description: Documento no encontrado
 */
router.get(
  '/:id',
  route(async (req: Request, res: Response) => {
    const doc = await DocumentoModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(doc);
  })
);

/**
 * @swagger
 * /documentos/{id}:
 *   put:
 *     summary: Actualizar un documento existente
 *     tags: [Documentos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentoInput'
 *     responses:
 *       200:
 *         description: Documento actualizado correctamente
 */
router.put(
  '/:id',
  route(async (req: Request, res: Response) => {
    await DocumentoModel.update(req.params.id, req.body as Partial<DocumentoDTO>);
    res.json({ id_documento: req.params.id, mensaje: 'Documento actualizado correctamente' });
  })
);

/**
 * @swagger
 * /documentos/{id}:
 *   delete:
 *     summary: Eliminar (lógica) un documento existente
 *     tags: [Documentos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Documento inactivado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: Documento inactivado correctamente
 *                 id_documento:
 *                   type: string
 *                   format: uuid
 */
router.delete(
  '/:id',
  route(async (req: Request, res: Response) => {
    await DocumentoModel.deactivate(req.params.id);
    res.json({
      mensaje: 'Documento inactivado correctamente',
      id_documento: req.params.id
    });
  })
);

export default router;
