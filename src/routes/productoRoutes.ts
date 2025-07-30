import { Router, Request, Response } from 'express';
import ProductoModel, { ProductoDTO, ProductoFilter } from '../models/ProductoModel';
import { route } from '../utils/route';

const router = Router();

// Ahora aceptamos cualquier UUID v4 (sin validar versión)  
const UUID_REGEX = /^[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}$/;
const SORT_REGEX = /^-?(sku|nombre|categoria|precio_base|total_unidades|saldo)$/;

/**
 * @swagger
 * tags:
 *   name: Productos
 *   description: Gestión de productos
 */

/**
 * @swagger
 * /api/productos:
 *   post:
 *     summary: 🧾 REQ240720240001 – Crear Producto
 *     tags: [Productos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoInput'
 *     responses:
 *       201:
 *         description: Producto creado exitosamente.
 *       400:
 *         description: Bad Request (validaciones)
 *       409:
 *         description: Conflict (SKU duplicado)
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const dto = req.body as ProductoDTO;
    if (!dto.sku || !dto.nombre || !dto.unidad_medida || !dto.categoria) {
      return res.status(400).json({ error: 'sku, nombre, unidad_medida y categoria son obligatorios' });
    }
    if (typeof dto.precio_base !== 'number' || dto.precio_base < 0) {
      return res.status(400).json({ error: 'precio_base debe ser un número ≥ 0' });
    }
    if (!Number.isInteger(dto.total_unidades) || dto.total_unidades < 0) {
      return res.status(400).json({ error: 'total_unidades debe ser un entero ≥ 0' });
    }
    if (!Number.isInteger(dto.saldo) || dto.saldo < 0 || dto.saldo > dto.total_unidades) {
      return res.status(400).json({ error: 'saldo inválido (0 ≤ saldo ≤ total_unidades)' });
    }
    if (dto.fecha_inicio && isNaN(Date.parse(dto.fecha_inicio))) {
      return res.status(400).json({ error: 'fecha_inicio inválida (YYYY-MM-DD)' });
    }
    if (dto.fecha_vencimiento && isNaN(Date.parse(dto.fecha_vencimiento))) {
      return res.status(400).json({ error: 'fecha_vencimiento inválida (YYYY-MM-DD)' });
    }
    if (dto.fecha_inicio && dto.fecha_vencimiento && new Date(dto.fecha_inicio) > new Date(dto.fecha_vencimiento)) {
      return res.status(400).json({ error: 'fecha_inicio debe ser ≤ fecha_vencimiento' });
    }
    if (dto.proveedores) {
      if (!Array.isArray(dto.proveedores)) {
        return res.status(400).json({ error: 'proveedores debe ser un arreglo de UUIDs' });
      }
      for (const p of dto.proveedores) {
        if (!UUID_REGEX.test(p)) {
          return res.status(400).json({ error: `UUID de proveedor inválido: ${p}` });
        }
      }
    }

    try {
      const result = await ProductoModel.create(dto);
      return res.status(201).json(result);
    } catch (err: any) {
      if (err.status === 409) return res.status(409).json({ error: err.message });
      throw err;
    }
  })
);

/**
 * @swagger
 * /api/productos:
 *   get:
 *     summary: Obtener lista de productos con filtros y paginación
 *     tags: [Productos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *       - in: query
 *         name: sku
 *         schema: { type: string }
 *       - in: query
 *         name: categoria
 *         schema: { type: string }
 *       - in: query
 *         name: precio_min
 *         schema: { type: number, minimum: 0 }
 *       - in: query
 *         name: precio_max
 *         schema: { type: number, minimum: 0 }
 *     responses:
 *       200:
 *         description: Lista de productos
 *       400:
 *         description: Bad Request (parámetros inválidos)
 *       500:
 *         description: Server Error
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const filters: ProductoFilter = {};

    if (q.page !== undefined) {
      const p = parseInt(q.page, 10);
      if (isNaN(p) || p < 1) return res.status(400).json({ error: 'page inválido' });
      filters.page = p;
    }
    if (q.size !== undefined) {
      const s = parseInt(q.size, 10);
      if (isNaN(s) || s < 1) return res.status(400).json({ error: 'size inválido' });
      filters.size = s;
    }
    if (q.sort !== undefined) {
      if (!SORT_REGEX.test(q.sort)) return res.status(400).json({ error: 'sort inválido' });
      filters.sort = q.sort;
    }
    if (q.sku !== undefined) filters.sku = q.sku;
    if (q.categoria !== undefined) filters.categoria = q.categoria;
    if (q.precio_min !== undefined) {
      const m = Number(q.precio_min);
      if (isNaN(m) || m < 0) return res.status(400).json({ error: 'precio_min inválido' });
      filters.precio_min = m;
    }
    if (q.precio_max !== undefined) {
      const M = Number(q.precio_max);
      if (isNaN(M) || M < 0) return res.status(400).json({ error: 'precio_max inválido' });
      filters.precio_max = M;
    }

    try {
      const result = await ProductoModel.findAll(filters);
      return res.json(result);
    } catch {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  })
);

/**
 * @swagger
 * /api/productos/{id_producto}:
 *   get:
 *     summary: 🧾 REQ240730250002 – Obtener Producto por ID
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id_producto
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Datos del producto
 *       400:
 *         description: UUID inválido
 *       404:
 *         description: Not Found
 *       500:
 *         description: Server Error
 */
