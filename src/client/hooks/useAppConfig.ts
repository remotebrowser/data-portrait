import { useState, useEffect } from 'react';

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
        console.error('Failed to fetch app config:', error);
        // Keep default values on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
  }, []);

  return { config, isLoading };
}
