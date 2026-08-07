import { Request, Response } from 'express';
import { parseHTML } from 'linkedom';
import { settings } from '../config.js';
import { geolocationService } from '../services/geolocation-service.js';
import { analytics } from '../services/analytics-service.js';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { postprocessDistilled } from '../services/retailers/postprocess.js';
import {
  deleteBrowser,
  distillPage,
  getDistilled,
  navigatePage,
  prepareNewBrowser,
  readDistilledOnce,
} from '../services/remotebrowser.js';

/**
 * Retailers that sign in through the iframe distill flow, mapped to the URL we
 * navigate the remote browser to. mcp-getgather's distiller matches a pattern by
 * hostname + page content — never by URL — so a single data URL drives the whole
 * flow: signed out it distills to the sign-in form, signed in it distills to the
 * data JSON. Onboarding a retailer is this one entry.
 */
const RETAILER_DPAGE_URLS: Record<string, string> = {
  amazon: 'https://www.amazon.com/your-orders/orders',
  doordash: 'https://www.doordash.com/orders',
  gofood: 'https://gofood.co.id/en/orders',
  goodreads: 'https://www.goodreads.com/review/list?ref=nav_mybooks&view=table',
  officedepot:
    'https://www.officedepot.com/orderhistory/orderHistoryListSet.do?ordersInMonths=0&orderType=ALL&orderStatus=A',
  shopee: 'https://shopee.co.id/user/purchase',
  wayfair:
    'https://www.wayfair.com/session/secure/account/order_search.php?page=1',
};

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

// A terminal message page for the iframe, styled like the loading page.
function errorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${DPAGE_CSS}" />
  </head>
  <body>
    <div class="content-wrapper">
      <p>${message}</p>
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
  form.setAttribute('action', `/getgather/dpage/frame/${browserId}/${pageId}`);

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
 * retailer's data JSON if it's ready, otherwise the sign-in form HTML.
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

/**
 * A real sign-in / verification step has fields to fill (email, password, OTP).
 * A distilled *data* page (signed in) has none — only content and buttons. Use
 * the presence of form inputs to tell "render this form" apart from "distill
 * matched something but produced nothing usable", so stale data selectors surface
 * as an error instead of a raw HTML dump in the modal.
 */
function hasSignInFields(html: string): boolean {
  try {
    const { document } = parseHTML(html);
    return document.querySelectorAll('input, select, textarea').length > 0;
  } catch {
    return false;
  }
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

// POST /getgather/dpage/:brandId/connect — create a fresh browser and open the data URL.
export const handleDpageConnect = async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const dataUrl = brandId ? RETAILER_DPAGE_URLS[brandId] : undefined;
  if (!dataUrl) {
    res.status(400).json({ error: `Unsupported dpage retailer: ${brandId}` });
    return;
  }

  try {
    const headers = browserCreateHeaders(req);
    const { browserId, pageId } = await prepareNewBrowser(headers);
    await navigatePage(browserId, pageId, dataUrl);

    Logger.info('dpage browser ready', {
      component: 'dpage-handler',
      operation: 'connect',
      brandId,
      browserSessionId: browserId,
      pageId,
    });

    res.json({ browserId, pageId });
  } catch (error) {
    Logger.error('dpage connect failed', error as Error, {
      component: 'dpage-handler',
      operation: 'connect',
      brandId,
    });
    res.status(500).json({ error: `Failed to start ${brandId} connection` });
  }
};

// GET /getgather/dpage/frame/:browserId/:pageId — iframe entry; auto-POSTs to itself.
export const handleDpageFrameGet = (req: Request, res: Response) => {
  const { browserId, pageId } = req.params;
  if (!browserId || !pageId) {
    res.status(400).send();
    return;
  }
  res
    .type('text/html')
    .send(redirect(`/getgather/dpage/frame/${browserId}/${pageId}`));
};

// POST /getgather/dpage/frame/:browserId/:pageId — drive one distill step; return
// the next distilled form (HTML) or a spinner once the data is ready.
export const handleDpageFramePost = async (req: Request, res: Response) => {
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
    } else if (hasSignInFields(html)) {
      // Still a sign-in / verification step to complete.
      res.type('text/html').send(formatDistilledPage(html, browserId, pageId));
    } else {
      // Distill matched a page but produced neither structured data nor a form to
      // fill — typically signed in with stale data selectors. Say so explicitly
      // rather than dumping raw HTML, which reads as a blank or garbled dialog.
      Logger.warn('dpage distill produced no data and no sign-in fields', {
        component: 'dpage-handler',
        operation: 'frame',
        browserSessionId: browserId,
        pageId,
      });
      res
        .type('text/html')
        .send(
          errorPage(
            "We couldn't read your data right now. Please try connecting again later."
          )
        );
    }
  } catch (error) {
    Logger.error('dpage step failed', error as Error, {
      component: 'dpage-handler',
      operation: 'frame',
      browserSessionId: browserId,
      pageId,
    });
    res.status(500).send();
  }
};

// POST /getgather/dpage/:brandId/poll — return the data once distillation yields JSON.
export const handleDpagePoll = async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const { browser_id: browserId, page_id: pageId } = (req.body ?? {}) as {
    browser_id?: string;
    page_id?: string;
  };
  if (!browserId || !pageId) {
    res.status(400).json({ error: 'browser_id and page_id are required' });
    return;
  }

  // Single, fast read: if the distilled page isn't the data JSON yet
  // (still on the sign-in / verification form, or not ready), stay PENDING and
  // let the client's poll interval drive the retry — don't hold the request open.
  const distilled = await readDistilledOnce(browserId, pageId);
  const rows = distilled?.json ?? [];
  const content = postprocessDistilled(brandId ?? '', rows);
  const status = content.length > 0 ? 'SUCCESS' : 'PENDING';

  // Data arriving is what marks the connection as complete on this flow, so both
  // events fire on the same transition. The client stops polling after SUCCESS,
  // so this runs once per connection.
  if (status === 'SUCCESS') {
    const clientIp = geolocationService.getClientIp(req);
    analytics.track(req.sessionID, 'connection_successful', {
      brand_name: brandId,
      client_ip: clientIp,
    });
    analytics.track(req.sessionID, 'data_retrieved_successful', {
      brand_name: brandId,
      data_count: content.length,
      purchase_history: content,
      client_ip: clientIp,
    });
  }

  res.json({ status, content });
};

// POST /getgather/dpage/:brandId/finalize — tear down the remote browser.
export const handleDpageFinalize = async (req: Request, res: Response) => {
  const { browser_id: browserId } = (req.body ?? {}) as { browser_id?: string };
  if (!browserId) {
    res.status(400).json({ error: 'browser_id is required' });
    return;
  }
  await deleteBrowser(browserId);
  res.json({ ok: true });
};
