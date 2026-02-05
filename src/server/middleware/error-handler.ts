import { Request, Response, NextFunction } from 'express';
import { ServerLogger } from '../utils/logger/index.js';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error details
  ServerLogger.error('Express error occurred', err, {
    component: 'error-handler',
    method: req.method,
    path: req.path,
    statusCode,
    operation: 'request-error',
  });

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  });
};
