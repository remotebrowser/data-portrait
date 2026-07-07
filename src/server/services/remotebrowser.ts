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
  const endpoint = `/api/v1/browsers/${browserId}/pages/${pageId}/navigate`;
  const deadline = Date.now() + RETRY_TIMEOUT_MS;
  let lastStatus: number | undefined;

  while (Date.now() < deadline) {
    const res = await fetch(`${buildUrl(endpoint)}?url=${encodeURIComponent(url)}`, {
      method: 'POST',
    });
    if (res.status === 200) return;
    lastStatus = res.status;
    await sleep(RETRY_INTERVAL_MS);
  }

  throw new Error(
    `Navigate to ${url} never returned 200 (last status: ${lastStatus ?? 'unknown'})`
  );
}

export async function distillPage(
  browserId: string,
  pageId: string,
  fields?: Record<string, string>
): Promise<void> {
  const endpoint = `/api/v1/browsers/${browserId}/pages/${pageId}/distill`;
  const body = new URLSearchParams(fields ?? {}).toString();
  const deadline = Date.now() + RETRY_TIMEOUT_MS;
  let lastStatus: number | undefined;

  while (Date.now() < deadline) {
    const res = await fetch(buildUrl(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (res.status === 200) return;
    lastStatus = res.status;
    await sleep(RETRY_INTERVAL_MS);
  }

  throw new Error(
    `Distill never returned 200 for ${browserId}/${pageId} (last status: ${lastStatus ?? 'unknown'})`
  );
}

export async function getDistilledJson<T = unknown>(
  browserId: string,
  pageId: string
): Promise<T> {
  const endpoint = `/api/v1/browsers/${browserId}/pages/${pageId}/distilled`;
  const deadline = Date.now() + RETRY_TIMEOUT_MS;
  let lastStatus: number | undefined;

  while (Date.now() < deadline) {
    const res = await fetch(buildUrl(endpoint));
    if (res.status === 200) {
      return (await res.json()) as T;
    }
    lastStatus = res.status;
    await sleep(RETRY_INTERVAL_MS);
  }

  throw new Error(
    `Distilled endpoint never returned 200 for ${browserId}/${pageId} (last status: ${lastStatus ?? 'unknown'})`
  );
}

export async function getDistilledHtml(
  browserId: string,
  pageId: string
): Promise<string> {
  const endpoint = `/api/v1/browsers/${browserId}/pages/${pageId}/distilled`;
  const deadline = Date.now() + RETRY_TIMEOUT_MS;
  let lastStatus: number | undefined;

  while (Date.now() < deadline) {
    const res = await fetch(buildUrl(endpoint));
    if (res.status === 200) {
      return await res.text();
    }
    lastStatus = res.status;
    await sleep(RETRY_INTERVAL_MS);
  }

  throw new Error(
    `Distilled endpoint never returned 200 for ${browserId}/${pageId} (last status: ${lastStatus ?? 'unknown'})`
  );
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
