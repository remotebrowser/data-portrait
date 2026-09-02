import { settings } from '../config.js';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';

const RETRY_TIMEOUT_MS = 30_000;
const RETRY_INTERVAL_MS = 1_000;
const NAV_RETRY_ATTEMPTS = RETRY_TIMEOUT_MS / RETRY_INTERVAL_MS;

function baseUrl(): string {
  return settings.REMOTEBROWSER_URL.replace(/\/+$/, '');
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
): Promise<string> {
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
  return browserId;
}

/** Change the HTTP URL to a WebSocket URL for CDP. */
function getCdpUrl(browserId: string): string {
  const base = baseUrl();
  const protocol = base.startsWith('https') ? 'wss' : 'ws';
  return `${base.replace(/^https?:\/\//, `${protocol}://`)}/api/v1/browsers/${browserId}/cdp`;
}

export async function connectBrowser(browserId: string): Promise<Browser> {
  return await chromium.connectOverCDP(getCdpUrl(browserId));
}

/** Find a page by ID. Create one when the browser is empty. */
export async function openPage(
  browser: Browser,
  pageId?: string
): Promise<{ page: Page; pageId: string }> {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      const session = await context.newCDPSession(page);
      try {
        const { targetInfo } = await session.send('Target.getTargetInfo');
        if (!targetInfo) continue;
        if (!pageId || targetInfo.targetId === pageId) {
          return { page, pageId: targetInfo.targetId };
        }
      } finally {
        await session.detach();
      }
    }
  }

  if (pageId) {
    throw new Error(`Page with target ID ${pageId} not found`);
  }

  const [context] = browser.contexts();
  if (!context) throw new Error('Remote browser has no browser context');
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  try {
    const { targetInfo } = await session.send('Target.getTargetInfo');
    if (!targetInfo) throw new Error('Could not resolve new page target ID');
    return { page, pageId: targetInfo.targetId };
  } finally {
    await session.detach();
  }
}

export async function navigatePage(page: Page, url: string): Promise<void> {
  for (let attempt = 0; attempt < NAV_RETRY_ATTEMPTS; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
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
