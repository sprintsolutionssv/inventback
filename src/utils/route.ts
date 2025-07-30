// src/utils/route.ts

import { Request, Response, NextFunction, RequestHandler } from 'express';

type SimpleHandler = (req: Request, res: Response) => any;

/**
 * Envuelve un SimpleHandler (solo req, res) en un RequestHandler completo
 * que captura errores y los pasa a next().
 */
export function route(h: SimpleHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise
      .resolve(h(req, res))
      .catch(next);
  };
}
