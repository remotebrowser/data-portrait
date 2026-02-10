import { Router } from 'express';
import multer from 'multer';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { handleGeneratePortrait } from '../handlers/portrait-handler.js';
import {
  handlePurchaseHistory,
  handleMcpPoll,
  handlePurchaseHistoryDetails,
  handleDpageUrl,
  handleDpageSigninCheck,
} from '../handlers/mcp-handler.js';
import { handleAnalytics } from '../handlers/analytics-handler.js';
import {
  handleStoriesGeneration,
  handleStoriesPoll,
  handleGetStories,
} from '../handlers/stories-handler.js';
import { settings } from '../config.js';

const router = Router();

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

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
router.post(
  '/generate-portrait',
  upload.single('image'),
  handleGeneratePortrait
);

// Stories generation endpoints
router.post('/generate/stories', handleStoriesGeneration);
router.get('/stories/poll/:id', handleStoriesPoll);
router.get('/stories/:id', handleGetStories);

router.post('/log', (req, res) => {
  // Log received orders from client
  Logger.info('Received orders from client', {
    component: 'api-routes',
    operation: 'receive-orders',
    brand: req.body.brand,
    orderCount: req.body.orders?.length || 0,
  });
  // Respond with 204 No Content to signal successful receipt without extra payload
  res.sendStatus(204);
});

router.post('/analytics', handleAnalytics);

router.get('/config', (_req, res) => {
  res.json({
    sentry: {
      dsn: settings.SENTRY_DSN || null,
    },
    allowFaceUpload: settings.ALLOW_FACE_UPLOAD,
  });
});

export { router as apiRoutes };
