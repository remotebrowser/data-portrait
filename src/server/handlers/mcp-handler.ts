import { Request, Response } from 'express';
import { z } from 'zod';
import { mcpClientManager } from '../mcp-client.js';
import { geolocationService } from '../services/geolocation-service.js';
import { analytics } from '../services/analytics-service.js';
import { finalizeSignin } from '../services/mcp-service.js';
import { settings } from '../config.js';
import { getAppHost } from '../utils/index.js';
import { ServerLogger as Logger } from '../utils/logger/index.js';

interface BrandTool {
  toolName: string;
  resultKey: string;
  detailsToolName?: string;
}

const brandTools: Record<string, BrandTool> = {
  amazon: { toolName: 'amazon_get_purchase_history', resultKey: 'amazon_purchase_history' },
  officedepot: { toolName: 'officedepot_get_order_history', resultKey: 'officedepot_order_history', detailsToolName: 'officedepot_get_order_history_details' },
  wayfair: { toolName: 'wayfair_get_order_history', resultKey: 'wayfair_order_history' },
  goodreads: { toolName: 'goodreads_get_book_list', resultKey: 'goodreads_book_list' },
  gofood: { toolName: 'gofood_get_purchase_history', resultKey: 'gofood_purchase_history' },
  shopee: { toolName: 'shopee_get_purchase_history', resultKey: 'shopee_purchase_history' },
  doordash: { toolName: 'doordash_get_orders', resultKey: 'doordash_orders' },
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

  const brand = brandTools[brandId];
  if (!brand) {
    res.status(400).json({ error: 'Invalid brand name' });
    return;
  }

  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    brandId,
  });
  const result = await mcpClient.callTool({ name: brand.toolName });

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

  const rawContent = sc?.[brand.resultKey];
  let content: unknown[] = [];
  if (rawContent) {
    content =
      typeof rawContent === 'string' ? JSON.parse(rawContent) : (rawContent as unknown[]);
  }

  if (brandId === 'doordash' && Array.isArray(content)) {
    content = splitDoorDashOrders(content);
  }

  if (content.length > 0) {
    analytics.track(req.sessionID, 'data_retrieved_successful', {
      brand_name: brandId,
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
  const { brandId, orderId } = req.params;
  const brand = brandTools[brandId];
  if (!brand?.detailsToolName) {
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
    name: brand.detailsToolName,
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

  const brand = brandTools[brandId];
  if (!brand) {
    res.status(400).json({ error: 'Invalid brand name' });
    return;
  }
  const toolName = brand.toolName;

  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    brandId,
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
  const rawContent = mcpResponse[brand.resultKey];

  let content: unknown[] = [];
  if (rawContent) {
    content =
      typeof rawContent === 'string' ? JSON.parse(rawContent as string) : (rawContent as unknown[]);
  }
  if (brandId === 'doordash' && Array.isArray(content)) {
    content = splitDoorDashOrders(content);
  }

  res.json({ link_id: '', hosted_link_url: '', content });
};

export const handleDpageSigninCheck = async (req: Request, res: Response) => {
  const { brandId, linkId } = req.params;
  const clientIp = geolocationService.getClientIp(req);
  const mcpClient = await mcpClientManager.get({
    sessionId: req.sessionID,
    clientIp,
    brandId,
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

  // Sign-in complete — call the brand tool again to fetch data
  const brand = brandTools[brandId];
  let content: unknown[] | null = null;
  let dataFetchOk = false;

  if (brand) {
    try {
      const dataResult = await mcpClient.callTool({ name: brand.toolName }, 0);
      Logger.debug('Brand tool response', {
        component: 'mcp-handler',
        operation: 'dpage-signin-check',
        brandId,
        isError: dataResult.isError,
        resultKey: brand.resultKey,
        structuredContentKeys: dataResult.structuredContent
          ? Object.keys(dataResult.structuredContent as Record<string, unknown>)
          : null,
      });

      if (!dataResult.isError && dataResult.structuredContent) {
        const sc = dataResult.structuredContent as Record<string, unknown>;
        const rawContent = sc[brand.resultKey];

        if (rawContent) {
          content =
            typeof rawContent === 'string'
              ? JSON.parse(rawContent)
              : (rawContent as unknown[]);
          dataFetchOk = true;
        }

        if (brandId === 'doordash' && Array.isArray(content)) {
          content = splitDoorDashOrders(content);
        }
      }
    } catch (err) {
      Logger.warn('Brand tool call failed after signin', {
        component: 'mcp-handler',
        operation: 'dpage-signin-check',
        brandId,
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
      brandId,
      signinId: linkId,
    });
  }

  res.json({
    auth_completed: true,
    link_id: linkId,
    content,
  });
};
