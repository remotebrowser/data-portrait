import { useState, useEffect } from 'react';
import { logger } from '@/utils/logger/index.js';

type AppConfig = {
  allowFaceUpload: boolean;
  enabledFeatures: string[];
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>({
    allowFaceUpload: false,
    enabledFeatures: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/getgather/config');
        if (response.ok) {
          const data = await response.json();
          const enabledFeatures =
            Array.isArray(data.enabledFeatures) && data.enabledFeatures.length
              ? data.enabledFeatures
                  .map((feature: unknown) => String(feature).trim().toLowerCase())
                  .filter(Boolean)
              : [];

          setConfig({
            allowFaceUpload: data.allowFaceUpload === true,
            enabledFeatures,
          });
        }
      } catch (error) {
        logger.error('Failed to fetch app config', error as Error, {
          component: 'use-app-config',
        });
        // Keep default values on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
  }, []);

  return { config, isLoading };
}
