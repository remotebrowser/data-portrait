import { unlink } from 'fs/promises';
import { ServerLogger as Logger } from './logger/index.js';

export type CleanupOptions = {
  delayMs?: number;
  component?: string;
  operation?: string;
};

const DEFAULT_CLEANUP_OPTIONS: Required<CleanupOptions> = {
  delayMs: 0,
  component: 'file-cleanup',
  operation: 'cleanup',
};

/**
 * Clean up temporary files asynchronously.
 * Can optionally delay cleanup (useful for allowing file downloads to complete).
 *
 * @param filePaths - Array of file paths to clean up
 * @param options - Cleanup options (delay, logging context)
 *
 * @example
 * ```typescript
 * // Immediate cleanup
 * await cleanupFiles([path1, path2]);
 *
 * // Delayed cleanup (e.g., after 90 seconds for downloads)
 * await cleanupFiles([path1, path2], { delayMs: 90_000 });
 * ```
 */
export async function cleanupFiles(
  filePaths: string[],
  options: CleanupOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_CLEANUP_OPTIONS, ...options };

  const performCleanup = async () => {
    for (const filePath of filePaths) {
      try {
        await unlink(filePath);
        Logger.debug('Cleaned up temporary file', {
          component: opts.component,
          operation: opts.operation,
          filePath,
        });
      } catch (error) {
        Logger.warn('Failed to cleanup temporary file', {
          component: opts.component,
          operation: opts.operation,
          filePath,
          error: (error as Error).message,
        });
      }
    }
  };

  if (opts.delayMs > 0) {
    setTimeout(performCleanup, opts.delayMs);
  } else {
    await performCleanup();
  }
}

/**
 * Add cleanup paths to an array for later cleanup.
 * Useful for accumulating paths throughout a request handler.
 *
 * @param cleanupPaths - Array to add paths to
 * @param newPaths - Paths to add
 *
 * @example
 * ```typescript
 * const cleanupPaths: string[] = [];
 *
 * // After processing
 * addCleanupPaths(cleanupPaths, [originalPath, resizedPath]);
 *
 * // Finally block
 * await cleanupFiles(cleanupPaths);
 * ```
 */
export function addCleanupPaths(
  cleanupPaths: string[],
  newPaths: string[]
): void {
  cleanupPaths.push(...newPaths);
}
