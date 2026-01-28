import { Router, type Request, type Response } from 'express';
import {
  renderSSR,
  renderError,
  getMetadata,
  injectMetaTags,
} from '../ssr/renderer.js';

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

      // Inject dynamic OG and Twitter meta tags, replacing any existing ones
      const metadata = getMetadata(filename);
      const finalHtml = injectMetaTags(html, metadata);

      res.status(status).send(finalHtml);
    } catch (error) {
      console.error('SSR error:', error);
      const errorResult = renderError('Failed to render page', 500);
      res.status(errorResult.status).send(errorResult.html);
    }
  }
);

export { router as ssrRoutes };
