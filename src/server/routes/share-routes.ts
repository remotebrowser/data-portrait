import { Router, Request, Response } from 'express';
import { generateOpenGraphTags } from '../utils/open-graph.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const GCS_BUCKET_NAME = 'data-portrait-imagegen';

function handleSharedPage(
  req: Request<{ filename: string }>,
  res: Response
): void {
  const { filename } = req.params;

  if (!filename) {
    res.status(400).send('Invalid filename');
    return;
  }

  const imageUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;
  const canonicalUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  const ogTags = generateOpenGraphTags({
    title: 'Data Portrait',
    description: 'Check out this AI-generated data portrait from GetGather.',
    imageUrl,
    url: canonicalUrl,
    siteName: 'GetGather',
  });

  try {
    const templatePath = join(__dirname, '../templates/share.html');
    let html = readFileSync(templatePath, 'utf-8');

    html = html.replace('{{OPEN_GRAPH_TAGS}}', ogTags.join('\n    '));
    html = html.replace('{{IMAGE_URL}}', imageUrl);

    res.send(html);
  } catch (error) {
    console.error('Error loading share template:', error);
    res.status(500).send('Internal server error');
  }
}

router.get('/shared/:filename', handleSharedPage);

export { router as shareRoutes };
