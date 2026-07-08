import { settings } from '../config.js';

/**
 * Typed client for getgather's remote-browser REST API (`/api/v1/browsers/...`).
 * Retailer-agnostic: talking to a signed-in remote browser is identical for
 * every brand. getgather's OpenAPI types these responses as `any`, so this is a
 * small hand-written client rather than generated code.
 */
export class RemoteBrowser {
  private readonly base: string;

  constructor(
    baseUrl: string,
    private readonly headers: Record<string, string>
  ) {
    this.base = baseUrl.replace(/\/+$/, '');
  }

  /** Build the getgather request headers used by every call. */
  static headers(sessionId: string, clientIp: string): Record<string, string> {
    const headers: Record<string, string> = {
      'x-getgather-custom-app': 'data-portrait',
      'x-origin-ip': clientIp,
    };
    if (settings.GETGATHER_APP_KEY) {
      headers['Authorization'] = `Bearer ${settings.GETGATHER_APP_KEY}_${sessionId}`;
    }
    return headers;
  }

  async request(
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { ...this.headers, ...(init.headers as Record<string, string>) },
    });
    if (!res.ok) {
      throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${res.statusText}`);
    }
    return res;
  }

  /** POST /api/v1/browsers — start a fresh browser. */
  async create(): Promise<Browser> {
    const res = await this.request('/api/v1/browsers', { method: 'POST' });
    const { browser_id: id } = (await res.json()) as { browser_id: string };
    return new Browser(this, id);
  }

  /** Attach to an existing browser (e.g. the one behind a sign-in id). */
  browser(id: string): Browser {
    return new Browser(this, id);
  }
}

export class Browser {
  constructor(
    private readonly rb: RemoteBrowser,
    readonly id: string
  ) {}

  private get base(): string {
    return `/api/v1/browsers/${encodeURIComponent(this.id)}`;
  }

  /** GET .../pages — the open tab/target ids. */
  async pageIds(): Promise<string[]> {
    const res = await this.rb.request(`${this.base}/pages`);
    const ids = (await res.json()) as string[];
    return Array.isArray(ids) ? ids : [];
  }

  /** The first open tab, or throw if the browser has none. */
  async firstPage(): Promise<Page> {
    const [pageId] = await this.pageIds();
    if (!pageId) {
      throw new Error(`No pages available on remote browser ${this.id}`);
    }
    return new Page(this.rb, this.id, pageId);
  }

  /** DELETE .../{id} — tear down the browser. */
  async close(): Promise<void> {
    await this.rb.request(this.base, { method: 'DELETE' });
  }
}

export class Page {
  constructor(
    private readonly rb: RemoteBrowser,
    readonly browserId: string,
    readonly id: string
  ) {}

  private get base(): string {
    return `/api/v1/browsers/${encodeURIComponent(this.browserId)}/pages/${encodeURIComponent(this.id)}`;
  }

  /** Navigate the tab. getgather fires Page.navigate; it does NOT await load. */
  async navigate(url: string): Promise<void> {
    await this.rb.request(`${this.base}/navigate?url=${encodeURIComponent(url)}`);
  }

  /** GET .../html — the tab's current outer HTML. */
  async html(): Promise<string> {
    return (await this.rb.request(`${this.base}/html`)).text();
  }

  /** POST .../distill — advance getgather's distillation loop (with form fields). */
  async distill(fields: Record<string, string> = {}): Promise<void> {
    await this.rb.request(`${this.base}/distill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });
  }

  /** GET .../distilled — getgather's pattern-distilled JSON for the page. */
  async distilled<T>(): Promise<T> {
    return (await this.rb.request(`${this.base}/distilled`)).json() as Promise<T>;
  }
}
