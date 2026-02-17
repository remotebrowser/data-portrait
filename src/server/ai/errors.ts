/**
 * AI-specific error types.
 */

export class AIError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class AITimeoutError extends AIError {
  constructor(provider: string, timeoutMs: number) {
    super(
      `AI request timed out after ${timeoutMs / 1000} seconds`,
      provider,
      408
    );
    this.name = 'AITimeoutError';
  }
}

export class AIResponseError extends AIError {
  constructor(
    message: string,
    provider: string,
    public readonly rawResponse?: unknown
  ) {
    super(message, provider, 500);
    this.name = 'AIResponseError';
  }
}

export class AIConfigError extends AIError {
  constructor(message: string) {
    super(message, 'unknown', 500);
    this.name = 'AIConfigError';
  }
}
