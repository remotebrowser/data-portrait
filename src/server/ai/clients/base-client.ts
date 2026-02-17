/**
 * Base interface for all AI clients.
 * Pure API contract - no business logic.
 */

import type {
  AIGenerateImageRequest,
  AIGenerateTextRequest,
  AIImageResponse,
  AITextResponse,
  AIProvider,
} from '../types.js';

export interface AIClient {
  readonly provider: AIProvider;

  generateImage(request: AIGenerateImageRequest): Promise<AIImageResponse>;
  generateText(request: AIGenerateTextRequest): Promise<AITextResponse>;
}

export interface AIClientConfig {
  apiKey: string;
  timeoutMs?: number;
}
