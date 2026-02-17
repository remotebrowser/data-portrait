import type { Response } from 'express';
import { ServerLogger as Logger } from './logger/index.js';

export type ErrorContext = {
  component: string;
  operation: string;
  [key: string]: unknown;
};

/**
 * Send standardized error response with logging.
 *
 * @param res - Express response object
 * @param error - The error that occurred
 * @param statusCode - HTTP status code (default: 500)
 * @param context - Context for logging
 * @param fallbackMessage - Fallback message if error is not an Error object
 *
 * @example
 * ```typescript
 * try {
 *   // ... operation
 * } catch (error) {
 *   sendErrorResponse(res, error, 500, {
 *     component: 'portrait-handler',
 *     operation: 'generate-portrait'
 *   });
 * }
 * ```
 */
export function sendErrorResponse(
  res: Response,
  error: unknown,
  statusCode: number = 500,
  context: ErrorContext,
  fallbackMessage: string = 'Operation failed. Please try again.'
): void {
  const errorMessage =
    error instanceof Error ? error.message : fallbackMessage;

  Logger.error(context.operation + ' failed', error as Error, context);

  res.status(statusCode).json({
    error: errorMessage,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get error message from unknown error value.
 * Safely extracts message from Error objects, returns string representation otherwise.
 *
 * @param error - Unknown error value
 * @param fallbackMessage - Message to return if extraction fails
 * @returns Error message string
 */
export function getErrorMessage(
  error: unknown,
  fallbackMessage: string = 'An unknown error occurred'
): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallbackMessage;
}
