import { Router, Request, Response } from 'express';
import ProductoModel, { ProductoDTO, ProductoFilter } from '../models/ProductoModel';
import { route } from '../utils/route';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Productos
 *   description: Gestión de productos
 *
 * components:
 *   schemas:
 *     ProductoDTO:
 *       type: object
 *       required:
 *         - sku
 *         - nombre
 *         - unidad_medida
 *         - categoria
 *         - precio_base
 *         - total_unidades
 *         - saldo
 *       properties:
 *         sku:
 *           type: string
 *         nombre:
 *           type: string
 *         descripcion:
 *           type: string
 *         unidad_medida:
 *           type: string
 *         categoria:
 *           type: string
 *         precio_base:
 *           type: number
 *         total_unidades:
 *           type: integer
 *         saldo:
 *           type: integer
 *         fecha_inicio:
 *           type: string
 *           format: date
 *         fecha_vencimiento:
 *           type: string
 *           format: date
 *         proveedores:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *
 *     ProductoDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/ProductoDTO'
 *         - type: object
 *           properties:
 *             id_producto:
 *               type: string
 *               format: uuid
 *             estado:
 *               type: string
 *               format: uuid
 *             fecha_creacion:
 *               type: string
 *               format: date
 *             usuario_creacion:
 *               type: string
 *             proveedores:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProveedorSummary'
 *
 *     PaginatedProductos:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductoDetail'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             size:
 *               type: integer
 *             total_pages:
 *               type: integer
 *             total_items:
 *               type: integer
 */

/**
 * @swagger
 * /api/productos:
 *   post:
 *     summary: Crear Producto
 *     tags: [Productos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoDTO'
 *     responses:
 *       201:
 *         description: Producto creado exitosamente.
 *       400:
 *         description: Bad Request.
 *       409:
 *         description: SKU duplicado.
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as ProductoDTO;
    // validaciones simples...
    try {
      const result = await ProductoModel.create(dto);
      res.status(201).json(result);
    } catch (err: any) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/productos:
 *   get:
 *     summary: Listar productos
 *     tags: [Productos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *       - in: query
 *         name: sku
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *       - in: query
 *         name: precio_min
 *         schema:
 *           type: number
 *       - in: query
 *         name: precio_max
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Lista paginada.
 *       500:
 *         description: Error interno.
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const filters: ProductoFilter = {
      page: Number(q.page) || 1,
      size: Number(q.size) || 20,
      sort: q.sort,
      sku: q.sku,
      categoria: q.categoria,
      precio_min: q.precio_min ? Number(q.precio_min) : undefined,
      precio_max: q.precio_max ? Number(q.precio_max) : undefined
    };
    try {
      const result = await ProductoModel.findAll(filters);
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  })
);

/**
 * @swagger
 * /api/productos/{id_producto}:
 *   get:
 *     summary: Obtener producto por ID
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id_producto
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *     responses:
 *       200:
 *         description: Detalle.
 *       404:
 *         description: No encontrado.
 */
router.get(
  '/:id_producto',
  route(async (req: Request, res: Response) => {
    try {
      const prod = await ProductoModel.findById(req.params.id_producto);
      res.json(prod);
    } catch (err: any) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/productos/{id_producto}:
 *   put:
 *     summary: Actualizar producto
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id_producto
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoDTO'
 *     responses:
 *       200:
 *         description: Actualizado.
 *       404:
 *         description: No encontrado.
 *       409:
 *         description: SKU duplicado.
 */
router.put(
  '/:id_producto',
  route(async (req: Request, res: Response) => {
    try {
      const result = await ProductoModel.update(req.params.id_producto, req.body as ProductoDTO);
      res.json(result);
    } catch (err: any) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  })
);

/**
 * @swagger
 * /api/productos/{id_producto}:
 *   delete:
 *     summary: Eliminar producto
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id_producto
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *     responses:
 *       204:
 *         description: Eliminado.
 *       404:
 *         description: No encontrado.
 */
router.delete(
  '/:id_producto',
  route(async (req: Request, res: Response) => {
    try {
      await ProductoModel.delete(req.params.id_producto);
      res.status(204).end();
    } catch (err: any) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  })
);

export default router;
