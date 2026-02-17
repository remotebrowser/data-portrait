/**
 * Unified types for AI clients.
 * Pure API contracts - no business logic.
 */

export interface AIGenerateImageRequest {
  prompt: string;
  imageBase64?: string;
  model: string;
  maxTokens?: number;
  width?: number;
  height?: number;
}

export interface AIGenerateTextRequest {
  prompt: string;
  systemPrompt?: string;
  model: string;
  maxTokens?: number;
}

export interface AIImageResponse {
  base64: string;
  model: string;
  provider: string;
  width: number;
  height: number;
}

export interface AITextResponse {
  text: string;
  model: string;
  provider: string;
}

export interface AIModelConfig {
  id: string;
  maxTokens: number;
  supportsImages: boolean;
}

export type AIProvider = 'portkey' | 'gemini' | 'flux';
