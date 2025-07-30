import { Router, Request, Response } from 'express';
import { ProveedorModel, ProveedorFilter, ProveedorDTO } from '../models/ProveedorModel';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Proveedores
 *   description: Gestión de proveedores
 */

/**
 * @swagger
 * /proveedores:
 *   get:
 *     summary: Listar proveedores con filtros y paginación
 *     tags: [Proveedores]
 *     parameters:
 *       - in: query
 *         name: nit
 *         schema:
 *           type: string
 *         description: NIT completo o parcial
 *       - in: query
 *         name: nrc
 *         schema:
 *           type: string
 *         description: NRC completo o parcial
 *       - in: query
 *         name: nombre
 *         schema:
 *           type: string
 *         description: Nombre completo o parcial
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Correo electrónico parcial
 *       - in: query
 *         name: telefono
 *         schema:
 *           type: string
 *         description: Teléfono parcial
 *       - in: query
 *         name: documento
 *         schema:
 *           type: string
 *         description: Número de documento (p.ej. DUI) parcial
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
 *         description: Lista de proveedores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Proveedor'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const filters: ProveedorFilter = {
      nit: req.query.nit as string,
      nrc: req.query.nrc as string,
      nombre: req.query.nombre as string,
      email: req.query.email as string,
      telefono: req.query.telefono as string,
      documento: req.query.documento as string,   // <— uso aquí
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    const result = await ProveedorModel.findAll(filters);
    res.json(result);
  })
);


/**
 * @swagger
 * /proveedores:
 *   post:
 *     summary: Crear o vincular persona como proveedor
 *     tags: [Proveedores]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - documentos
 *               - contacto
 *             properties:
 *               nombre:
 *                 type: object
 *                 properties:
 *                   primer_nombre:
 *                     type: string
 *                   segundo_nombre:
 *                     type: string
 *                   tercer_nombre:
 *                     type: string
 *                   primer_apellido:
 *                     type: string
 *                   segundo_apellido:
 *                     type: string
 *                   tercer_apellido:
 *                     type: string
 *               documentos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tipo_documento:
 *                       type: string
 *                     numero_documento:
 *                       type: string
 *                     entidad_emisora:
 *                       type: string
 *                     fecha_emision:
 *                       type: string
 *                       format: date
 *               contacto:
 *                 type: object
 *                 properties:
 *                   correo:
 *                     type: string
 *                     format: email
 *                   telefono:
 *                     type: string
 *                     example: "7845-0021"
 *     responses:
 *       201:
 *         description: Persona creada y vinculada como proveedor correctamente.
 *       200:
 *         description: Persona ya existente, mapeo como proveedor realizado.
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as ProveedorDTO;
    const result = await ProveedorModel.create(dto);
    const status = result.message.startsWith('Persona creada') ? 201 : 200;
    res.status(status).json({ id_persona: result.id_persona, mensaje: result.message });
  })
);

export default router;
