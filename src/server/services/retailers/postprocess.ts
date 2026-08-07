/**
 * Per-retailer fixups applied to a distilled payload before it reaches the client.
 *
 * Most retailers need none — their distilled rows already map cleanly onto
 * PurchaseHistory via the client's `dataTransform`. This is the escape hatch for
 * the ones whose distill pattern returns a shape the field mappings can't express.
 */

/**
 * DoorDash's distill pattern collects `store`, `store_url`, `summary` and `items`
 * as parallel lists (`kind: "list"`), so one distilled row can cover several
 * stores ordered from at once. Fan those out into one row per store so each shows
 * up as its own order. Rows whose `store` isn't a list pass through untouched.
 */
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

    const store = orderObj.store as Array<unknown>;
    const summary = (orderObj.summary as Array<unknown>) || [];
    const items = (orderObj.items as Array<unknown>) || [];
    const storeUrl = (orderObj.store_url as Array<unknown>) || [];

    const maxLength = Math.max(
      store.length,
      summary.length,
      items.length,
      storeUrl.length
    );

    // Fields outside the parallel lists (e.g. the order date) are shared by every
    // store in the row, so extract them once and reuse.
    const baseOrder: Record<string, unknown> = {};
    const splitKeys = new Set(['store', 'summary', 'items', 'store_url']);
    Object.keys(orderObj).forEach((key) => {
      if (!splitKeys.has(key)) {
        baseOrder[key] = orderObj[key];
      }
    });

    for (let i = 0; i < maxLength; i++) {
      const splitOrder: Record<string, unknown> = { ...baseOrder };
      // Collapse each list to its value at i (a string, not a one-element array).
      splitOrder.store = store[i] ?? store[0] ?? '';
      splitOrder.summary = summary[i] ?? summary[0] ?? '';
      splitOrder.items = items[i] ?? items[0] ?? '';
      splitOrder.store_url = storeUrl[i] ?? storeUrl[0] ?? '';
      processedOrders.push(splitOrder);
    }
  }

  return processedOrders;
}

const POSTPROCESS: Record<string, (rows: Array<unknown>) => Array<unknown>> = {
  doordash: splitDoorDashOrders,
};

/** Apply the retailer's fixup, if it has one. */
export function postprocessDistilled(
  brandId: string,
  rows: Array<unknown>
): Array<unknown> {
  const fixup = POSTPROCESS[brandId];
  return fixup ? fixup(rows) : rows;
}
