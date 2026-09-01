import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import type { Page } from 'playwright';
import { ServerLogger as Logger } from './utils/logger/index.js';

export const patternsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'patterns'
);

export const parse = (html: string) => parseHTML(html).document;

export interface PatternEntry {
  name: string;
  pattern: ReturnType<typeof parse>;
}

export interface DistillationResult {
  name: string;
  priority: number;
  distilled: string;
  /** Selectors to click after this pattern matches. */
  autoclicks?: string[];
}

/** Load a new copy of each pattern for every check. */
export const loadPatterns = (): PatternEntry[] =>
  readdirSync(patternsDir)
    .sort()
    .map((file) => path.join(patternsDir, file))
    .filter((name) => {
      const st = statSync(name);
      return st && !st.isDirectory();
    })
    .filter((name) => name.endsWith('.html'))
    .map((name) => {
      const content = readFileSync(name, 'utf-8');
      const pattern = parse(content);
      return { name, pattern };
    });

const isLocal = (hostname?: string): boolean =>
  hostname
    ? hostname.includes('localhost') || hostname.includes('127.0.0.1')
    : false;

const matchDomain = (hostname: string, domain?: string | null): boolean =>
  domain ? hostname.toLowerCase().includes(domain.toLowerCase()) : true;

export const distill = async (
  hostname: string,
  patterns: PatternEntry[],
  page: Page
): Promise<DistillationResult | undefined> => {
  const results: DistillationResult[] = [];

  for (const { name, pattern } of patterns) {
    const root = pattern.querySelector('html');
    const priorityAttr = root ? root.getAttribute('rb-priority') : null;
    const priority = priorityAttr ? parseInt(priorityAttr, 10) : -1;
    const domain = root?.getAttribute('rb-domain');

    if (!isLocal(hostname)) {
      if (!matchDomain(hostname, domain)) {
        continue;
      }
    }

    Logger.debug(`Checking pattern ${name} (priority ${priority})`, {
      component: 'distill',
    });

    const targets = pattern.querySelectorAll('[rb-match], [rb-match-html]');
    if (targets.length === 0) continue;

    let found = true;
    let matchCount = 0;
    for (const target of targets) {
      const isHtml = target.hasAttribute('rb-match-html');
      const attr = isHtml ? 'rb-match-html' : 'rb-match';
      const selector = target.getAttribute(attr);
      if (!selector) continue;

      const locator = page.locator(selector);
      const count = await locator.count();
      let el: ReturnType<typeof locator.nth> | null = null;
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const candidate = locator.nth(i);
          if (await candidate.isVisible()) {
            el = candidate;
            break;
          }
        }
      }

      if (el) {
        const [text, innerHtml, value] = await Promise.all([
          el.textContent().then((t) => (t ?? '').trim()),
          el.innerHTML(),
          el.inputValue().catch(() => null as string | null),
        ]);

        if (isHtml) {
          target.innerHTML = innerHtml;
        } else {
          target.textContent = text;
          if (value !== null) {
            target.setAttribute('value', value);
          }
        }
        matchCount++;
      } else {
        const optional = target.hasAttribute('rb-optional');
        if (!optional) {
          found = false;
        }
      }
    }

    if (found && matchCount > 0) {
      const distilled = pattern.documentElement.outerHTML;
      const autoclicks = (
        Array.from(pattern.querySelectorAll('[rb-autoclick]')) as {
          getAttribute(name: string): string | null;
        }[]
      )
        .map((el) => el.getAttribute('rb-match'))
        .filter((selector): selector is string => !!selector);
      results.push({ name, priority, distilled, autoclicks });
    }
  }

  results.sort((a, b) => a.priority - b.priority);
  if (results.length === 0) {
    Logger.warn('No matching pattern found', {
      component: 'distill',
      hostname,
    });
    return undefined;
  }

  const best = results[0];
  Logger.info(`Best match: ${best.name} (priority ${best.priority})`, {
    component: 'distill',
    hostname,
  });

  // Click these elements now. The next check reads the new page.
  for (const selector of best.autoclicks ?? []) {
    await page
      .locator(selector)
      .first()
      .click({ timeout: 10_000 })
      .catch((err) => {
        Logger.warn(`Autoclick failed for ${selector}`, {
          component: 'distill',
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  return best;
};

interface ConvertibleElement {
  querySelector(selectors: string): ConvertibleElement | null;
  querySelectorAll(selectors: string): Iterable<ConvertibleElement>;
  getAttribute(name: string): string | null;
  textContent?: string | null;
}

const extractValue = (item: ConvertibleElement, attribute?: string): string => {
  if (attribute) {
    return (item.getAttribute(attribute) ?? '').trim();
  }
  return item?.textContent?.trim() ?? '';
};

export const convert = async (
  distilled: string,
  patternsDir: string
): Promise<Record<string, string>[]> => {
  const document = parse(distilled);

  const stopEl = document.querySelector('[rb-stop][rb-convert]');
  if (!stopEl) {
    Logger.debug('No rb-convert attribute found in distilled content', {
      component: 'distill',
    });
    return [];
  }

  const convertFile = stopEl.getAttribute('rb-convert');
  if (!convertFile) return [];

  const jsonPath = path.join(patternsDir, convertFile);
  let converter: {
    rows?: string;
    columns?: {
      name: string;
      selector: string;
      attribute?: string;
      kind?: string;
    }[];
  };
  try {
    const content = readFileSync(jsonPath, 'utf-8');
    converter = JSON.parse(content);
  } catch (err) {
    Logger.error(`Failed to load convert config ${convertFile}`, err as Error, {
      component: 'distill',
    });
    return [];
  }

  if (!converter.rows || !converter.columns) {
    Logger.warn(`Invalid convert config in ${convertFile}`, {
      component: 'distill',
    });
    return [];
  }

  const rows = Array.from(
    document.querySelectorAll(converter.rows) as Iterable<ConvertibleElement>
  );
  Logger.info(
    `Converting using selector "${converter.rows}": ${rows.length} rows`,
    { component: 'distill', convertFile }
  );

  const converted: Record<string, string>[] = [];
  for (const el of rows) {
    const kv: Record<string, string> = {};
    for (const col of converter.columns) {
      if (col.kind === 'list') {
        const items = el.querySelectorAll(col.selector);
        kv[col.name] = Array.from(items)
          .map((item) => extractValue(item, col.attribute))
          .join(', ');
      } else {
        const item = el.querySelector(col.selector);
        if (item) {
          kv[col.name] = extractValue(item, col.attribute);
        }
      }
    }
    if (Object.keys(kv).length > 0) {
      converted.push(kv);
    }
  }

  Logger.info(`Converted ${converted.length} entries`, {
    component: 'distill',
    convertFile,
  });
  return converted;
};
