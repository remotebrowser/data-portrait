import { Request } from 'express';

export function getAppHost(req: Request): string {
  // Get protocol (http/https)
  const protocol = req.protocol;

  // Get host (includes hostname and port if present)
  const host = req.get('host') || 'localhost:3000';

  return `${protocol}://${host}`;
}
