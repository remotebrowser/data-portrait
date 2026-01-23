import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const settings = {
  APP_HOST: process.env.APP_HOST || '',
  GETGATHER_URL: process.env.GETGATHER_URL || '',
  MAXMIND_ACCOUNT_ID: process.env.MAXMIND_ACCOUNT_ID || '',
  MAXMIND_LICENSE_KEY: process.env.MAXMIND_LICENSE_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  PORTKEY_API_KEY: process.env.PORTKEY_API_KEY || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  SESSION_SECRET: process.env.SESSION_SECRET || 'pleasereplacemeonprod',
  SEGMENT_WRITE_KEY: process.env.SEGMENT_WRITE_KEY || '',
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || '',
  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID || '',
  DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY || '',
} as const;
