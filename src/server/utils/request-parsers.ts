// Parse array or comma-separated string values from request body.
export function parseArrayField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim());
  }
  return [];
}

// Parse purchase data from request body. Handles arrays and JSON strings.
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

// Standardize gender value from request. Returns 'neutral' if invalid.
export function parseGender(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'neutral';
  }
  return value.trim();
}
