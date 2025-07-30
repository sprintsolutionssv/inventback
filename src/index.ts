// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import config from './config/Config';
import ConnectionManager from './connection/ConnectionManager';
import PostgreSQLStrategy from './connection/PostgreSQLStrategy';
import logger from './logs/Logger';
import routes  from './routes/index';
import { setupSwagger } from './swagger';
import cors from 'cors';


// Captura errores no manejados
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack, module: 'Core' });
  process.exit(1);
});
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', { reason, module: 'Core' });
});

// 1) Crea y exporta la app
export const app = express();
app.use(express.json());
app.use(
  morgan('combined', {
    stream: { write: (msg: string) => logger.info(msg.trim(), { module: 'HTTP' }) }
  })
);
app.use(cors());
app.use('/api', routes);

// Configura Swagger
setupSwagger(app);

// Manejador de errores global (consola + JSON)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('ERROR GLOBAL:', err);
  res.status(err.status || 500).json({ error: err.message });
});

// 2) Función para arrancar servidor y DB
export async function start(): Promise<void> {
  ConnectionManager.registerStrategy('postgres', new PostgreSQLStrategy());
  try {
    await ConnectionManager.getConnection('postgres');
    logger.info('DB connection established', { module: 'Database' });
  } catch (err: any) {
    logger.error('DB connection failed', { error: err.message, module: 'Database' });
    process.exit(1);
  }
  app.listen(config.PORT, () =>
    logger.info(`Server listening on port ${config.PORT}`, { module: 'HTTP' })
  );
}

// 3) Si se arranca directamente
if (require.main === module) {
  start();
}
