import { settings } from '../config.js';
import { ServerLogger as Logger } from '../utils/logger/index.js';

const RETRY_TIMEOUT_MS = 30_000;
const RETRY_INTERVAL_MS = 1_000;

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

/** Poll a request until it returns 200 (or the retry window elapses). */
async function fetchUntil200(
  url: string,
  init: RequestInit,
  label: string
): Promise<Response> {
  const deadline = Date.now() + RETRY_TIMEOUT_MS;
  let lastStatus: number | undefined;
  while (Date.now() < deadline) {
    const res = await fetch(url, init);
    if (res.status === 200) return res;
    lastStatus = res.status;
    await sleep(RETRY_INTERVAL_MS);
  }
  throw new Error(`${label} never returned 200 (last status: ${lastStatus ?? 'unknown'})`);
}

/** A distilled page is either the book-list JSON array or the sign-in form HTML. */
export type DistilledPage = { json?: unknown[]; html: string };

function parseDistilled(text: string): DistilledPage {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { json: parsed, html: text };
  } catch {
    // Not JSON — it's the distilled sign-in/verification form HTML.
  }
  return { html: text };
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
    throw new Error(`Failed to create browser: HTTP ${createRes.status}${detail}`);
  }
  const { browser_id: browserId } = (await createRes.json()) as {
    browser_id: string;
  };

  const deadline = Date.now() + RETRY_TIMEOUT_MS;
  let pageId: string | undefined;
  while (Date.now() < deadline) {
    try {
      const pagesRes = await fetch(buildUrl(`/api/v1/browsers/${browserId}/pages`));
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

export async function navigatePage(
  browserId: string,
  pageId: string,
  url: string
): Promise<void> {
  await fetchUntil200(
    `${buildUrl(`/api/v1/browsers/${browserId}/pages/${pageId}/navigate`)}?url=${encodeURIComponent(url)}`,
    { method: 'POST' },
    `Navigate to ${url}`
  );
}

export async function distillPage(
  browserId: string,
  pageId: string,
  fields?: Record<string, string>
): Promise<void> {
  await fetchUntil200(
    buildUrl(`/api/v1/browsers/${browserId}/pages/${pageId}/distill`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields ?? {}).toString(),
    },
    `Distill ${browserId}/${pageId}`
  );
}

/**
 * Wait for the distilled page to be available, then return it (book-list JSON or
 * sign-in form HTML). One fetch, one body read.
 */
export async function getDistilled(
  browserId: string,
  pageId: string
): Promise<DistilledPage> {
  const res = await fetchUntil200(
    buildUrl(`/api/v1/browsers/${browserId}/pages/${pageId}/distilled`),
    {},
    `Distilled ${browserId}/${pageId}`
  );
  return parseDistilled(await res.text());
}

/**
 * Single, non-blocking read of the distilled page for polling. Returns undefined
 * when it isn't ready yet (non-200) so the caller can report PENDING immediately
 * rather than holding the request open for the full retry window.
 */
export async function readDistilledOnce(
  browserId: string,
  pageId: string
): Promise<DistilledPage | undefined> {
  const res = await fetch(
    buildUrl(`/api/v1/browsers/${browserId}/pages/${pageId}/distilled`)
  );
  if (res.status !== 200) return undefined;
  return parseDistilled(await res.text());
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
