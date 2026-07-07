import { Request, Response } from 'express';
import { parseHTML } from 'linkedom';
import { settings } from '../config.js';
import { geolocationService } from '../services/geolocation-service.js';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import {
  deleteBrowser,
  distillPage,
  getDistilled,
  navigatePage,
  prepareNewBrowser,
  readDistilledOnce,
} from '../services/remotebrowser.js';

const GOODREADS_REVIEW_LIST_URL =
  'https://www.goodreads.com/review/list?ref=nav_mybooks&view=table';

// The distilled sign-in form is served in the modal iframe; these assets are
// served from data-portrait's public/ dir (Vite in dev, express.static in prod).
const DPAGE_CSS = '/dpage.css';
const DPAGE_JS = '/dpage-signin.js';

// A minimal styled loading page for the iframe; `extraBody` injects page-specific
// markup (e.g. the auto-submitting redirect form) above the spinner.
function loadingPage(extraBody = ''): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${DPAGE_CSS}" />
  </head>
  <body>
    ${extraBody}
    <div class="content-wrapper">
      <span class="spinner" aria-label="Loading" style="border-top-color: #333"></span>
      <span>Loading...</span>
    </div>
  </body>
</html>`;
}

// Browsers can't redirect from a GET to a POST, so serve an auto-submitting form.
function redirect(action: string): string {
  return loadingPage(
    `<form id="redirect" action="${action}" method="post"></form>
    <script>setTimeout(() => document.getElementById('redirect').submit(), 3000);</script>`
  );
}

/**
 * Take mcp-getgather's distilled sign-in HTML and turn it into a self-posting
 * form styled for the modal iframe: strip the <h1>, inject our stylesheet +
 * script, and wrap the body in a card <form> that POSTs back to our dpage route.
 */
function formatDistilledPage(
  html: string,
  browserId: string,
  pageId: string
): string {
  const { document } = parseHTML(html);

  document
    .querySelectorAll('h1')
    .forEach((h1: { remove: () => void }) => h1.remove());

  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', DPAGE_CSS);
  document.head.appendChild(link);

  const script = document.createElement('script');
  script.setAttribute('src', DPAGE_JS);
  script.setAttribute('defer', '');
  document.head.appendChild(script);

  const form = document.createElement('form');
  form.setAttribute('method', 'POST');
  form.setAttribute('action', `/getgather/dpage/${browserId}/${pageId}`);

  const body = document.body;
  while (body.firstChild) {
    form.appendChild(body.firstChild);
  }

  const card = document.createElement('div');
  card.setAttribute('class', 'card');
  card.appendChild(form);
  body.appendChild(card);

  return `<!doctype html>${document.documentElement.outerHTML}`;
}

/**
 * Advance the distillation loop, then read the distilled page once: the
 * book-list JSON if it's ready, otherwise the sign-in form HTML.
 */
async function initiateDistill(
  browserId: string,
  pageId: string,
  fields: Record<string, string> = {}
): Promise<{ json?: unknown[]; html: string }> {
  await distillPage(browserId, pageId, fields);
  const { json, html } = await getDistilled(browserId, pageId);
  return json && json.length > 0 ? { json, html } : { html };
}

function browserCreateHeaders(req: Request): Record<string, string | undefined> {
  const clientIp = geolocationService.getClientIp(req);
  const userAgent = req.headers['user-agent'];
  const headers: Record<string, string | undefined> = {
    'x-getgather-custom-app': 'data-portrait',
    'x-origin-ip': clientIp,
    'user-agent': Array.isArray(userAgent) ? userAgent.join(', ') : userAgent,
  };
  if (settings.GETGATHER_APP_KEY) {
    headers['Authorization'] = `Bearer ${settings.GETGATHER_APP_KEY}_${req.sessionID}`;
  }
  return headers;
}

// POST /getgather/goodreads/connect — create a fresh browser and open the review list.
export const handleGoodreadsConnect = async (req: Request, res: Response) => {
  try {
    const headers = browserCreateHeaders(req);
    const { browserId, pageId } = await prepareNewBrowser(headers);
    await navigatePage(browserId, pageId, GOODREADS_REVIEW_LIST_URL);

    Logger.info('Goodreads dpage browser ready', {
      component: 'goodreads-handler',
      operation: 'connect',
      brandId: 'goodreads',
      browserSessionId: browserId,
      pageId,
    });

    res.json({ browserId, pageId });
  } catch (error) {
    Logger.error('Goodreads connect failed', error as Error, {
      component: 'goodreads-handler',
      operation: 'connect',
    });
    res.status(500).json({ error: 'Failed to start Goodreads connection' });
  }
};

// GET /getgather/dpage/:browserId/:pageId — iframe entry; auto-POSTs to itself.
export const handleGoodreadsDpageGet = (req: Request, res: Response) => {
  const { browserId, pageId } = req.params;
  if (!browserId || !pageId) {
    res.status(400).send();
    return;
  }
  res.type('text/html').send(redirect(`/getgather/dpage/${browserId}/${pageId}`));
};

// POST /getgather/dpage/:browserId/:pageId — drive one distill step; return the
// next distilled form (HTML) or a spinner once the data is ready.
export const handleGoodreadsDpagePost = async (req: Request, res: Response) => {
  const { browserId, pageId } = req.params;
  if (!browserId || !pageId) {
    res.status(400).send();
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    fields[key] = typeof value === 'string' ? value : String(value);
  }

  try {
    const { json, html } = await initiateDistill(browserId, pageId, fields);
    if (json) {
      // Data is ready; show a spinner until the client's poll grabs it.
      res.type('text/html').send(loadingPage());
    } else {
      res.type('text/html').send(formatDistilledPage(html, browserId, pageId));
    }
  } catch (error) {
    Logger.error('Goodreads dpage step failed', error as Error, {
      component: 'goodreads-handler',
      operation: 'dpage',
      browserSessionId: browserId,
      pageId,
    });
    res.status(500).send();
  }
};

// POST /getgather/goodreads/poll — return the book list once distillation yields JSON.
export const handleGoodreadsPoll = async (req: Request, res: Response) => {
  const { browser_id: browserId, page_id: pageId } = (req.body ?? {}) as {
    browser_id?: string;
    page_id?: string;
  };
  if (!browserId || !pageId) {
    res.status(400).json({ error: 'browser_id and page_id are required' });
    return;
  }

  // Single, fast read: if the distilled page isn't the book-list JSON yet
  // (still on the sign-in / verification form, or not ready), stay PENDING and
  // let the client's poll interval drive the retry — don't hold the request open.
  const distilled = await readDistilledOnce(browserId, pageId);
  const content = distilled?.json ?? [];
  const status = content.length > 0 ? 'SUCCESS' : 'PENDING';

  res.json({ status, content });
};

// POST /getgather/goodreads/finalize — tear down the remote browser.
export const handleGoodreadsFinalize = async (req: Request, res: Response) => {
  const { browser_id: browserId } = (req.body ?? {}) as { browser_id?: string };
  if (!browserId) {
    res.status(400).json({ error: 'browser_id is required' });
    return;
  }
  await deleteBrowser(browserId);
  res.json({ ok: true });
};
