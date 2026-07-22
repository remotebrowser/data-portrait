import { Request, Response } from 'express';
import { z } from 'zod';
import { mcpClientManager } from '../mcp-client.js';
import { geolocationService } from '../services/geolocation-service.js';
import { analytics } from '../services/analytics-service.js';
import { finalizeSignin } from '../services/mcp-service.js';
import { settings } from '../config.js';
import { getAppHost } from '../utils/index.js';
import { ServerLogger as Logger } from '../utils/logger/index.js';

interface RetailerTool {
  toolName: string;
  resultKey: string;
  detailsToolName?: string;
}

const retailerTools: Record<string, RetailerTool> = {
  amazon: { toolName: 'amazon_get_purchase_history', resultKey: 'amazon_purchase_history' },
  officedepot: { toolName: 'officedepot_get_order_history', resultKey: 'officedepot_order_history', detailsToolName: 'officedepot_get_order_history_details' },
  wayfair: { toolName: 'wayfair_get_order_history', resultKey: 'wayfair_order_history' },
  goodreads: { toolName: 'goodreads_get_book_list', resultKey: 'goodreads_book_list' },
  gofood: { toolName: 'gofood_get_purchase_history', resultKey: 'gofood_purchase_history' },
  garmin: { toolName: 'garmin_get_activities', resultKey: 'garmin_activity_history' },
  tokopedia: { toolName: 'tokopedia_get_purchase_history', resultKey: 'purchase_history' },
  shopee: { toolName: 'shopee_get_purchase_history', resultKey: 'shopee_purchase_history' },
  doordash: { toolName: 'doordash_get_orders', resultKey: 'doordash_orders' },
  youtube: { toolName: 'youtube_get_watch_history', resultKey: 'youtube_watch_history' },
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
  const { retailerId } = req.params;

  const retailer = retailerTools[retailerId];
  if (!retailer) {
    res.status(400).json({ error: 'Invalid retailer name' });
    return;
  }

  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    retailerId,
  });
  const result = await mcpClient.callTool({ name: retailer.toolName });

  const sc = result.structuredContent as Record<string, unknown> | undefined;

  // Check for sign-in redirect
  const url = sc?.url as string | undefined;
  if (url) {
    const appHost = getAppHost(req);
    const hosted_link_url = url.replace(settings.GETGATHER_URL, appHost);
    res.json({
      link_id: (sc?.link_id as string) || '',
      hosted_link_url,
      content: [],
    });
    return;
  }

  const rawContent = sc?.[retailer.resultKey];
  let content: unknown[] = [];
  if (rawContent) {
    content =
      typeof rawContent === 'string' ? JSON.parse(rawContent) : (rawContent as unknown[]);
  }

  if (retailerId === 'doordash' && Array.isArray(content)) {
    content = splitDoorDashOrders(content);
  }

  if (content.length > 0) {
    analytics.track(req.sessionID, 'data_retrieved_successful', {
      brand_name: retailerId,
      data_count: content.length,
      purchase_history: content,
      client_ip: clientIp,
    });
  }

  res.json({ link_id: '', hosted_link_url: '', content });
};

