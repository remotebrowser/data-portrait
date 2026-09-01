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

const DPAGE_CSS = '/dpage.css';
const DPAGE_JS = '/dpage-signin.js';

interface DpageState {
  html?: string;
  json?: Record<string, string>[];
}
const dpageStates = new Map<string, DpageState>();

// A redirect or slow page may not match at first. Try for up to 10 seconds.
const DISTILL_RETRY_ATTEMPTS = 10;
const DISTILL_RETRY_INTERVAL_MS = 1_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

// A GET request cannot redirect to POST. Submit a form instead.
function redirect(action: string): string {
  return loadingPage(
    `<form id="redirect" action="${action}" method="post"></form>
    <script>setTimeout(() => document.getElementById('redirect').submit(), 3000);</script>`
  );
}

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
      // The page may change during a check. Try again on the new page.
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

export const handleGoodreadsConnect = async (req: Request, res: Response) => {
  let browserId: string | undefined;
  let pageId: string | undefined;
  let browser: Awaited<ReturnType<typeof connectBrowser>> | undefined;
  let connected = false;
  try {
    const headers = browserCreateHeaders(req);
    browserId = await prepareNewBrowser(headers);

    browser = await connectBrowser(browserId);
    const target = await openPage(browser);
    const page = target.page;
    pageId = target.pageId;
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

    connected = true;
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
    if (!connected && browserId) {
      if (pageId) dpageStates.delete(`${browserId}/${pageId}`);
      await deleteBrowser(browserId);
    }
  }
};

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
    const { page } = await openPage(browser, pageId);

    if (Object.keys(fields).length > 0 && state.html) {
      await applyFields(page, state.html, fields);
    }

    const next = await distillStep(page);
    dpageStates.set(dpageKey, next);

    if (next.json) {
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
