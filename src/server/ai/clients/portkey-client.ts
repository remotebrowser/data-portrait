/**
 * Portkey AI client.
 * Wraps Portkey SDK for image and text generation.
 */

import { Portkey } from 'portkey-ai';
import type {
  AIGenerateImageRequest,
  AIGenerateTextRequest,
  AIImageResponse,
  AITextResponse,
} from '../types.js';
import type { AIClient, AIClientConfig } from './base-client.js';
import { responseNormalizer } from '../normalizer.js';
import { AITimeoutError } from '../errors.js';
import { TIMEOUTS } from '../config.js';

export class PortkeyClient implements AIClient {
  readonly provider = 'portkey' as const;
  private client: Portkey;
  private timeoutMs: number;

  constructor(config: AIClientConfig) {
    this.client = new Portkey({ apiKey: config.apiKey });
    this.timeoutMs = config.timeoutMs ?? TIMEOUTS.imageGeneration;
  }

  async generateImage(request: AIGenerateImageRequest): Promise<AIImageResponse> {
    const content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [
      {
        type: 'text',
        text: request.prompt,
      },
    ];

    if (request.imageBase64) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${request.imageBase64}`,
        },
      });
    }

    const response = await Promise.race([
      this.client.chat.completions.create({
        model: request.model,
        maxTokens: request.maxTokens,
        stream: false,
        modalities: ['text', 'image'],
        messages: [{ role: 'user', content }],
      }),
      this.createTimeoutPromise(),
    ]);

    return responseNormalizer.imageFromPortkey(response, request.model);
  }

  async generateText(request: AIGenerateTextRequest): Promise<AITextResponse> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    const response = await Promise.race([
      this.client.chat.completions.create({
        model: request.model,
        max_tokens: request.maxTokens,
        messages,
      }),
      this.createTimeoutPromise(),
    ]);

    return responseNormalizer.textFromPortkey(response, request.model);
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AITimeoutError('portkey', this.timeoutMs));
      }, this.timeoutMs);
    });
  }
}
