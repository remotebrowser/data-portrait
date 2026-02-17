/**
 * AI module - Pure API clients for AI services.
 * No business logic. Just HTTP wrappers + normalization.
 */

export type {
  AIGenerateImageRequest,
  AIGenerateTextRequest,
  AIImageResponse,
  AITextResponse,
  AIModelConfig,
  AIProvider,
} from './types.js';
export type { AIClient, AIClientConfig } from './clients/base-client.js';
export { PortkeyClient } from './clients/portkey-client.js';
export { GeminiClient } from './clients/gemini-client.js';
export { FluxClient } from './clients/flux-client.js';
export { responseNormalizer, ResponseNormalizer } from './normalizer.js';
export { AIError, AITimeoutError, AIResponseError, AIConfigError } from './errors.js';
export { MODELS, TIMEOUTS } from './config.js';

import type { AIClient } from './clients/base-client.js';
import { PortkeyClient } from './clients/portkey-client.js';
import { GeminiClient } from './clients/gemini-client.js';
import { FluxClient } from './clients/flux-client.js';
import { settings } from '../config.js';
import { AIConfigError } from './errors.js';

/**
 * Factory to create appropriate AI client based on available API keys.
 * Priority: Portkey > Gemini > Flux
 */
export function createAIClient(): AIClient {
  if (settings.PORTKEY_API_KEY) {
    return new PortkeyClient({
      apiKey: settings.PORTKEY_API_KEY,
    });
  }

  if (settings.GEMINI_API_KEY) {
    return new GeminiClient({
      apiKey: settings.GEMINI_API_KEY,
    });
  }

  if (settings.FLUX_API_KEY) {
    return new FluxClient({
      apiKey: settings.FLUX_API_KEY,
    });
  }

  throw new AIConfigError(
    'No AI provider configured. Set PORTKEY_API_KEY, GEMINI_API_KEY, or FLUX_API_KEY.'
  );
}

/**
 * Create a specific client by provider type.
 */
export function createClientByProvider(
  provider: 'portkey' | 'gemini' | 'flux'
): AIClient {
  switch (provider) {
    case 'portkey': {
      if (!settings.PORTKEY_API_KEY) {
        throw new AIConfigError('PORTKEY_API_KEY not set');
      }
      return new PortkeyClient({ apiKey: settings.PORTKEY_API_KEY });
    }
    case 'gemini': {
      if (!settings.GEMINI_API_KEY) {
        throw new AIConfigError('GEMINI_API_KEY not set');
      }
      return new GeminiClient({ apiKey: settings.GEMINI_API_KEY });
    }
    case 'flux': {
      if (!settings.FLUX_API_KEY) {
        throw new AIConfigError('FLUX_API_KEY not set');
      }
      return new FluxClient({ apiKey: settings.FLUX_API_KEY });
    }
  }
}

/**
 * Get available provider based on env config.
 */
export function getAvailableProvider(): 'portkey' | 'gemini' | 'flux' {
  if (settings.PORTKEY_API_KEY) return 'portkey';
  if (settings.GEMINI_API_KEY) return 'gemini';
  if (settings.FLUX_API_KEY) return 'flux';
  throw new AIConfigError('No AI provider configured');
}
