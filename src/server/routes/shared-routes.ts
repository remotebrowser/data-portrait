import path from 'path';
import { readFileSync } from 'fs';
import { Router, type Request, type Response } from 'express';

const GCS_BUCKET_NAME = 'data-portrait-imagegen';

function loadTemplate(templatePath: string): string {
  return readFileSync(templatePath, 'utf-8');
}

function injectMetaTags(html: string, imageUrl: string): string {
  const ogPattern = /<meta property="og:[^"]*" content="[^"]*" \/>/gi;
  const twitterPattern = /<meta property="twitter:[^"]*" content="[^"]*" \/>/gi;

  let finalHtml = html.replace(ogPattern, '');
  finalHtml = finalHtml.replace(twitterPattern, '');

  const metaTags = `<meta property="og:title" content="Data Portrait by GetGather" /><meta property="og:description" content="Transform your shopping history into stunning personalized portraits" /><meta property="og:image" content="${imageUrl}" /><meta property="og:type" content="website" /><meta property="twitter:card" content="summary_large_image" /><meta property="twitter:image" content="${imageUrl}" />`;

  return finalHtml.replace('</head>', `${metaTags}</head>`);
}

function renderSSR(filename: string): string {
  const baseTemplate = loadTemplate(
    path.join(process.cwd(), 'dist/client/index.html')
  );
  const sharedTemplate = loadTemplate(
    path.join(process.cwd(), 'dist/client/templates/shared.html')
  );

  const imageUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;
  const innerHtml = sharedTemplate
    .replace('{{imageUrl}}', imageUrl)
    .replace('{{timestamp}}', Date.now().toString());

  const finalHtml = baseTemplate.replace('<div id="root"></div>', innerHtml);

  return injectMetaTags(finalHtml, imageUrl);
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
