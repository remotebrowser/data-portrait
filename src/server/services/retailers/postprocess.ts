/** Retailer-specific fixups applied after pattern conversion. */

function splitDoorDashOrders(orders: Array<unknown>): Array<unknown> {
  const processedOrders: Array<unknown> = [];

  for (const order of orders) {
    if (typeof order !== 'object' || order === null || !('store' in order)) {
      processedOrders.push(order);
      continue;
    }

    const orderObj = order as Record<string, unknown>;
    if (!Array.isArray(orderObj.store)) {
      processedOrders.push(order);
      continue;
    }

    const store = orderObj.store;
    const summary = Array.isArray(orderObj.summary) ? orderObj.summary : [];
    const items = Array.isArray(orderObj.items) ? orderObj.items : [];
    const storeUrl = Array.isArray(orderObj.store_url)
      ? orderObj.store_url
      : [];
    const maxLength = Math.max(
      store.length,
      summary.length,
      items.length,
      storeUrl.length
    );

    const baseOrder: Record<string, unknown> = {};
    const splitKeys = new Set(['store', 'summary', 'items', 'store_url']);
    for (const key of Object.keys(orderObj)) {
      if (!splitKeys.has(key)) baseOrder[key] = orderObj[key];
    }

    for (let index = 0; index < maxLength; index++) {
      processedOrders.push({
        ...baseOrder,
        store: store[index] ?? store[0] ?? '',
        summary: summary[index] ?? summary[0] ?? '',
        items: items[index] ?? items[0] ?? '',
        store_url: storeUrl[index] ?? storeUrl[0] ?? '',
      });
    }
  }

  return processedOrders;
}

const POSTPROCESS: Record<string, (rows: Array<unknown>) => Array<unknown>> = {
  doordash: splitDoorDashOrders,
};

export function postprocessDistilled(
  brandId: string,
  rows: Array<unknown>
): Array<unknown> {
  return POSTPROCESS[brandId]?.(rows) ?? rows;
}
