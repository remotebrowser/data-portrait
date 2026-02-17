/**
 * Model configuration by provider.
 * Centralized model IDs and parameters.
 */

import type { AIModelConfig, AIProvider } from './types.js';

export const MODELS: Record<
  AIProvider,
  { image: AIModelConfig; text: AIModelConfig }
> = {
  portkey: {
    image: {
      id: '@google/gemini-3-pro-image-preview',
      maxTokens: 32000,
      supportsImages: true,
    },
    text: {
      id: '@OpenRouter/google/gemini-2.5-pro-preview',
      maxTokens: 2048,
      supportsImages: false,
    },
  },
  gemini: {
    image: {
      id: 'gemini-3-pro-image-preview',
      maxTokens: 32000,
      supportsImages: true,
    },
    text: {
      id: 'gemini-3-pro-preview',
      maxTokens: 2048,
      supportsImages: false,
    },
  },
  flux: {
    image: {
      id: 'flux-pro-1.1',
      maxTokens: 0, // Flux doesn't use tokens
      supportsImages: true,
    },
    text: {
      id: '', // Flux doesn't support text generation
      maxTokens: 0,
      supportsImages: false,
    },
  },
};

export const TIMEOUTS = {
  imageGeneration: 120000,
  textGeneration: 30000,
  fluxPolling: 500,
} as const;
