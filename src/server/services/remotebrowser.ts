import { settings } from '../config.js';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';

const RETRY_TIMEOUT_MS = 30_000;
const RETRY_INTERVAL_MS = 1_000;
const NAV_RETRY_ATTEMPTS = RETRY_TIMEOUT_MS / RETRY_INTERVAL_MS;

function baseUrl(): string {
  return settings.GETGATHER_URL.replace(/\/+$/, '');
}

function buildUrl(path: string): string {
  return `${baseUrl()}${path}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toFetchHeaders(
  headers: Record<string, string | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  );
}

export async function prepareNewBrowser(
  headers: Record<string, string | undefined> = {}
): Promise<{ browserId: string; pageId: string }> {
  const fetchHeaders = toFetchHeaders(headers);

  const createRes = await fetch(buildUrl(`/api/v1/browsers`), {
    method: 'POST',
    headers: fetchHeaders,
  });
  if (createRes.status !== 200) {
    const errorBody = await createRes.text().catch(() => '');
    const detail = errorBody ? `: ${errorBody}` : '';
    throw new Error(
      `Failed to create browser: HTTP ${createRes.status}${detail}`
    );
  }
  const { browser_id: browserId } = (await createRes.json()) as {
    browser_id: string;
  };

  const deadline = Date.now() + RETRY_TIMEOUT_MS;
  let pageId: string | undefined;
  while (Date.now() < deadline) {
    try {
      const pagesRes = await fetch(
        buildUrl(`/api/v1/browsers/${browserId}/pages`)
      );
      if (pagesRes.ok) {
        const pageIds = (await pagesRes.json()) as unknown[];
        if (Array.isArray(pageIds) && pageIds.length > 0) {
          pageId = String(pageIds[0]);
          break;
        }
      }
    } catch (error) {
      Logger.debug('Fetching pages failed, retrying', {
        component: 'remotebrowser',
        browserSessionId: browserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(RETRY_INTERVAL_MS);
  }

  if (!pageId) {
    await deleteBrowser(browserId);
    throw new Error(`Browser ${browserId} never exposed any pages`);
  }

  return { browserId, pageId };
}

/**
 * The CDP WebSocket URL of a browser, derived from the REST base URL
 * (http(s):// becomes ws(s)://).
 */
function getCdpUrl(browserId: string): string {
  const base = baseUrl();
  const protocol = base.startsWith('https') ? 'wss' : 'ws';
  return `${base.replace(/^https?:\/\//, `${protocol}://`)}/api/v1/browsers/${browserId}/cdp`;
}

export async function connectBrowser(browserId: string): Promise<Browser> {
  return await chromium.connectOverCDP(getCdpUrl(browserId));
}

/** Resolves the page the browser opened on startup, or creates one. */
export async function openPage(browser: Browser): Promise<Page> {
  const [context] = browser.contexts();
  const pages = context.pages();
  return pages.length > 0 ? pages[0] : await context.newPage();
}

export async function navigatePage(page: Page, url: string): Promise<void> {
  for (let attempt = 0; attempt < NAV_RETRY_ATTEMPTS; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'load' });
      return;
    } catch (error) {
      Logger.warn('Navigation attempt failed, retrying', {
        component: 'remotebrowser',
        attempt,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(RETRY_INTERVAL_MS);
  }
  throw new Error(`Failed to navigate to ${url}`);
}

export async function deleteBrowser(browserId: string): Promise<void> {
  try {
    const res = await fetch(buildUrl(`/api/v1/browsers/${browserId}`), {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      Logger.warn('Failed to delete browser', {
        component: 'remotebrowser',
        browserSessionId: browserId,
        status: res.status,
        body: errorBody,
      });
    }
  } catch (error) {
    Logger.warn('Failed to delete browser', {
      component: 'remotebrowser',
      browserSessionId: browserId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
