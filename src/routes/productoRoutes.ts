// src/routes/productoRoutes.ts
import { Router, Request, Response } from 'express';
import ProductoModel, { ProductoDTO, ProductoFilter } from '../models/ProductoModel';
import { route } from '../utils/route';

const router = Router();

// Regex laxo: acepta cualquier UUID “con forma” (incluye el nil UUID)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v?: string) {
  return !!v && UUID_RE.test(v);
}

function isDateYYYYMMDD(v?: string) {
  if (!v) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && v === d.toISOString().slice(0, 10);
}

function validateProductoDTO(dto: any): string[] {
  const e: string[] = [];
  if (!dto || typeof dto !== 'object') return ['Body inválido'];

  const reqStr = ['sku', 'nombre', 'unidad_medida', 'categoria'];
  for (const k of reqStr) {
    if (typeof dto[k] !== 'string' || dto[k].trim() === '') e.push(`${k} requerido`);
  }

  if (typeof dto.precio_base !== 'number' || dto.precio_base < 0)
    e.push('precio_base debe ser número >= 0');
  if (typeof dto.total_unidades !== 'number' || dto.total_unidades <= 0)
    e.push('total_unidades debe ser número > 0');
  if (typeof dto.saldo !== 'number' || dto.saldo < 0)
    e.push('saldo debe ser número >= 0');

  if (!isDateYYYYMMDD(dto.fecha_inicio)) e.push('fecha_inicio inválida (YYYY-MM-DD)');
  if (!isDateYYYYMMDD(dto.fecha_vencimiento))
    e.push('fecha_vencimiento inválida (YYYY-MM-DD)');

  if (dto.proveedores !== undefined) {
    if (!Array.isArray(dto.proveedores)) e.push('proveedores debe ser array de UUID');
    else if (!dto.proveedores.every((p: any) => typeof p === 'string' && isUuid(p)))
      e.push('proveedores contiene UUID inválidos');
  }

  return e;
}

function validateListQuery(q: Record<string, string | string[] | undefined>): {
  errors: string[];
  filters?: ProductoFilter;
} {
  const e: string[] = [];
  const getNum = (v?: string) => (v !== undefined ? Number(v) : undefined);

  const page = getNum(q.page as string);
  const size = getNum(q.size as string);
  const precio_min = getNum(q.precio_min as string);
  const precio_max = getNum(q.precio_max as string);
  const sort = (q.sort as string) || undefined;

  if (page !== undefined && (!Number.isInteger(page) || page < 1)) e.push('page inválido');
  if (size !== undefined && (!Number.isInteger(size) || size < 1)) e.push('size inválido');

  if (precio_min !== undefined && Number.isNaN(precio_min)) e.push('precio_min inválido');
  if (precio_max !== undefined && Number.isNaN(precio_max)) e.push('precio_max inválido');

  if (sort) {
    const fld = sort.replace(/^-/, '');
    const valid = ['sku', 'nombre', 'categoria', 'precio_base', 'total_unidades', 'saldo'];
    if (!valid.includes(fld)) e.push('sort inválido');
  }

  if (e.length) return { errors: e };

  const filters: ProductoFilter = {
    page: page ?? 1,
    size: size ?? 20,
    sort,
    sku: (q.sku as string) || undefined,
    categoria: (q.categoria as string) || undefined,
    precio_min,
    precio_max
  };
  return { errors: [], filters };
}

/**
 * @swagger
 * tags:
 *   name: Productos
 *   description: Gestión de productos
 *
 * components:
 *   schemas:
 *     ProveedorSummary:
 *       type: object
 *       properties:
 *         id_persona:
 *           type: string
 *           format: uuid
 *         nombre_completo:
 *           type: string
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
 *         description: Bad Request (validación).
 *       409:
 *         description: SKU duplicado.
 *       500:
 *         description: Error interno.
 */
router.post(
  '/',
  route(async (req: Request, res: Response) => {
    const errors = validateProductoDTO(req.body);
    if (errors.length) return res.status(400).json({ errors });

    try {
      const result = await ProductoModel.create(req.body as ProductoDTO);
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(err.status || 500).json({ error: err.message || 'Error interno' });
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
 *           example: "-precio_base"
 *         description: "Campo y dirección (prefijo '-' para DESC). Campos válidos: sku,nombre,categoria,precio_base,total_unidades,saldo"
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
 *       400:
 *         description: Parámetros inválidos.
 *       500:
 *         description: Error interno.
 */
router.get(
  '/',
  route(async (req: Request, res: Response) => {
    const { errors, filters } = validateListQuery(req.query as any);
    if (errors.length) return res.status(400).json({ errors });

    try {
      const result = await ProductoModel.findAll(filters!);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Error interno' });
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
 *         description: Detalle de producto.
 *       400:
 *         description: UUID inválido.
 *       404:
 *         description: No encontrado.
 *       500:
 *         description: Error interno.
 */
router.get(
  '/:id_producto',
  route(async (req: Request, res: Response) => {
    const { id_producto } = req.params;
    if (!isUuid(id_producto)) return res.status(400).json({ error: 'UUID inválido' });

    try {
      const prod = await ProductoModel.findById(id_producto);
      return res.json(prod);
    } catch (err: any) {
      return res.status(err.status || 500).json({ error: err.message || 'Error interno' });
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
 *       400:
 *         description: UUID/body inválido.
 *       404:
 *         description: No encontrado.
 *       409:
 *         description: SKU duplicado.
 *       500:
 *         description: Error interno.
 */
router.put(
  '/:id_producto',
  route(async (req: Request, res: Response) => {
    const { id_producto } = req.params;
    if (!isUuid(id_producto)) return res.status(400).json({ error: 'UUID inválido' });

    const errors = validateProductoDTO(req.body);
    if (errors.length) return res.status(400).json({ errors });

    try {
      const result = await ProductoModel.update(id_producto, req.body as ProductoDTO);
      return res.json(result);
    } catch (err: any) {
      return res.status(err.status || 500).json({ error: err.message || 'Error interno' });
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
 *       400:
 *         description: UUID inválido.
 *       404:
 *         description: No encontrado.
 *       500:
 *         description: Error interno.
 */
router.delete(
  '/:id_producto',
  route(async (req: Request, res: Response) => {
    const { id_producto } = req.params;
    if (!isUuid(id_producto)) return res.status(400).json({ error: 'UUID inválido' });

    try {
      await ProductoModel.delete(id_producto);
      return res.status(204).end();
    } catch (err: any) {
      return res.status(err.status || 500).json({ error: err.message || 'Error interno' });
    }
  })
);

export default router;
