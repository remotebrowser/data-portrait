import { Router, type Request, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getStoryData, type StoryData } from '../handlers/stories-handler.js';

export const storyRouter = Router();

function injectMetaTags(
  html: string,
  storyData: StoryData,
  baseUrl: string
): string {
  const firstImage = storyData.stories[0]?.imageUrl || '';
  const storyTitle = storyData.stories[0]?.title || 'Data Portrait Story';
  const description = `View ${storyData.stories.length} story ${storyData.stories.length === 1 ? 'slide' : 'slides'} from Data Portrait by GetGather`;
  const url = `${baseUrl}/story/${storyData.id}`;

  // Replace all placeholders
  return html
    .replace(/\{\{url\}\}/g, url)
    .replace(/\{\{title\}\}/g, storyTitle)
    .replace(/\{\{description\}\}/g, description)
    .replace(/\{\{imageUrl\}\}/g, firstImage);
}

// Serve story pages with dynamic Open Graph tags
storyRouter.get('/story/:storyId', async (req: Request, res: Response) => {
  const { storyId } = req.params;
  const isProduction = process.env.NODE_ENV === 'production';

  // In development, let Vite handle the request (SPA mode)
  // Only do server-side rendering in production for social media crawlers
  if (!isProduction) {
    // In dev, serve the regular index.html and let React Router handle it
    const indexPath = path.join(process.cwd(), 'index.html');
    return res.sendFile(indexPath);
  }

  // Production: serve story.html with injected meta tags (Vite builds it to public/templates/)
  const storyHtmlPath = path.join(
    process.cwd(),
    'dist/client/public/templates/story.html'
  );

  try {
    // Read the story HTML template
    let storyHtml = await fs.readFile(storyHtmlPath, 'utf-8');

    // Get story data from shared handler
    const storyData = await getStoryData(storyId);

    // Inject dynamic meta tags
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    storyHtml = injectMetaTags(storyHtml, storyData, baseUrl);

    // Send the HTML with proper headers
    res.setHeader('Content-Type', 'text/html');
    res.send(storyHtml);
  } catch (error) {
    console.error('Error serving story page:', error);
    // Fallback to index.html if story.html not found
    res.sendFile(path.join(process.cwd(), 'dist/client/index.html'));
  }
});
