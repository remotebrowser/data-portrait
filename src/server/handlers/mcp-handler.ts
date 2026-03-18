import { Request, Response } from 'express';
import { z } from 'zod';
import { mcpClientManager } from '../mcp-client.js';
import { geolocationService } from '../services/geolocation-service.js';
import { analytics } from '../services/analytics-service.js';
import { finalizeSignin } from '../services/mcp-service.js';
import { settings } from '../config.js';
import { getAppHost } from '../utils/index.js';

const tools: Record<string, string[]> = {
  amazon: ['amazon_get_purchase_history'],
  officedepot: [
    'officedepot_get_order_history',
    'officedepot_get_order_history_details',
  ],
  wayfair: ['wayfair_get_order_history'],
  goodreads: ['goodreads_get_book_list'],
  gofood: ['gofood_get_purchase_history'],
  garmin: ['garmin_get_activities'],
  tokopedia: ['tokopedia_get_purchase_history'],
  shopee: ['shopee_get_purchase_history'],
  doordash: ['doordash_get_orders'],
  youtube: ['youtube_get_watch_history'],
};

const McpResponse = z.object({
  // Auth fields
  url: z.string().optional(),
  link_id: z.string().optional(),
  message: z.string().optional(),
  system_message: z.string().optional(),

  // Data fields
  extract_result: z
    .array(
      z.object({
        name: z.string(),
        parsed: z.boolean(),
        parse_schema: z.record(z.unknown()).nullable(),
        content: z.string(),
      })
    )
    .optional(),
  // goodreads response
  books: z.array(z.record(z.unknown())).optional(),
  // amazon response
  purchases: z.array(z.record(z.unknown())).optional(),
  // officedepot response
  purchase_history: z.array(z.record(z.unknown())).optional(),
  purchase_history_details: z.array(z.record(z.unknown())).optional(),
  doordash_orders: z.array(z.record(z.unknown())).optional(),
  youtube_watch_history: z.array(z.record(z.unknown())).optional(),
});

type PurchaseHistoryResponse = {
  link_id: string;
  hosted_link_url: string;
  content: Array<unknown> | Record<string, unknown>;
};

type PurchaseHistoryDetailsResponse = {
  content: Array<unknown> | Record<string, unknown>;
};

/**
 * Split DoorDash orders when store is an array (new format)
 * If store is not an array, pass through unchanged for backward compatibility
 */
function splitDoorDashOrders(orders: Array<unknown>): Array<unknown> {
  const processedOrders: Array<unknown> = [];

  for (const order of orders) {
    if (typeof order !== 'object' || order === null || !('store' in order)) {
      processedOrders.push(order);
      continue;
    }

    const orderObj = order as Record<string, unknown>;

    // Only process if store is an array (new format)
    if (!Array.isArray(orderObj.store)) {
      processedOrders.push(order); // Pass through unchanged
      continue;
    }

    const store = orderObj.store as Array<unknown>;
    const summary = (orderObj.summary as Array<unknown>) || [];
    const items = (orderObj.items as Array<unknown>) || [];
    const storeUrl = (orderObj.store_url as Array<unknown>) || [];

    // Find max length for splitting
    const maxLength = Math.max(
      store.length,
      summary.length,
      items.length,
      storeUrl.length
    );

    // Extract non-array fields once, reuse for each split order
    const baseOrder: Record<string, unknown> = {};
    const splitKeys = new Set(['store', 'summary', 'items', 'store_url']);
    Object.keys(orderObj).forEach((key) => {
      if (!splitKeys.has(key)) {
        baseOrder[key] = orderObj[key];
      }
    });

    // Split into individual orders
    for (let i = 0; i < maxLength; i++) {
      const splitOrder: Record<string, unknown> = { ...baseOrder };
      // Set array fields at index i (return as strings, not arrays)
      splitOrder.store = store[i] ?? store[0] ?? '';
      splitOrder.summary = summary[i] ?? summary[0] ?? '';
      splitOrder.items = items[i] ?? items[0] ?? '';
      splitOrder.store_url = storeUrl[i] ?? storeUrl[0] ?? '';
      processedOrders.push(splitOrder);
    }
  }

  return processedOrders;
}

