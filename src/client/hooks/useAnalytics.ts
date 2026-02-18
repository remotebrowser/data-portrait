import { useCallback } from 'react';
import { logger } from '@/utils/logger/index.js';

export const useAnalytics = () => {
  const trackEvent = useCallback(
    (event: string, properties: Record<string, unknown> = {}) => {
      fetch('/getgather/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          properties,
        }),
      }).catch((error) => {
        logger.warn('Failed to send analytics event', {
          component: 'use-analytics',
          event,
          error: (error as Error).message,
        });
      });
    },
    []
  );

  const identifyUser = useCallback((properties: Record<string, unknown> = {}) => {
    fetch('/getgather/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identify: true,
        properties,
      }),
    }).catch((error) => {
      logger.warn('Failed to send analytics identify', {
        component: 'use-analytics',
        error: (error as Error).message,
      });
    });
  }, []);

  return {
    trackEvent,
    identifyUser,
  };
};
