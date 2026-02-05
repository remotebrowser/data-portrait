import { useState, useEffect } from 'react';
import { ClientLogger } from '../../utils/logger/client.js';

const logger = new ClientLogger();

type AppConfig = {
  allowFaceUpload: boolean;
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>({
    allowFaceUpload: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/getgather/config');
        if (response.ok) {
          const data = await response.json();
          setConfig({
            allowFaceUpload: data.allowFaceUpload === true,
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
