// src/routes/index.ts
import { Router } from 'express';
import estadoRoutes from './estadoRoutes';
import personaRoutes from './personaRoutes';
import empresaRoutes from './empresaRoutes';
import categoriaPersonaRoutes from './categoriaPersonaRoutes';
import trnCategoriaPersonaRoutes from './trnCategoriaPersonaRoutes';
import clienteRoutes from './clienteRoutes';
import proveedorRoutes from './proveedorRoutes';
import documentoRoutes from './documentoRoutes';
import documentoPersonaRoutes from './documentoPersonaRoutes';
import categoriaRoutes from './categoriaRoutes';
import productoRoutes from './productoRoutes';
import almacenesRoutes from './almacenesRoutes';
import estantesRoutes from './estantesRoutes';  

const router = Router();

router.use('/estados', estadoRoutes);
router.use('/personas', personaRoutes);
router.use('/empresas', empresaRoutes);
router.use('/categoria', categoriaRoutes);
router.use('/categorias-persona', categoriaPersonaRoutes);
router.use('/trn-categoria-persona', trnCategoriaPersonaRoutes);
router.use('/clientes', clienteRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/documentos', documentoRoutes);
router.use('/documento-persona', documentoPersonaRoutes);
router.use('/productos', productoRoutes);
router.use('/almacenes', almacenesRoutes);
router.use('/estantes', estantesRoutes);  

export default router;