router.get(
  '/:id_producto',
  route(async (req: Request, res: Response) => {
    const { id_producto } = req.params;
    if (!UUID_REGEX.test(id_producto)) {
      return res.status(400).json({ error: 'UUID inválido' });
    }
    try {
      const prod = await ProductoModel.findById(id_producto);
      return res.json(prod);
    } catch (err: any) {
      if (err.status === 404) return res.status(404).json({ error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  })
);

/**
 * @swagger
 * /api/productos/{id_producto}:
 *   put:
 *     summary: 🧾 REQ240730250003 – Actualizar Producto
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id_producto
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoInput'
 *     responses:
 *       200:
 *         description: Producto actualizado exitosamente.
 *       400:
 *         description: Bad Request
 *       404:
 *         description: Not Found
 *       409:
 *         description: Conflict (SKU duplicado)
 *       500:
 *         description: Server Error
 */
router.put(
  '/:id_producto',
  route(async (req: Request, res: Response) => {
    const { id_producto } = req.params;
    if (!UUID_REGEX.test(id_producto)) {
      return res.status(400).json({ error: 'UUID inválido' });
    }
    const dto = req.body as ProductoDTO;
    if (!dto.sku || !dto.nombre || !dto.unidad_medida || !dto.categoria) {
      return res.status(400).json({ error: 'sku, nombre, unidad_medida y categoria son obligatorios' });
    }
    if (typeof dto.precio_base !== 'number' || dto.precio_base < 0) {
      return res.status(400).json({ error: 'precio_base debe ser un número ≥ 0' });
    }
    if (!Number.isInteger(dto.total_unidades) || dto.total_unidades < 0) {
      return res.status(400).json({ error: 'total_unidades debe ser un entero ≥ 0' });
    }
    if (!Number.isInteger(dto.saldo) || dto.saldo < 0 || dto.saldo > dto.total_unidades) {
      return res.status(400).json({ error: 'saldo inválido (0 ≤ saldo ≤ total_unidades)' });
    }
    if (dto.fecha_inicio && isNaN(Date.parse(dto.fecha_inicio))) {
      return res.status(400).json({ error: 'fecha_inicio inválida (YYYY-MM-DD)' });
    }
    if (dto.fecha_vencimiento && isNaN(Date.parse(dto.fecha_vencimiento))) {
      return res.status(400).json({ error: 'fecha_vencimiento inválida (YYYY-MM-DD)' });
    }
    if (dto.fecha_inicio && dto.fecha_vencimiento && new Date(dto.fecha_inicio) > new Date(dto.fecha_vencimiento)) {
      return res.status(400).json({ error: 'fecha_inicio debe ser ≤ fecha_vencimiento' });
    }

    try {
      const result = await ProductoModel.update(id_producto, dto);
      return res.json(result);
    } catch (err: any) {
      if (err.status === 404) return res.status(404).json({ error: err.message });
      if (err.status === 409) return res.status(409).json({ error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  })
);

/**
 * @swagger
 * /api/productos/{id_producto}:
 *   delete:
 *     summary: 🧾 REQ240720240002 – Eliminar/Inactivar Producto
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id_producto
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: No Content
 *       404:
 *         description: Not Found
 *       500:
 *         description: Server Error
 */
router.delete(
  '/:id_producto',
  route(async (req: Request, res: Response) => {
    const { id_producto } = req.params;
    if (!UUID_REGEX.test(id_producto)) {
      return res.status(400).json({ error: 'UUID inválido' });
    }
    try {
      await ProductoModel.delete(id_producto);
      return res.status(204).end();
    } catch (err: any) {
      if (err.status === 404) return res.status(404).json({ error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  })
);

export default router;
