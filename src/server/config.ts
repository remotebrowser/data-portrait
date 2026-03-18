import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const enabledFeatures = (process.env.ENABLE_FEATURES || '')
  .split(',')
  .map((feature) => feature.trim().toLowerCase())
  .filter(Boolean);

export const settings = {
  APP_HOST: process.env.APP_HOST || '',
  GETGATHER_URL: process.env.GETGATHER_URL || '',
  GETGATHER_APP_KEY: process.env.GETGATHER_APP_KEY || '',
  MAXMIND_ACCOUNT_ID: process.env.MAXMIND_ACCOUNT_ID || '',
  MAXMIND_LICENSE_KEY: process.env.MAXMIND_LICENSE_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  PORTKEY_API_KEY: process.env.PORTKEY_API_KEY || '',
  FLUX_API_KEY: process.env.FLUX_API_KEY || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  SESSION_SECRET: process.env.SESSION_SECRET || 'pleasereplacemeonprod',
  SEGMENT_WRITE_KEY: process.env.SEGMENT_WRITE_KEY || '',
  STORAGE_MODE: process.env.STORAGE_MODE || 'local',
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || '',
  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID || '',
  DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY || '',
  ENABLED_FEATURES: enabledFeatures,
  ALLOW_FACE_UPLOAD:
    process.env.ALLOW_FACE_UPLOAD === 'true' ||
    enabledFeatures.includes('photo_upload'),
  IS_GCS_STORAGE: (process.env.STORAGE_MODE || 'local') === 'gcs',
} as const;

export function validateConfiguration(): void {
  if (settings.STORAGE_MODE !== 'gcs' && settings.STORAGE_MODE !== 'local') {
    throw new Error(
      `Invalid STORAGE_MODE "${settings.STORAGE_MODE}". Expected "gcs" or "local".`
    );
  }

  if (!settings.IS_GCS_STORAGE) {
    return;
  }

  const missingVariables: string[] = [];
  const hasGcsStorageConfig = Boolean(
    settings.GCS_BUCKET_NAME && settings.GCS_PROJECT_ID
  );

  if (!hasGcsStorageConfig) {
    if (!settings.GCS_BUCKET_NAME) {
      missingVariables.push('GCS_BUCKET_NAME');
    }
    if (!settings.GCS_PROJECT_ID) {
      missingVariables.push('GCS_PROJECT_ID');
    }
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `STORAGE_MODE is "gcs" but required storage configuration is missing: ${missingVariables.join(', ')}`
    );
  }
}
