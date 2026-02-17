/**
 * Google GenAI (Gemini) client.
 * Wraps @google/genai SDK for image and text generation.
 */

import { GoogleGenAI, Modality } from '@google/genai';
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

export class GeminiClient implements AIClient {
  readonly provider = 'gemini' as const;
  private client: GoogleGenAI;
  private timeoutMs: number;

  constructor(config: AIClientConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.timeoutMs = config.timeoutMs ?? TIMEOUTS.imageGeneration;
  }

  async generateImage(request: AIGenerateImageRequest): Promise<AIImageResponse> {
    type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
    const parts: ContentPart[] = [];

    if (request.imageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: request.imageBase64,
        },
      });
    }

    parts.push({ text: request.prompt });

    const generatePromise = this.client.models.generateContent({
      model: request.model,
      contents: { role: 'user', parts },
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const response = await Promise.race([generatePromise, this.createTimeoutPromise()]);

    return responseNormalizer.imageFromGemini(response, request.model);
  }

  async generateText(request: AIGenerateTextRequest): Promise<AITextResponse> {
    type ContentPart = { text: string };
    const parts: ContentPart[] = [];

    if (request.systemPrompt) {
      parts.push({ text: request.systemPrompt });
    }

    parts.push({ text: request.prompt });

    const generatePromise = this.client.models.generateContent({
      model: request.model,
      contents: { role: 'user', parts },
    });

    const response = await Promise.race([generatePromise, this.createTimeoutPromise()]);

    return responseNormalizer.textFromGemini(response, request.model);
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AITimeoutError('gemini', this.timeoutMs));
      }, this.timeoutMs);
    });
  }
}
