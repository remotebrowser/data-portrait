/**
 * Parse array or comma-separated string values from request body.
 * Handles multiple input formats: arrays, comma-separated strings, and single strings.
 *
 * @param value - The value to parse (array, string, or undefined)
 * @returns Array of trimmed strings
 *
 * @example
 * ```typescript
 * // From array
 * parseArrayField(['a', 'b']) // ['a', 'b']
 *
 * // From comma-separated string
 * parseArrayField('a, b, c') // ['a', 'b', 'c']
 *
 * // From undefined
 * parseArrayField(undefined) // []
 * ```
 */
export function parseArrayField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim());
  }
  return [];
}

/**
 * Parse purchase data from request body.
 * Handles arrays, JSON strings, and undefined values.
 *
 * @param value - The value to parse
 * @returns Array of purchase data objects
 *
 * @example
 * ```typescript
 * // From array
 * parsePurchaseData([{ id: 1 }]) // [{ id: 1 }]
 *
 * // From JSON string
 * parsePurchaseData('[{"id": 1}]') // [{ id: 1 }]
 *
 * // From undefined
 * parsePurchaseData(undefined) // []
 * ```
 */
export function parsePurchaseData(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Standardize gender value from request.
 * Returns lowercase gender or 'neutral' if invalid.
 *
 * @param value - The gender value from request
 * @returns Standardized gender string
 */
export function parseGender(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'neutral';
  }
  return value.trim();
}
