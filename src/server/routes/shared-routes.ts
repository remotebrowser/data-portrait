import path from 'path';
import { readFileSync } from 'fs';
import { Router, type Request, type Response } from 'express';
import { settings } from '../config.js';

function renderShared(filename: string): string {
  const template = readFileSync(
    path.join(process.cwd(), 'dist/client/templates/shared.html'),
    'utf-8'
  );

  const imageUrl = `https://storage.googleapis.com/${settings.GCS_BUCKET_NAME}/${filename}`;

  return template
    .replace(/{{imageUrl}}/g, imageUrl)
    .replace('{{timestamp}}', Date.now().toString());
}

const router = Router();

router.get(
  '/shared/:filename',
  async (req: Request, res: Response): Promise<void> => {
    const { filename } = req.params as { filename: string };

    if (!filename) {
      throw new Error('Invalid filename');
    }

    const html = renderShared(filename);
    res.send(html);
  }
);

export { router as ssrRoutes };
