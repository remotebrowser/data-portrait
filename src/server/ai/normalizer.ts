/**
 * Response normalizer - converts provider-specific responses to unified types.
 * Single source of truth for response extraction.
 */

import type { AIImageResponse, AITextResponse } from './types.js';
import { AIResponseError } from './errors.js';

// Provider-specific raw response types
interface PortkeyImageResponse {
  choices?: Array<{
    message?: {
      content_blocks?: Array<{
        image_url?: { url?: string };
      }>;
    };
  }>;
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string };
      }>;
    };
  }>;
}

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

interface PortkeyTextResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export class ResponseNormalizer {
  imageFromPortkey(response: unknown, model: string): AIImageResponse {
    const r = response as PortkeyImageResponse;
    const imageUrl = r.choices?.[0]?.message?.content_blocks?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new AIResponseError(
        'No image URL in Portkey response',
        'portkey',
        response
      );
    }

    const base64 = imageUrl.split(',')[1];
    if (!base64) {
      throw new AIResponseError(
        'Invalid image data format from Portkey',
        'portkey',
        response
      );
    }

    return {
      base64,
      model,
      provider: 'portkey',
      width: 1024,
      height: 1024,
    };
  }

  imageFromGemini(response: unknown, model: string): AIImageResponse {
    const r = response as GeminiImageResponse;
    const parts = r.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new AIResponseError(
        'No content parts in Gemini response',
        'gemini',
        response
      );
    }

    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      throw new AIResponseError(
        'No image data in Gemini response',
        'gemini',
        response
      );
    }

    return {
      base64: imagePart.inlineData.data,
      model,
      provider: 'gemini',
      width: 1024,
      height: 1024,
    };
  }

  imageFromFlux(buffer: Buffer, model: string): AIImageResponse {
    return {
      base64: buffer.toString('base64'),
      model,
      provider: 'flux',
      width: 1024,
      height: 1024,
    };
  }

  textFromPortkey(response: unknown, model: string): AITextResponse {
    const r = response as PortkeyTextResponse;
    const content = r.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content.trim() : '';

    if (!text) {
      throw new AIResponseError(
        'No text content in Portkey response',
        'portkey',
        response
      );
    }

    return {
      text,
      model,
      provider: 'portkey',
    };
  }

  textFromGemini(response: unknown, model: string): AITextResponse {
    const r = response as GeminiTextResponse;
    const text = r.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      throw new AIResponseError(
        'No text content in Gemini response',
        'gemini',
        response
      );
    }

    return {
      text,
      model,
      provider: 'gemini',
    };
  }
}

export const responseNormalizer = new ResponseNormalizer();
