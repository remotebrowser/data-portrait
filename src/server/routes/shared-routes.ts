import path from 'path';
import { readFileSync } from 'fs';
import { Router, type Request, type Response } from 'express';

const GCS_BUCKET_NAME = 'data-portrait-imagegen';

interface RenderResult {
  html: string;
  status: number;
}

function renderError(message: string, status: number): RenderResult {
  const templatePath = path.join(process.cwd(), 'templates/error.html');
  let html: string;

  try {
    html = readFileSync(templatePath, 'utf-8');
  } catch {
    html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Error ${status}</title>
  </head>
  <body>Error ${status}: ${message}</body>
</html>`;
  }

  html = html
    .replace('{{status}}', status.toString())
    .replace('{{message}}', message);

  return { html, status };
}

async function renderSSR(filename: string): Promise<RenderResult> {
  const templatePath = path.join(process.cwd(), 'dist/client/index.html');
  let template: string;

  try {
    template = readFileSync(templatePath, 'utf-8');
  } catch (error) {
    console.error('Failed to read template:', error);
    return renderError('Failed to render page', 500);
  }

  const imageUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;
  const innerHtml = `<div class="fixed inset-0 bg-black flex items-center justify-center p-4"><div class="relative max-w-4xl max-h-[90vh] w-full h-full flex flex-col items-center"><a href="${imageUrl}" download="data-portrait-${Date.now()}.png" class="absolute top-4 right-4 bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">Download</a><img src="${imageUrl}" alt="Shared data portrait" class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" /><p class="text-white mt-4 text-center">Shared Data Portrait <a href="/" class="underline hover:text-gray-300">Create your own</a></p></div></div>`;

  let finalHtml = template.replace(
    '<div id="root"></div>',
    `<div id="root">${innerHtml}</div>`
  );

  const ogPattern = /<meta property="og:[^"]*" content="[^"]*" \/>/gi;
  finalHtml = finalHtml.replace(ogPattern, '');
  finalHtml = finalHtml.replace(
    /<meta property="twitter:[^"]*" content="[^"]*" \/>/gi,
    ''
  );

  const metaTags = `<meta property="og:title" content="Data Portrait by GetGather" /><meta property="og:description" content="Transform your shopping history into stunning personalized portraits" /><meta property="og:image" content="${imageUrl}" /><meta property="og:type" content="website" /><meta property="twitter:card" content="summary_large_image" /><meta property="twitter:image" content="${imageUrl}" />`;

  finalHtml = finalHtml.replace('</head>', `${metaTags}</head>`);

  return { html: finalHtml, status: 200 };
}

const router = Router();

router.get(
  '/shared/:filename',
  async (req: Request, res: Response): Promise<void> => {
    const { filename } = req.params as { filename: string };

    if (!filename) {
      const error = renderError('Invalid filename', 400);
      res.status(error.status).send(error.html);
      return;
    }

    try {
      const { html, status } = await renderSSR(filename);
      res.status(status).send(html);
    } catch (error) {
      console.error('SSR error:', error);
      const errorResult = renderError('Failed to render page', 500);
      res.status(errorResult.status).send(errorResult.html);
    }
  }
);

export { router as ssrRoutes };
