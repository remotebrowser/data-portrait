import { Request, Response } from 'express';
import { ServerLogger } from '../utils/logger/index.js';
import { analytics } from '../services/analytics-service.js';

export async function handleAnalytics(req: Request, res: Response) {
  const { event, properties = {}, identify = false } = req.body;

  // Always respond with success first (fire-and-forget analytics)
  res.json({ success: true });

  if (!req.sessionID) {
    ServerLogger.warn('Analytics called without session', {
      component: 'analytics-handler',
      sessionId: req.sessionID,
    });
    return;
  }

  if (identify) {
    await analytics.identify(req.sessionID, properties);
  } else {
    if (!event) {
      ServerLogger.warn('Analytics track called without event name', {
        component: 'analytics-handler',
        sessionId: req.sessionID,
      });
      return;
    }

    await analytics.track(req.sessionID, event, {
      ...properties,
      sessionId: req.sessionID,
    });
  }
}
