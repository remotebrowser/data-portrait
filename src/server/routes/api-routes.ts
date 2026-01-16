import { Router } from 'express';
import { handlePortraitGeneration } from '../handlers/portrait-handler.js';
import {
  handlePurchaseHistory,
  handleMcpPoll,
  handlePurchaseHistoryDetails,
  handleDpageUrl,
  handleDpageSigninCheck,
} from '../handlers/mcp-handler.js';
import { handleAnalytics } from '../handlers/analytics-handler.js';
import { settings } from '../config.js';

const router = Router();

// Get dpage url
router.get('/dpage-url/:brandId', handleDpageUrl);

router.get('/dpage-signin-check/:brandId/:linkId', handleDpageSigninCheck);

// Get purchase history
router.get('/purchase-history/:brandId', handlePurchaseHistory);

// Get purchase history details (officedepot only)
router.get(
  '/purchase-history-details/:brandId/:orderId',
  handlePurchaseHistoryDetails
);

// MCP poll endpoint
router.get('/mcp-poll/:brandId/:linkId', handleMcpPoll);

// Portrait generation endpoint
router.post('/generate-portrait', handlePortraitGeneration);

router.post('/log', (req, res) => {
  // The client sends an object: { brand: string, orders: PurchaseHistory[] }
  console.log(
    'Received orders from client:',
    JSON.stringify(req.body, null, 2)
  );
  // Respond with 204 No Content to signal successful receipt without extra payload
  res.sendStatus(204);
});

router.post('/analytics', handleAnalytics);

router.get('/config', (req, res) => {
  res.json({
    sentry: {
      dsn: settings.SENTRY_DSN || null,
    },
  });
});

export { router as apiRoutes };
