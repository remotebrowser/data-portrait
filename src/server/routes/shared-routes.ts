import path from 'path';
import { readFileSync } from 'fs';
import { Router, type Request, type Response } from 'express';
import { settings } from '../config.js';

function renderSSR(filename: string): string {
  const template = readFileSync(
    path.join(process.cwd(), 'dist/client/templates/shared.html'),
    'utf-8'
  );

  const imageUrl = `https://storage.googleapis.com/${settings.GCS_BUCKET_NAME}/${filename}`;
  const metaTags = `<meta property="og:title" content="Data Portrait by GetGather" /><meta property="og:description" content="Transform your shopping history into stunning personalized portraits" /><meta property="og:image" content="${imageUrl}" /><meta property="og:type" content="website" /><meta property="twitter:card" content="summary_large_image" /><meta property="twitter:image" content="${imageUrl}" />`;

  return template
    .replace('{{imageUrl}}', imageUrl)
    .replace('{{timestamp}}', Date.now().toString())
    .replace('</head>', `${metaTags}</head>`);
}

const router = Router();

router.get(
  '/shared/:filename',
  async (req: Request, res: Response): Promise<void> => {
    const { filename } = req.params as { filename: string };

    if (!filename) {
      throw new Error('Invalid filename');
    }

    const html = renderSSR(filename);
    res.send(html);
  }
);

export { router as ssrRoutes };
