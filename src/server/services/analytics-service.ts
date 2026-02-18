import { Analytics } from '@segment/analytics-node';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { settings } from '../config.js';

class AnalyticsService {
  private analytics: Analytics | null;

  constructor() {
    this.analytics = this._getAnalytics();
  }

  private _getAnalytics(): Analytics | null {
    if (settings.SEGMENT_WRITE_KEY) {
      return new Analytics({
        writeKey: settings.SEGMENT_WRITE_KEY,
      });
    }
    Logger.info('Analytics disabled - no write key configured', {
      component: 'analytics-service',
      operation: 'initialization',
    });
    return null;
  }

  async identify(
    userId: string,
    traits: Record<string, unknown> = {}
  ): Promise<void> {
    if (!userId || !this.analytics) return;

    try {
      // Only set email as userId if it looks like an email, otherwise use provided email in traits
      const finalTraits = { ...traits };
      if (!finalTraits.email && userId.includes('@')) {
        finalTraits.email = userId;
      }

      this.analytics.identify({
        userId,
        traits: finalTraits,
      });
    } catch (error) {
      Logger.error('Analytics identify failed', error as Error, {
        component: 'analytics-service',
        operation: 'identify',
      });
    }
  }

  async track(
    userId: string,
    event: string,
    properties: Record<string, unknown> = {}
  ): Promise<void> {
    if (!userId || !event || !this.analytics) return;

    try {
      this.analytics.track({
        userId,
        event,
        properties: {
          ...properties,
          source: 'circuit-shack',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      Logger.error('Analytics track failed', error as Error, {
        component: 'analytics-service',
        operation: 'track',
      });
    }
  }

  async flush(): Promise<void> {
    if (!this.analytics) return;

    try {
      await this.analytics.closeAndFlush();
    } catch (error) {
      Logger.error('Analytics flush failed', error as Error, {
        component: 'analytics-service',
        operation: 'flush',
      });
    }
  }
}

export const analytics = new AnalyticsService();

// Graceful shutdown
process.on('SIGTERM', () => analytics.flush());
process.on('SIGINT', () => analytics.flush());
