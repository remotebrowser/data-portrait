/**
 * Flux AI client.
 * Handles async polling pattern for image generation.
 */

import type {
  AIGenerateImageRequest,
  AIGenerateTextRequest,
  AIImageResponse,
} from '../types.js';
import type { AIClient, AIClientConfig } from './base-client.js';
import { responseNormalizer } from '../normalizer.js';
import { AIError, AITimeoutError, AIResponseError } from '../errors.js';
import { TIMEOUTS } from '../config.js';

interface FluxSubmitResponse {
  polling_url?: string;
  error?: string;
}

interface FluxPollResponse {
  status: string;
  result?: { sample?: string };
}

export class FluxClient implements AIClient {
  readonly provider = 'flux' as const;
  private apiKey: string;
  private timeoutMs: number;

  constructor(config: AIClientConfig) {
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? TIMEOUTS.imageGeneration;
  }

  async generateImage(request: AIGenerateImageRequest): Promise<AIImageResponse> {
    const payload: Record<string, unknown> = {
      prompt: request.prompt,
      width: request.width ?? 1024,
      height: request.height ?? 1024,
      prompt_upsampling: false,
      seed: 42,
      safety_tolerance: 2,
      output_format: 'jpeg',
    };

    if (request.imageBase64) {
      payload.image_prompt = request.imageBase64;
    }

    const response = await fetch('https://api.bfl.ai/v1/flux-pro-1.1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as FluxSubmitResponse;

    if (!data.polling_url) {
      throw new AIError(
        `Flux API error: ${response.statusText} ${data.error || ''}`,
        'flux',
        response.status
      );
    }

    const imageUrl = await this.pollForResult(data.polling_url);
    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    return responseNormalizer.imageFromFlux(buffer, request.model);
  }

  async generateText(_request: AIGenerateTextRequest): Promise<never> {
    void _request; // Flux doesn't support text generation
    throw new AIError('Flux does not support text generation', 'flux', 400);
  }

  private async pollForResult(pollingUrl: string): Promise<string> {
    const startTime = Date.now();
    const interval = TIMEOUTS.fluxPolling;

    while (Date.now() - startTime < this.timeoutMs) {
      const response = await fetch(pollingUrl, {
        headers: { 'x-key': this.apiKey },
      });
      const data = (await response.json()) as FluxPollResponse;

      if (data.status === 'Ready') {
        if (!data.result?.sample) {
          throw new AIResponseError(
            'Flux returned Ready but no sample image',
            'flux',
            data
          );
        }
        return data.result.sample;
      }

      const errorStatuses = [
        'Task not found',
        'Request Moderated',
        'Content Moderated',
        'Error',
      ];

      if (errorStatuses.includes(data.status)) {
        throw new AIError(`Flux task failed: ${data.status}`, 'flux', 500);
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new AITimeoutError('flux', this.timeoutMs);
  }
}
