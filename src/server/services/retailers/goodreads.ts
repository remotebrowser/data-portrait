import { parse, type HTMLElement } from 'node-html-parser';
import type { RetailerExtractor } from './index.js';

const ORIGIN = 'https://www.goodreads.com';

/**
 * Book record from the Goodreads review list. Keys mirror the mcp-getgather
 * distillation pattern (getgather/mcp/patterns/goodreads-booklist.json) so the
 * result matches the `goodreads_book_list` tool output the client already maps.
 */
export type GoodreadsBook = {
  title: string | null;
  author: string | null;
  rating: string | null;
  url: string | null;
  cover: string | null;
  shelf: string | null;
  added_date: string | null;
};

const text = (el: HTMLElement | null): string | null => el?.text.trim() || null;
const attr = (el: HTMLElement | null, name: string): string | null =>
  el?.getAttribute(name)?.trim() || null;

function parseBookList(html: string): GoodreadsBook[] {
  const root = parse(html);
  return root.querySelectorAll('tr.review').map((row): GoodreadsBook => {
    const rawUrl = attr(row.querySelector('td.cover a'), 'href');
    let url = rawUrl;
    if (rawUrl) {
      try {
        url = new URL(rawUrl, ORIGIN).href;
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

export const goodreads: RetailerExtractor<GoodreadsBook> = {
  brandId: 'goodreads',
  url: `${ORIGIN}/review/list?ref=nav_mybooks&view=table`,
  parse: parseBookList,
  // Cheap guard before building a DOM over the full ~268KB page.
  hasData: (html) => html.includes('class="review"'),
};
