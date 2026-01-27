import path from 'path';
import { readFileSync } from 'fs';
import * as cheerio from 'cheerio';

const GCS_BUCKET_NAME = 'data-portrait-imagegen';

export interface RenderResult {
  html: string;
  status: number;
}

// Get metadata for a shared portrait
export function getMetadata(filename: string): Record<string, string> {
  const imageUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;
  return {
    'og:title': 'Data Portrait by GetGather',
    'og:description':
      'Transform your shopping history into stunning personalized portraits',
    'og:image': imageUrl,
    'og:type': 'website',
    'twitter:card': 'summary_large_image',
    'twitter:image': imageUrl,
  };
}

/**
 * Injects meta tags into HTML head, replacing any existing og: or twitter: meta tags
 * Uses cheerio for reliable DOM manipulation
 */
export function injectMetaTags(
  html: string,
  metadata: Record<string, string>
): string {
  const $ = cheerio.load(html);

  // Remove all existing og: and twitter: meta tags
  $('head').find('meta[property^="og:"], meta[property^="twitter:"]').remove();

  // Add new meta tags to head
  const head = $('head');
  Object.entries(metadata).forEach(([key, value]) => {
    head.append(
      `<meta property="${key}" content="${value.replace(/"/g, '&quot;')}" />`
    );
  });

  return $.html();
}

export function renderError(message: string, status: number): RenderResult {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Error ${status}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
          'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
          sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f3f4f6;
      }
      .container {
        text-align: center;
        padding: 2rem;
      }
      h1 {
        font-size: 2rem;
        font-weight: bold;
        color: #1f2937;
        margin-bottom: 0.5rem;
      }
      p {
        color: #6b7280;
        margin-bottom: 1rem;
      }
      a {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background-color: #3b82f6;
        color: white;
        text-decoration: none;
        border-radius: 0.375rem;
        transition: background-color 0.2s;
      }
      a:hover {
        background-color: #2563eb;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Error ${status}</h1>
      <p>${message}</p>
      <a href="/">← Go back home</a>
    </div>
  </body>
</html>`;

  return { html, status };
}

export async function renderSSR(filename: string): Promise<RenderResult> {
  try {
    // Read template
    const templatePath = path.join(process.cwd(), 'dist/client/index.html');
    let template: string;

    try {
      template = readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Failed to read template:', error);
      return renderError('Failed to render page', 500);
    }

    // Render a simple HTML string that matches SharedPortrait
    // The client will hydrate and take over
    const imageUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;
    const html = `<div class="fixed inset-0 bg-black flex items-center justify-center p-4"><div class="relative max-w-4xl max-h-[90vh] w-full h-full flex flex-col items-center"><a href="${imageUrl}" download="data-portrait-${Date.now()}.png" class="absolute top-4 right-4 bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">Download</a><img src="${imageUrl}" alt="Shared data portrait" class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" /><p class="text-white mt-4 text-center">Shared Data Portrait <a href="/" class="underline hover:text-gray-300">Create your own</a></p></div></div>`;

    // Replace root placeholder with rendered HTML
    const finalHtml = template.replace(
      '<div id="root"></div>',
      `<div id="root">${html}</div>`
    );

    return { html: finalHtml, status: 200 };
  } catch (error) {
    console.error('SSR error:', error);
    return renderError('Failed to render page', 500);
  }
}
