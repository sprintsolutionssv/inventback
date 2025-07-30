// src/routes/empresaRoutes.ts
import { Router, Request, Response } from 'express';
import { EmpresaModel, EmpresaDTO, EmpresaFilter } from '../models/EmpresaModel';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     EmpresaInput:
 *       type: object
 *       required:
 *         - nombre
 *         - nit
 *         - nrc
 *         - correo_contacto
 *       properties:
 *         nombre:
 *           type: string
 *           example: "Comercial Delta S.A. de C.V."
 *         nit:
 *           type: string
 *           example: "0614-290898-101-3"
 *         nrc:
 *           type: string
 *           example: "123456-7"
 *         correo_contacto:
 *           type: string
 *           format: email
 *           example: "contacto@delta.com.sv"
 *     EmpresaResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/EmpresaInput'
 *         - type: object
 *           properties:
 *             id_empresa:
 *               type: string
 *               format: uuid
 *               example: "9d12fa14-d65c-4059-b38e-2fce9bb71cc4"
 *             estado:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 nombre:
 *                   type: string
 *             fecha_creacion:
 *               type: string
 *               format: date
 *               example: "2024-07-17"
 *     EmpresasListResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/EmpresaResponse'
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             pages:
 *               type: integer
 */



/**
 * @swagger
 * /empresas:
 *   get:
 *     summary: Listar empresas con filtros y paginación
 *     tags: [Empresas]
 *     parameters:
 *       - in: query
 *         name: nombre
 *         schema:
 *           type: string
 *       - in: query
 *         name: nit
 *         schema:
 *           type: string
 *       - in: query
 *         name: nrc
 *         schema:
 *           type: string
 *       - in: query
 *         name: correo_contacto
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
 *         description: Lista paginada de empresas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresasListResponse'
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const filters: EmpresaFilter = {
      nombre: req.query.nombre as string,
      nit: req.query.nit as string,
      nrc: req.query.nrc as string,
      correo_contacto: req.query.correo_contacto as string,
      estado: req.query.estado as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    const result = await EmpresaModel.findAll(filters);
    res.json(result);
  })
);

/**
 * @swagger
 * /empresas/{id}:
 *   get:
 *     summary: Obtener detalle de una empresa
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalle de la empresa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaResponse'
 *       404:
 *         description: Empresa no encontrada
 */
router.get(
  '/:id',
  route(async (req: Request, res: Response) => {
    const empresa = await EmpresaModel.findById(req.params.id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(empresa);
  })
);

/**
 * @swagger
 * tags:
 *   name: Empresas
 *   description: Operaciones sobre empresas
 */

/**
 * @swagger
 * /empresas:
 *   post:
 *     summary: Registrar una nueva empresa
 *     tags: [Empresas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresaInput'
 *     responses:
 *       201:
 *         description: Empresa registrada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_empresa:
 *                   type: string
 *                 mensaje:
 *                   type: string
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as EmpresaDTO;
    const id_empresa = await EmpresaModel.create(dto);
    res.status(201).json({ id_empresa, mensaje: 'Empresa registrada exitosamente.' });
  })
);

/**
 * @swagger
 * /empresas/{id}:
 *   put:
 *     summary: Actualizar datos de una empresa
 *     tags: [Empresas]
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
 *             $ref: '#/components/schemas/EmpresaInput'
 *     responses:
 *       200:
 *         description: Empresa actualizada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_empresa:
 *                   type: string
 *                 mensaje:
 *                   type: string
 */
router.put(
  '/:id',
  route(async (req: Request, res: Response) => {
    const dto = req.body as EmpresaDTO;
    await EmpresaModel.update(req.params.id, dto);
    res.json({ id_empresa: req.params.id, mensaje: 'Empresa actualizada correctamente.' });
  })
);

/**
 * @swagger
 * /empresas/{id}:
 *   delete:
 *     summary: Inactivar una empresa
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Empresa inactivada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_empresa:
 *                   type: string
 *                 mensaje:
 *                   type: string
 */
router.delete(
  '/:id',
  route(async (req: Request, res: Response) => {
    const INACTIVE_ID = process.env.INACTIVE_STATE_ID;
    if (!INACTIVE_ID) throw new Error('INACTIVE_STATE_ID no está definido');
    await EmpresaModel.deactivate(req.params.id, INACTIVE_ID);
    res.json({ id_empresa: req.params.id, mensaje: 'Empresa inactivada correctamente.' });
  })
);

export default router;
