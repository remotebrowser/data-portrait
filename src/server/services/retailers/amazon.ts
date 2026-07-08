import { parse, type HTMLElement } from 'node-html-parser';
import type { RetailerExtractor } from './index.js';

const ORIGIN = 'https://www.amazon.com';

/**
 * Order record from Amazon's order history. Keys match the source paths the
 * client's config/amazon.json `dataTransform` reads (order_date, order_total,
 * order_id, product_names, image_urls). Selectors ported from mcp-getgather's
 * distill pattern (getgather/mcp/patterns/amazon-orders.json).
 */
export type AmazonOrder = {
  order_date: string | null;
  order_total: string | null;
  order_id: string | null;
  product_names: string[];
  image_urls: string[];
};

const text = (el: HTMLElement | null): string | null => el?.text.trim() || null;

const list = (row: HTMLElement, selector: string, attribute?: string): string[] =>
  row
    .querySelectorAll(selector)
    .map((el) => (attribute ? el.getAttribute(attribute) : el.text)?.trim() || null)
    .filter((v): v is string => !!v);

function parseOrders(html: string): AmazonOrder[] {
  const root = parse(html);
  return root
    .querySelectorAll('div.order-card.js-order-card')
    .map((row): AmazonOrder => ({
      order_date: text(
        row.querySelector(
          'div.a-box-inner h5 div.a-span3 div:nth-child(2), div.a-box-inner div.a-span3 div:nth-child(2)'
        )
      ),
      order_total: text(
        row.querySelector(
          'div.a-box-inner h5 div.a-span2 div:nth-child(2), div.a-box-inner div.a-span2 div:nth-child(2)'
        )
      ),
      order_id: text(row.querySelector('div.yohtmlc-order-id span:nth-child(2)')),
      product_names: list(row, 'div.yohtmlc-product-title a'),
      image_urls: list(
        row,
        'div.product-image img, .item-view-left-col-inner img',
        'src'
      ),
    }));
}

export const amazon: RetailerExtractor<AmazonOrder> = {
  brandId: 'amazon',
  url: `${ORIGIN}/your-orders/orders`,
  parse: parseOrders,
  hasData: (html) => html.includes('js-order-card'),
};
