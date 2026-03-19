import { Request, Response, NextFunction } from 'express';

export class IPBlockerMiddleware {
  middleware = async (
    _request: Request,
    _response: Response,
    next: NextFunction
  ): Promise<void> => {
    next();
  };
}