export const handlePurchaseHistoryDetails = async (
  req: Request,
  res: Response
) => {
  const { retailerId, orderId } = req.params;
  const retailer = retailerTools[retailerId];
  if (!retailer?.detailsToolName) {
    res.status(400).json({ error: 'Invalid retailer name' });
    return;
  }

  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    retailerId,
  });
  const result = await mcpClient.callTool({
    name: retailer.detailsToolName,
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
  const { retailerId, linkId } = req.params;
  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    retailerId,
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
  const { retailerId } = req.params;

  const retailer = retailerTools[retailerId];
  if (!retailer) {
    res.status(400).json({ error: 'Invalid retailer name' });
    return;
  }
  const toolName = retailer.toolName;

  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    retailerId,
  });
  const result = await mcpClient.callTool({ name: toolName });

  const mcpResponse = result.structuredContent as
    | Record<string, unknown>
    | undefined;

  // Tool returned an error or no structured content
  if (result.isError || !mcpResponse) {
    res.status(502).json({ error: 'Failed to connect to service' });
    return;
  }

  // Tool returned a sign-in URL
  if (mcpResponse.url && (mcpResponse.url as string).includes('dpage')) {
    const signinId = (mcpResponse.signin_id as string) || '';

    // Store signin ID so subsequent calls reuse the same browser
    if (signinId) {
      mcpClient.setSigninId(signinId);
      await mcpClient.reconnect();
    }

    const mcpUrl = new URL(mcpResponse.url as string);
    const hosted_link_url = mcpUrl.pathname;
    const response: PurchaseHistoryResponse = {
      link_id: signinId,
      hosted_link_url,
      content: [],
    };
    res.json(response);
    return;
  }

  // Tool returned data directly (user already signed in)
  const rawContent = mcpResponse[retailer.resultKey];

  let content: unknown[] = [];
  if (rawContent) {
    content =
      typeof rawContent === 'string' ? JSON.parse(rawContent as string) : (rawContent as unknown[]);
  }
  if (retailerId === 'doordash' && Array.isArray(content)) {
    content = splitDoorDashOrders(content);
  }

  res.json({ link_id: '', hosted_link_url: '', content });
};

export const handleDpageSigninCheck = async (req: Request, res: Response) => {
  const { retailerId, linkId } = req.params;
  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    retailerId,
  });
  const checkResult = await mcpClient.callTool({
    name: 'check_signin',
    arguments: { signin_id: linkId },
  });

  const checkResponse = checkResult.structuredContent as {
    status?: string;
    completed?: boolean;
  };
  const isAuthCompleted = checkResponse?.status === 'SUCCESS';

  if (!isAuthCompleted) {
    res.json({
      auth_completed: false,
      link_id: linkId,
      content: null,
    });
    return;
  }

  // Sign-in complete — call the retailer tool again to fetch data
  const retailer = retailerTools[retailerId];
  let content: unknown[] | null = null;
  let dataFetchOk = false;

  if (retailer) {
    try {
      const dataResult = await mcpClient.callTool({ name: retailer.toolName }, 0);
      Logger.debug('Retailer tool response', {
        component: 'mcp-handler',
        operation: 'dpage-signin-check',
        retailerId,
        isError: dataResult.isError,
        resultKey: retailer.resultKey,
        structuredContentKeys: dataResult.structuredContent
          ? Object.keys(dataResult.structuredContent as Record<string, unknown>)
          : null,
      });

      if (!dataResult.isError && dataResult.structuredContent) {
        const sc = dataResult.structuredContent as Record<string, unknown>;
        const rawContent = sc[retailer.resultKey];

        if (rawContent) {
          content =
            typeof rawContent === 'string'
              ? JSON.parse(rawContent)
              : (rawContent as unknown[]);
          dataFetchOk = true;
        }

        if (retailerId === 'doordash' && Array.isArray(content)) {
          content = splitDoorDashOrders(content);
        }
      }
    } catch (err) {
      Logger.warn('Retailer tool call failed after signin', {
        component: 'mcp-handler',
        operation: 'dpage-signin-check',
        retailerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  analytics.track(req.sessionID, 'connection_successful', {
    link_id: linkId,
    client_ip: clientIp,
  });

  if (content && Array.isArray(content) && content.length > 0) {
    analytics.track(req.sessionID, 'data_retrieved_successful', {
      data_count: content.length,
      purchase_history: content,
      client_ip: clientIp,
    });
  }

  // Only finalize if data was fetched (browser still alive)
  if (dataFetchOk) {
    finalizeSignin({
      sessionId: req.sessionID,
      clientIp,
      retailerId,
      signinId: linkId,
    });
  }

  res.json({
    auth_completed: true,
    link_id: linkId,
    content,
  });
};
