import { Request, Response } from 'express';
import { parseHTML } from 'linkedom';
import type { Page } from 'playwright';
import { settings } from '../config.js';
import { geolocationService } from '../services/geolocation-service.js';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import {
  connectBrowser,
  deleteBrowser,
  navigatePage,
  openPage,
  prepareNewBrowser,
} from '../services/remotebrowser.js';
import { convert, distill, loadPatterns, patternsDir } from '../distill.js';

const GOODREADS_REVIEW_LIST_URL =
  'https://www.goodreads.com/review/list?ref=nav_mybooks&view=table';

// The distilled sign-in form is served in the modal iframe; these assets are
// served from data-portrait's public/ dir (Vite in dev, express.static in prod).
const DPAGE_CSS = '/dpage.css';
const DPAGE_JS = '/dpage-signin.js';

/**
 * Distilled state per browser session, keyed by `${browserId}/${pageId}`.
 * Distillation now happens locally (Playwright over CDP), so the distilled
 * sign-in form HTML / converted book list is kept here instead of on the
 * Remote Browser service.
 */
interface DpageState {
  html?: string;
  json?: Record<string, string>[];
}
const dpageStates = new Map<string, DpageState>();

// The distilled state of a freshly navigated or submitted page can lag behind
// the browser (redirects, late rendering), so distillation is retried until a
// pattern matches — mirroring the polling of the old distill REST API.
const DISTILL_RETRY_ATTEMPTS = 10;
const DISTILL_RETRY_INTERVAL_MS = 1_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

// A minimal styled notice page for the iframe (e.g. no distill pattern matched).
function noticePage(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${DPAGE_CSS}" />
  </head>
  <body>
    <div class="content-wrapper">
      <span>${message}</span>
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
 * Take the distilled sign-in HTML and turn it into a self-posting form styled
 * for the modal iframe: strip the rb-* distill attributes and the <h1>, inject
 * our stylesheet + script, and wrap the body in a card <form> that POSTs back
 * to our dpage route.
 */
function formatDistilledPage(
  html: string,
  browserId: string,
  pageId: string
): string {
  const { document } = parseHTML(html);

  for (const el of document.querySelectorAll('*')) {
    for (const attr of Array.from(
      el.attributes as Iterable<{ name: string; value: string }>
    )) {
      if (attr.name.startsWith('rb-')) {
        el.removeAttribute(attr.name);
      }
    }
  }

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
 * Distill the page's current state: match it against the local patterns and,
 * when a convertible pattern wins (the book list), run the JSON converter.
 */
async function distillStep(page: Page): Promise<DpageState> {
  for (let attempt = 0; attempt < DISTILL_RETRY_ATTEMPTS; attempt++) {
    try {
      const hostname = new URL(page.url()).hostname;
      const match = await distill(hostname, loadPatterns(), page);
      if (match) {
        const converted = await convert(match.distilled, patternsDir);
        if (converted.length > 0) {
          return { json: converted, html: match.distilled };
        }
        return { html: match.distilled };
      }
    } catch (error) {
      // The page can navigate (e.g. after an autoclick) mid-distillation;
      // retry on the new state.
      Logger.debug('Distillation attempt failed, retrying', {
        component: 'goodreads-handler',
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(DISTILL_RETRY_INTERVAL_MS);
  }
  return {};
}

/**
 * Apply the submitted form fields to the live page using the distilled form:
 * each named input's rb-match selector locates the real element to fill, then
 * the pattern's submit button is clicked.
 */
async function applyFields(
  page: Page,
  html: string,
  fields: Record<string, string>
): Promise<void> {
  const { document } = parseHTML(html);

  for (const [name, value] of Object.entries(fields)) {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) continue;
    const selector = el.getAttribute('rb-match');
    if (!selector) continue;

    if (el.getAttribute('type') === 'checkbox') {
      if (value === 'on') {
        await page.locator(selector).first().check();
      } else {
        await page.locator(selector).first().uncheck();
      }
    } else {
      await page.locator(selector).first().fill(value);
    }
  }

  const submit = document.querySelector('[type="submit"]');
  const submitSelector = submit?.getAttribute('rb-match');
  if (submitSelector) {
    await Promise.allSettled([
      page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      }),
      page.locator(submitSelector).first().click(),
    ]);
    await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});
  }
}

function browserCreateHeaders(
  req: Request
): Record<string, string | undefined> {
  const clientIp = geolocationService.getClientIp(req);
  const userAgent = req.headers['user-agent'];
  const headers: Record<string, string | undefined> = {
    'x-getgather-custom-app': 'data-portrait',
    'x-origin-ip': clientIp,
    'user-agent': Array.isArray(userAgent) ? userAgent.join(', ') : userAgent,
  };
  if (settings.GETGATHER_APP_KEY) {
    headers['Authorization'] =
      `Bearer ${settings.GETGATHER_APP_KEY}_${req.sessionID}`;
  }
  return headers;
}

