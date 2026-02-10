import path from 'path';
import { readFileSync } from 'fs';
import { Router, type Request, type Response } from 'express';
import { Storage } from '@google-cloud/storage';
import { settings } from '../config.js';

function renderShared(filename: string): string {
  const template = readFileSync(
    path.join(process.cwd(), 'dist/client/templates/shared.html'),
    'utf-8'
  );

  const imageUrl = `${settings.PUBLIC_URL}/shared/image/${filename}`;

  return template
    .replace(/{{imageUrl}}/g, imageUrl)
    .replace('{{timestamp}}', Date.now().toString());
}

const router = Router();

// Image proxy endpoint
router.get(
  '/shared/image/:filename',
  async (req: Request, res: Response): Promise<void> => {
    const { filename } = req.params as { filename: string };

    if (!filename) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    try {
      const storage = new Storage({
        projectId: settings.GCS_PROJECT_ID,
      });

      const bucket = storage.bucket(settings.GCS_BUCKET_NAME);
      const file = bucket.file(filename);

      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || 'image/png';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      const stream = file.createReadStream();
      stream.pipe(res);

      stream.on('error', (error) => {
        console.error(`Error streaming image ${filename}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream image' });
        }
      });
    } catch (error) {
      console.error(`Error proxying image ${filename}:`, error);
      res.status(500).json({ error: 'Failed to retrieve image' });
    }
  }
);

// Shared page endpoint
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

export { router };
