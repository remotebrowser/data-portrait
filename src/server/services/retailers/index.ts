import { RemoteBrowser } from '../remote-browser.js';
import { ServerLogger as Logger } from '../../utils/logger/index.js';
import { goodreads } from './goodreads.js';

// navigate() doesn't await load, so poll the page until its data renders.
const POLL_ATTEMPTS = 4;
const POLL_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Everything that differs per retailer: where to open, and how to read the page
 * into raw records. The client's per-brand `dataTransform` maps those records
 * into PurchaseHistory, so `parse` only needs to return retailer-shaped rows.
 */
export interface RetailerExtractor<T = Record<string, unknown>> {
  brandId: string;
  /** Page to open in the signed-in browser. */
  url: string;
  /** Retailer-specific selectors -> raw records. */
  parse: (html: string) => T[];
  /** Cheap "have the rows rendered yet?" guard, checked before the full parse. */
  hasData?: (html: string) => boolean;
}

/** Registry of retailers that extract their own data via the remote browser. */
export const EXTRACTORS: Record<string, RetailerExtractor> = {
  goodreads,
};

/** A sign-in id is "{browser_id}--{target_id}--{mcp_session_id}"; we need browser_id. */
export function browserIdFromSigninId(signinId: string): string {
  const browserId = signinId.split('--')[0];
  if (!browserId) {
    throw new Error(`Cannot derive browser_id from signin_id: ${signinId}`);
  }
  return browserId;
}

export interface ExtractContext {
  baseUrl: string;
  signinId: string;
  sessionId: string;
  clientIp: string;
}

/**
 * Generic runner: drive the already-signed-in remote browser to a retailer's
 * page and read it. Retailer-agnostic — only the passed extractor knows the
 * retailer. Throws on transport failure (callers surface the error).
 */
export async function extractRetailer(
  ctx: ExtractContext,
  extractor: RetailerExtractor
): Promise<unknown[]> {
  const browserId = browserIdFromSigninId(ctx.signinId);
  const rb = new RemoteBrowser(
    ctx.baseUrl,
    RemoteBrowser.headers(ctx.sessionId, ctx.clientIp)
  );
  const page = await rb.browser(browserId).firstPage();

  Logger.info('Extracting retailer data', {
    component: 'retailers',
    operation: 'extract',
    brandId: extractor.brandId,
    browserSessionId: browserId,
    pageId: page.id,
  });

  await page.navigate(extractor.url);

  let rows: unknown[] = [];
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
    const html = await page.html();
    if (!extractor.hasData || extractor.hasData(html)) {
      rows = extractor.parse(html);
      if (rows.length > 0) break;
    }
    if (attempt < POLL_ATTEMPTS) await sleep(POLL_DELAY_MS);
  }

  Logger.info('Retailer data extracted', {
    component: 'retailers',
    operation: 'extract',
    brandId: extractor.brandId,
    browserSessionId: browserId,
    rowCount: rows.length,
  });

  return rows;
}
