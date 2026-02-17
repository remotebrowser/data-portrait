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

// Clean up temporary files. Optional delay for allowing downloads to complete.
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

// Add cleanup paths to an array for later cleanup.
export function addCleanupPaths(
  cleanupPaths: string[],
  newPaths: string[]
): void {
  cleanupPaths.push(...newPaths);
}
