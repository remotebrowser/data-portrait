/**
 * Request data sanitizer utility
 * Removes or masks sensitive information from request data for logging purposes
 */

interface SanitizationOptions {
  maskEmailDomains?: boolean;
  redactPasswords?: boolean;
  redactFields?: string[];
  maskFields?: string[];
}

const DEFAULT_OPTIONS: SanitizationOptions = {
  maskEmailDomains: true,
  redactPasswords: true,
  redactFields: ['password', 'token', 'secret', 'key'],
  maskFields: ['email', 'phone'],
};

/**
 * Mask email addresses to show only first 2 characters before @
 * Example: "test@example.com" -> "te***@example.com"
 */
function maskEmail(email: string): string {
  if (typeof email !== 'string' || !email.includes('@')) {
    return email;
  }
  return email.replace(/(.{2}).*@/, '$1***@');
}

/**
 * Deep clone an object to avoid mutating the original
 */
function deepClone(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone);
  }

  const cloned: Record<string, unknown> = {};
  for (const key in obj as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }

  return cloned;
}

/**
 * Recursively sanitize an object by redacting/masking sensitive fields
 */
function sanitizeObject(
  obj: unknown,
  options: SanitizationOptions
): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, options));
  }

  const record = obj as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const key in record) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const value = record[key];
      const lowerKey = key.toLowerCase();

      // Redact sensitive fields
      if (
        options.redactFields?.some((field) =>
          lowerKey.includes(field.toLowerCase())
        )
      ) {
        sanitized[key] = '[REDACTED]';
      }
      // Mask fields like email
      else if (
        options.maskFields?.some((field) =>
          lowerKey.includes(field.toLowerCase())
        )
      ) {
        if (lowerKey.includes('email') && typeof value === 'string') {
          sanitized[key] = maskEmail(value);
        } else {
          sanitized[key] =
            typeof value === 'string'
              ? value.replace(/.(?=.{2})/g, '*')
              : value;
        }
      }
      // Recursively sanitize nested objects
      else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value, options);
      }
      // Keep other values as-is
      else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize request data for safe logging
 * @param data - The request data to sanitize
 * @param options - Sanitization options
 * @returns Sanitized copy of the data
 */
function sanitizeRequestData(
  data: unknown,
  options: SanitizationOptions = DEFAULT_OPTIONS
): unknown {
  const clonedData = deepClone(data);
  return sanitizeObject(clonedData, { ...DEFAULT_OPTIONS, ...options });
}

/**
 * Create a formatted log message with sanitized request data
 * @param prefix - Log message prefix
 * @param data - Request data to sanitize and log
 * @param options - Sanitization options
 * @returns Formatted log message
 */
export function createSanitizedLogMessage(
  prefix: string,
  data: unknown,
  options: SanitizationOptions = DEFAULT_OPTIONS
): string {
  const sanitizedData = sanitizeRequestData(data, options);
  return `${prefix}: ${JSON.stringify(sanitizedData, null, 2)}`;
}
