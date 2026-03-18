import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const enabledFeatures = (process.env.ENABLE_FEATURES || '')
  .split(',')
  .map((feature) => feature.trim().toLowerCase())
  .filter(Boolean);

export const settings = {
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
} as const;
