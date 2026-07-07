import { parse, type HTMLElement } from 'node-html-parser';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { settings } from '../config.js';

const GOODREADS_ORIGIN = 'https://www.goodreads.com';
const GOODREADS_BOOK_LIST_URL = `${GOODREADS_ORIGIN}/review/list?ref=nav_mybooks&view=table`;

// navigate() doesn't await load, so poll /html until the review rows appear.
const HTML_POLL_ATTEMPTS = 4;
const HTML_POLL_DELAY_MS = 2000;

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A sign-in id is "{browser_id}--{target_id}--{mcp_session_id}"
 * (mcp-getgather/getgather/mcp/dpage.py); we only need the browser_id.
 */
export function browserIdFromSigninId(signinId: string): string {
  const browserId = signinId.split('--')[0];
  if (!browserId) {
    throw new Error(`Cannot derive browser_id from signin_id: ${signinId}`);
  }
  return browserId;
}

/**
 * Build request headers, mirroring the MCP client (src/server/mcp-client.ts).
 * The page API routes are not behind MCP auth, but an upstream proxy may still
 * require these, so we always send them.
 */
function buildHeaders(sessionId: string, clientIp: string): Record<string, string> {
  const headers: Record<string, string> = {
    'x-getgather-custom-app': 'data-portrait',
    'x-origin-ip': clientIp,
  };
  if (settings.GETGATHER_APP_KEY) {
    headers['Authorization'] = `Bearer ${settings.GETGATHER_APP_KEY}_${sessionId}`;
  }
  return headers;
}

const text = (el: HTMLElement | null): string | null =>
  el?.text.trim() || null;

const attr = (el: HTMLElement | null, name: string): string | null =>
  el?.getAttribute(name)?.trim() || null;

/**
 * Parse the Goodreads review-list HTML into book records, replicating the
 * columns from getgather/mcp/patterns/goodreads-booklist.json.
 */
function parseBookList(html: string): GoodreadsBook[] {
  const root = parse(html);
  return root.querySelectorAll('tr.review').map((row): GoodreadsBook => {
    const rawUrl = attr(row.querySelector('td.cover a'), 'href');
    let url = rawUrl;
    if (rawUrl) {
      try {
        url = new URL(rawUrl, GOODREADS_ORIGIN).href;
      } catch {
        // Keep the raw (relative) href if it can't be resolved.
      }
    }
    return {
      title: attr(row.querySelector('td.title > div > a'), 'title'),
      author: text(row.querySelector('td.author > div > a')),
      rating: text(row.querySelector('td.avg_rating > div')),
      url,
      cover: attr(row.querySelector('td.cover img'), 'src'),
      shelf: text(row.querySelector('td.shelves a.shelfLink')),
      added_date: attr(row.querySelector('td.date_added span'), 'title'),
    };
  });
}

async function fetchText(
  url: string,
  headers: Record<string, string>
): Promise<string> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * Extract the Goodreads book list by driving the authenticated remote browser
 * through mcp-getgather's page API (list pages -> navigate -> read HTML), then
 * parsing the HTML here. Sign-in itself stays on mcp-getgather.
 *
 * Throws on any failure — callers should surface the error (no silent fallback).
 */
export async function extractGoodreads({
  baseUrl,
  signinId,
  sessionId,
  clientIp,
}: {
  baseUrl: string;
  signinId: string;
  sessionId: string;
  clientIp: string;
}): Promise<GoodreadsBook[]> {
  const browserId = browserIdFromSigninId(signinId);
  const base = baseUrl.replace(/\/+$/, '');
  const headers = buildHeaders(sessionId, clientIp);
  const browsersBase = `${base}/api/v1/browsers/${encodeURIComponent(browserId)}`;

  Logger.info('Extracting Goodreads book list', {
    component: 'goodreads-service',
    operation: 'extract-goodreads',
    brandId: 'goodreads',
    signinId,
    browserSessionId: browserId,
    baseUrl: base,
  });

  // 1. List pages and pick the authenticated tab.
  const pagesRaw = await fetchText(`${browsersBase}/pages`, headers);
  const pageIds = JSON.parse(pagesRaw) as string[];
  const pageId = pageIds?.[0];
  if (!pageId) {
    throw new Error(`No pages available on remote browser ${browserId}`);
  }
  const pageBase = `${browsersBase}/pages/${encodeURIComponent(pageId)}`;

  // 2. Navigate that tab to the review list (fire-and-forget; no load wait).
  await fetchText(
    `${pageBase}/navigate?url=${encodeURIComponent(GOODREADS_BOOK_LIST_URL)}`,
    headers
  );

  // 3. Poll the page HTML until the review rows render, then parse.
  let books: GoodreadsBook[] = [];
  for (let attempt = 1; attempt <= HTML_POLL_ATTEMPTS; attempt++) {
    const html = await fetchText(`${pageBase}/html`, headers);
    // Cheap substring check before building a DOM over the full ~268KB page;
    // early poll attempts usually have no rows yet.
    if (html.includes('class="review"')) {
      books = parseBookList(html);
      if (books.length > 0) {
        break;
      }
    }
    if (attempt < HTML_POLL_ATTEMPTS) {
      await sleep(HTML_POLL_DELAY_MS);
    }
  }

  Logger.info('Goodreads book list extracted', {
    component: 'goodreads-service',
    operation: 'extract-goodreads',
    browserSessionId: browserId,
    pageId,
    bookCount: books.length,
  });

  return books;
}
