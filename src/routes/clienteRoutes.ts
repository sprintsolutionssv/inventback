import { Router, Request, Response } from 'express';
import { ClienteModel, ClienteFilter, ClienteDTO } from '../models/ClienteModel';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Clientes
 *   description: Consulta de clientes desde la vista materializada "vista_clientes"
 */

/**
 * @swagger
 * /clientes:
 *   get:
 *     summary: Listar clientes con filtros y paginación
 *     tags: [Clientes]
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
 *         description: Nombre completo o parte del nombre
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
 *         description: Lista de clientes
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
 *                       id_persona:
 *                         type: string
 *                         format: uuid
 *                       nombre_completo:
 *                         type: string
 *                       primer_nombre:
 *                         type: string
 *                       segundo_nombre:
 *                         type: string
 *                       primer_apellido:
 *                         type: string
 *                       nit:
 *                         type: string
 *                       nrc:
 *                         type: string
 *                       email_principal:
 *                         type: string
 *                       telefono_principal:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const filters: ClienteFilter = {
      nit: req.query.nit as string,
      nrc: req.query.nrc as string,
      nombre: req.query.nombre as string,
      email: req.query.email as string,
      telefono: req.query.telefono as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10
    };
    const result = await ClienteModel.findAll(filters);
    res.json(result);
  })
);

/**
 * @swagger
 * /clientes:
 *   post:
 *     summary: Crear o vincular persona como cliente
 *     tags: [Clientes]
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
 *         description: Persona creada y vinculada como cliente correctamente.
 *       200:
 *         description: Persona ya existente, mapeo como cliente realizado.
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as ClienteDTO;
    const result = await ClienteModel.create(dto);
    const status = result.message.startsWith('Persona creada') ? 201 : 200;
    res.status(status).json({ id_persona: result.id_persona, mensaje: result.message });
  })
);

export default router;
