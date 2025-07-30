// src/swagger.ts
import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from './config/Config';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'CRM Backend API',
    version: '1.0.0',
    description: 'Documentación de la API de microservicios',
  },
  servers: [
    {
      url: `http://localhost:${config.PORT}/api`,
      description: 'Servidor local',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

// Usamos any porque no hay tipos para swagger-jsdoc
const options: any = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/models/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
