import { useAppConfig } from './useAppConfig.js';

export function useFeatureFlags() {
  const { config, isLoading } = useAppConfig();
  const enabledFeatures = config.enabledFeatures || [];

  const isFeatureEnabled = (name: string) =>
    enabledFeatures.includes(name.toLowerCase());

  return {
    enabledFeatures,
    isFeatureEnabled,
    isLoading,
    config,
  };
}