// POST /getgather/goodreads/connect — create a fresh browser, open the review
// list, and distill it (the sign-in form) over CDP.
export const handleGoodreadsConnect = async (req: Request, res: Response) => {
  let browserId: string | undefined;
  let browser: Awaited<ReturnType<typeof connectBrowser>> | undefined;
  try {
    const headers = browserCreateHeaders(req);
    const { browserId: id, pageId } = await prepareNewBrowser(headers);
    browserId = id;

    browser = await connectBrowser(browserId);
    const page = await openPage(browser);
    Logger.info('Navigating to review list', {
      component: 'goodreads-handler',
      operation: 'connect',
      brandId: 'goodreads',
      browserSessionId: browserId,
      pageId,
    });
    await navigatePage(page, GOODREADS_REVIEW_LIST_URL);

    const state = await distillStep(page);
    dpageStates.set(`${browserId}/${pageId}`, state);

    Logger.info('Goodreads dpage browser ready', {
      component: 'goodreads-handler',
      operation: 'connect',
      brandId: 'goodreads',
      browserSessionId: browserId,
      pageId,
      distilled: state.html ? 'form' : 'none',
    });

    res.json({ browserId, pageId });
  } catch (error) {
    Logger.error('Goodreads connect failed', error as Error, {
      component: 'goodreads-handler',
      operation: 'connect',
    });
    res.status(500).json({ error: 'Failed to start Goodreads connection' });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        Logger.warn('Error closing Playwright connection', {
          component: 'goodreads-handler',
          operation: 'connect',
          browserSessionId: browserId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }
};

// GET /getgather/dpage/:browserId/:pageId — iframe entry; auto-POSTs to itself.
export const handleGoodreadsDpageGet = (req: Request, res: Response) => {
  const { browserId, pageId } = req.params;
  if (!browserId || !pageId) {
    res.status(400).send();
    return;
  }
  res
    .type('text/html')
    .send(redirect(`/getgather/dpage/${browserId}/${pageId}`));
};

// POST /getgather/dpage/:browserId/:pageId — apply the submitted fields to the
// live page and re-distill; return the next distilled form (HTML) or a spinner
// once the data is ready.
export const handleGoodreadsDpagePost = async (req: Request, res: Response) => {
  const { browserId, pageId } = req.params;
  if (!browserId || !pageId) {
    res.status(400).send();
    return;
  }

  const dpageKey = `${browserId}/${pageId}`;
  const state = dpageStates.get(dpageKey);
  if (!state) {
    res.status(400).send();
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [name, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    fields[name] = typeof value === 'string' ? value : String(value);
  }

  let browser: Awaited<ReturnType<typeof connectBrowser>> | undefined;
  try {
    browser = await connectBrowser(browserId);
    const page = await openPage(browser);

    if (Object.keys(fields).length > 0 && state.html) {
      // The form was submitted; fill the live page and click through.
      await applyFields(page, state.html, fields);
    }

    const next = await distillStep(page);
    dpageStates.set(dpageKey, next);

    if (next.json) {
      // Data is ready; show a spinner until the client's poll grabs it.
      res.type('text/html').send(loadingPage());
    } else if (next.html) {
      res
        .type('text/html')
        .send(formatDistilledPage(next.html, browserId, pageId));
    } else {
      res
        .type('text/html')
        .send(
          noticePage(
            'Additional verification is required for this account and cannot be completed here.'
          )
        );
    }
  } catch (error) {
    Logger.error('Goodreads dpage step failed', error as Error, {
      component: 'goodreads-handler',
      operation: 'dpage',
      browserSessionId: browserId,
      pageId,
    });
    res.status(500).send();
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        Logger.warn('Error closing Playwright connection', {
          component: 'goodreads-handler',
          operation: 'dpage',
          browserSessionId: browserId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }
};

// POST /getgather/goodreads/poll — return the book list once distillation
// yields JSON.
export const handleGoodreadsPoll = async (req: Request, res: Response) => {
  const { browser_id: browserId, page_id: pageId } = (req.body ?? {}) as {
    browser_id?: string;
    page_id?: string;
  };
  if (!browserId || !pageId) {
    res.status(400).json({ error: 'browser_id and page_id are required' });
    return;
  }

  const state = dpageStates.get(`${browserId}/${pageId}`);
  const content = state?.json ?? [];
  const status = content.length > 0 ? 'SUCCESS' : 'PENDING';

  res.json({ status, content });
};

// POST /getgather/goodreads/finalize — tear down the remote browser.
export const handleGoodreadsFinalize = async (req: Request, res: Response) => {
  const { browser_id: browserId, page_id: pageId } = (req.body ?? {}) as {
    browser_id?: string;
    page_id?: string;
  };
  if (!browserId) {
    res.status(400).json({ error: 'browser_id is required' });
    return;
  }
  if (pageId) {
    dpageStates.delete(`${browserId}/${pageId}`);
  }
  await deleteBrowser(browserId);
  res.json({ ok: true });
};