export const handlePurchaseHistory = async (req: Request, res: Response) => {
  const { brandId } = req.params;

  const toolName = tools[brandId][0];
  if (!toolName) {
    res.status(400).json({ error: 'Invalid brand name' });
    return;
  }

  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    brandId,
  });
  const result = await mcpClient.callTool({ name: toolName });

  const mcpResponse = McpResponse.parse(result.structuredContent);

  // replace get gatgather hosted-link with our own
  let hosted_link_url = '';
  const appHost = getAppHost(req);
  if (mcpResponse.url) {
    hosted_link_url = mcpResponse.url.replace(settings.GETGATHER_URL, appHost);
  }

  const response: PurchaseHistoryResponse = {
    link_id: mcpResponse.link_id || '',
    hosted_link_url: hosted_link_url,
    content: [],
  };

  // didn't have any content
  if (
    !mcpResponse.extract_result?.[0]?.content &&
    !mcpResponse.books?.length &&
    !mcpResponse.purchases?.length &&
    !mcpResponse.purchase_history?.length &&
    !mcpResponse.doordash_orders?.length &&
    !mcpResponse.youtube_watch_history?.length
  ) {
    res.json(response);
    return;
  }

  const rawContent =
    mcpResponse.extract_result?.[0]?.content ||
    mcpResponse.books ||
    mcpResponse.purchases ||
    mcpResponse.purchase_history ||
    mcpResponse.doordash_orders ||
    mcpResponse.youtube_watch_history;

  if (typeof rawContent === 'string') {
    response.content = JSON.parse(rawContent);
  } else {
    response.content = rawContent || [];
  }

  // Split DoorDash orders if store is an array (new format)
  if (brandId === 'doordash' && Array.isArray(response.content)) {
    response.content = splitDoorDashOrders(response.content);
  }

  // Track successful data retrieval
  if (
    response.content &&
    Array.isArray(response.content) &&
    response.content.length > 0
  ) {
    const clientIp = geolocationService.getClientIp(req);
    analytics.track(req.sessionID, 'data_retrieved_successful', {
      brand_name: brandId,
      data_count: response.content.length,
      purchase_history: response.content,
      client_ip: clientIp,
    });
  }

  res.json(response);
};

export const handlePurchaseHistoryDetails = async (
  req: Request,
  res: Response
) => {
  const { brandId, orderId } = req.params;
  const toolName = tools[brandId][1];
  if (!toolName) {
    res.status(400).json({ error: 'Invalid brand name' });
    return;
  }

  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    brandId,
  });
  const result = await mcpClient.callTool({
    name: tools[brandId][1],
    arguments: { order_id: orderId },
  });

  const mcpResponse = McpResponse.parse(result.structuredContent);

  // if didn't have any content
  if (!mcpResponse.purchase_history_details?.length) {
    res.json({});
    return;
  }

  const response: PurchaseHistoryDetailsResponse = {
    content: [],
  };

  const rawContent = mcpResponse.purchase_history_details;
  if (typeof rawContent === 'string') {
    response.content = JSON.parse(rawContent);
  } else {
    response.content = rawContent || [];
  }

  res.json(response);
};

export const handleMcpPoll = async (req: Request, res: Response) => {
  const { brandId, linkId } = req.params;
  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    brandId,
  });
  const result = await mcpClient.callTool({
    name: 'poll_signin',
    arguments: { link_id: linkId },
  });

  const response = result.structuredContent as { status?: string };
  const isAuthCompleted = response?.status === 'FINISHED';

  // Track successful authentication
  if (isAuthCompleted) {
    analytics.track(req.sessionID, 'connection_successful', {
      link_id: linkId,
      client_ip: clientIp,
    });
  }

  res.json({
    auth_completed: isAuthCompleted,
    link_id: linkId,
  });
};

export const handleDpageUrl = async (req: Request, res: Response) => {
  const { brandId } = req.params;

  const toolName = tools[brandId][0];
  if (!toolName) {
    res.status(400).json({ error: 'Invalid brand name' });
    return;
  }

  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    brandId,
  });
  const result = await mcpClient.callTool({ name: toolName });

  const mcpResponse = result.structuredContent as {
    url: string;
    signin_id: string;
  };

  const appHost = getAppHost(req);
  const hosted_link_url = mcpResponse.url.replace(
    settings.GETGATHER_URL,
    appHost
  );

  const response: PurchaseHistoryResponse = {
    link_id: mcpResponse.signin_id || '',
    hosted_link_url,
    content: [],
  };
  res.json(response);
};

export const handleDpageSigninCheck = async (req: Request, res: Response) => {
  const { brandId, linkId } = req.params;
  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    brandId,
  });
  const result = await mcpClient.callTool({
    name: 'check_signin',
    arguments: { signin_id: linkId },
  });

  const response = result.structuredContent as {
    status?: string;
    result?: unknown;
  };
  const isAuthCompleted = response?.status === 'SUCCESS';

  if (isAuthCompleted) {
    analytics.track(req.sessionID, 'connection_successful', {
      link_id: linkId,
      client_ip: clientIp,
    });
  }

  let content = null;

  if (typeof response.result === 'string') {
    content = JSON.parse(response.result);
  } else {
    content = response.result || [];
  }

  // Split DoorDash orders if store is an array (new format)
  if (brandId === 'doordash' && Array.isArray(content)) {
    content = splitDoorDashOrders(content);
  }

  if (content && Array.isArray(content) && content.length > 0) {
    const clientIp = geolocationService.getClientIp(req);
    analytics.track(req.sessionID, 'data_retrieved_successful', {
      data_count: content.length,
      purchase_history: content,
      client_ip: clientIp,
    });
  }

  if (isAuthCompleted) {
    finalizeSignin({
      sessionId: req.sessionID,
      clientIp,
      brandId,
      signinId: linkId,
    });
  }

  res.json({
    auth_completed: isAuthCompleted,
    link_id: linkId,
    content,
  });
};
