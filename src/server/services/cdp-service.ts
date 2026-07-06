import { chromium, type Browser } from 'playwright-core';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { settings } from '../config.js';

const GOODREADS_ORIGIN = 'https://www.goodreads.com';
const GOODREADS_BOOK_LIST_URL = `${GOODREADS_ORIGIN}/review/list?ref=nav_mybooks&view=table`;

// How long to wait for the review table to appear after navigation.
const BOOK_LIST_SELECTOR_TIMEOUT_MS = 30_000;

/**
 * Book record extracted from the Goodreads review list. Keys mirror the
 * mcp-getgather distillation pattern (getgather/mcp/patterns/goodreads-booklist.json)
 * so the result is a drop-in replacement for the `goodreads_book_list` tool output.
 */
export interface GoodreadsBook {
  title: string | null;
  author: string | null;
  rating: string | null;
  url: string | null;
  cover: string | null;
  shelf: string | null;
  added_date: string | null;
}

/**
 * Derive the CDP WebSocket base from the (http/https) Chrome Fleet URL.
 * `https://host` -> `wss://host`, `http://host` -> `ws://host`.
 */
function toCdpWebSocketBase(cdpUrl: string): string {
  return cdpUrl.replace(/^http(s?):\/\//, 'ws$1://').replace(/\/+$/, '');
}

/**
 * Build the WebSocket handshake headers, mirroring the MCP client
 * (src/server/mcp-client.ts). The `/cdp/{browser_id}` route is not behind MCP
 * auth, but an upstream proxy may still require these, so we always send them.
 */
function buildCdpHeaders(sessionId: string, clientIp: string): Record<string, string> {
  const headers: Record<string, string> = {
    'x-getgather-custom-app': 'data-portrait',
    'x-origin-ip': clientIp,
  };

  if (settings.GETGATHER_APP_KEY) {
    headers['Authorization'] = `Bearer ${settings.GETGATHER_APP_KEY}_${sessionId}`;
  }

  return headers;
}

/**
 * In-page scraper. Runs inside the authenticated Goodreads tab (via
 * page.evaluate) and replicates the columns from
 * getgather/mcp/patterns/goodreads-booklist.json.
 *
 * NOTE: this is built as a plain string, not a function reference, on purpose.
 * tsx/esbuild rewrites named functions with a `__name` keepNames helper; when
 * Playwright serializes a function to run in the browser, that helper is
 * undefined there (`ReferenceError: __name is not defined`). A string is opaque
 * to esbuild, so it runs verbatim in the page.
 */
function buildScraperScript(origin: string): string {
  return `
    (() => {
      const origin = ${JSON.stringify(origin)};
      const text = (el) => (el ? (el.textContent || '').trim() || null : null);
      const attr = (el, name) => {
        if (!el) return null;
        const value = el.getAttribute(name);
        return value ? value.trim() : null;
      };
      const rows = Array.from(document.querySelectorAll('tr.review'));
      return rows.map((row) => {
        const rawUrl = attr(row.querySelector('td.cover a'), 'href');
        let url = rawUrl;
        if (rawUrl) {
          try { url = new URL(rawUrl, origin).href; } catch (e) { url = rawUrl; }
        }
        return {
          title: attr(row.querySelector('td.title > div > a'), 'title'),
          author: text(row.querySelector('td.author > div > a')),
          rating: text(row.querySelector('td.avg_rating > div')),
          url: url,
          cover: attr(row.querySelector('td.cover img'), 'src'),
          shelf: text(row.querySelector('td.shelves a.shelfLink')),
          added_date: attr(row.querySelector('td.date_added span'), 'title'),
        };
      });
    })()
  `;
}

/**
 * Attach to the already-authenticated remote browser (identified by the
 * browser_id embedded in the sign-in id) over CDP and extract the Goodreads
 * book list directly, rather than round-tripping through the MCP tool.
 *
 * Throws on any failure — callers should surface the error (no silent fallback).
 */
export async function extractGoodreadsViaCDP({
  cdpUrl,
  signinId,
  sessionId,
  clientIp,
}: {
  cdpUrl: string;
  signinId: string;
  sessionId: string;
  clientIp: string;
}): Promise<GoodreadsBook[]> {
  // SignInId = "{browser_id}--{target_id}--{mcp_session_id}"
  // (mcp-getgather/getgather/mcp/dpage.py). We only need browser_id here.
  const browserId = signinId.split('--')[0];
  if (!browserId) {
    throw new Error(`Cannot derive browser_id from signin_id: ${signinId}`);
  }

  const wsUrl = `${toCdpWebSocketBase(cdpUrl)}/cdp/${browserId}`;
  const headers = buildCdpHeaders(sessionId, clientIp);

  Logger.info('Extracting Goodreads book list via CDP', {
    component: 'cdp-service',
    operation: 'extract-goodreads',
    brandId: 'goodreads',
    signinId,
    browserSessionId: browserId,
    wsUrl,
  });

  let browser: Browser | null = null;
  try {
    browser = await chromium.connectOverCDP(wsUrl, { headers });

    // Reuse the existing (authenticated) context; a new tab shares its cookies.
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error('No browser context available on the remote browser');
    }

    // mcp-getgather's CDP proxy namespaces target ids as `browser_id@target_id`,
    // which breaks Playwright's target tracking on `newPage()`. The authenticated
    // sign-in browser always has a page open, so reuse it and navigate that tab
    // (cookies are context-level, so any page in the context is authenticated).
    const existingPages = context.pages();
    const page =
      existingPages.length > 0 ? existingPages[0] : await context.newPage();
    try {
      await page.goto(GOODREADS_BOOK_LIST_URL, { waitUntil: 'domcontentloaded' });

      try {
        await page.waitForSelector('tr.review', {
          timeout: BOOK_LIST_SELECTOR_TIMEOUT_MS,
        });
      } catch {
        // No rows rendered — treat as an empty (but valid) book list.
        Logger.warn('No Goodreads review rows found', {
          component: 'cdp-service',
          operation: 'extract-goodreads',
          browserSessionId: browserId,
        });
        return [];
      }

      const books = (await page.evaluate(
        buildScraperScript(GOODREADS_ORIGIN)
      )) as GoodreadsBook[];

      Logger.info('Goodreads book list extracted via CDP', {
        component: 'cdp-service',
        operation: 'extract-goodreads',
        browserSessionId: browserId,
        bookCount: books.length,
      });

      return books;
    } finally {
      await page.close().catch(() => {});
    }
  } catch (error) {
    Logger.error('CDP extraction failed', error as Error, {
      component: 'cdp-service',
      operation: 'extract-goodreads',
      browserSessionId: browserId,
      wsUrl,
    });
    throw error;
  } finally {
    // For connectOverCDP, close() disconnects the CDP session without
    // terminating the remote browser, so finalize_signin still owns teardown.
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
