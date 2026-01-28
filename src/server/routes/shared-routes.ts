import path from 'path';
import { readFileSync } from 'fs';
import { Router, type Request, type Response } from 'express';
import { settings } from '../config.js';

function renderSSR(filename: string): string {
  const baseTemplate = readFileSync(
    path.join(process.cwd(), 'dist/client/index.html'),
    'utf-8'
  );
  const sharedTemplate = readFileSync(
    path.join(process.cwd(), 'dist/client/templates/shared.html'),
    'utf-8'
  );

  const imageUrl = `https://storage.googleapis.com/${settings.GCS_BUCKET_NAME}/${filename}`;
  const innerHtml = sharedTemplate
    .replace('{{imageUrl}}', imageUrl)
    .replace('{{timestamp}}', Date.now().toString());

  const finalHtml = baseTemplate.replace('<div id="root"></div>', innerHtml);

  const ogPattern = /<meta property="og:[^"]*" content="[^"]*" \/>/gi;
  const twitterPattern = /<meta property="twitter:[^"]*" content="[^"]*" \/>/gi;
  let html = finalHtml.replace(ogPattern, '').replace(twitterPattern, '');

  const metaTags = `<meta property="og:title" content="Data Portrait by GetGather" /><meta property="og:description" content="Transform your shopping history into stunning personalized portraits" /><meta property="og:image" content="${imageUrl}" /><meta property="og:type" content="website" /><meta property="twitter:card" content="summary_large_image" /><meta property="twitter:image" content="${imageUrl}" />`;

  return html.replace('</head>', `${metaTags}</head>`);
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
