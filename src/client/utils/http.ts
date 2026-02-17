import type { PurchaseHistory } from '../modules/DataTransformSchema.js';

export type GenerationRequestParams = {
  imageStyle: string[];
  gender: string;
  traits: string[];
  purchaseData: PurchaseHistory[];
  uploadedImage?: File | null;
};

/**
 * Build request body and headers for generation API calls.
 * Returns FormData when an image is uploaded, otherwise returns JSON.
 *
 * @param params - Generation request parameters
 * @returns Object containing body and headers for fetch request
 *
 * @example
 * ```typescript
 * const { body, headers } = buildGenerationRequestBody({
 *   imageStyle: ['realistic'],
 *   gender: 'Male',
 *   traits: ['glasses'],
 *   purchaseData: [],
 *   uploadedImage: file
 * });
 *
 * const response = await fetch('/api/generate', {
 *   method: 'POST',
 *   headers,
 *   body
 * });
 * ```
 */
export function buildGenerationRequestBody(params: GenerationRequestParams): {
  body: FormData | string;
  headers: Record<string, string>;
} {
  const { imageStyle, gender, traits, purchaseData, uploadedImage } = params;

  if (uploadedImage) {
    const formData = new FormData();
    formData.append('image', uploadedImage);
    formData.append('imageStyle', imageStyle.join(','));
    formData.append('gender', gender);
    formData.append('traits', traits.join(','));
    formData.append('purchaseData', JSON.stringify(purchaseData));
    return { body: formData, headers: {} };
  }

  return {
    body: JSON.stringify({
      imageStyle,
      gender,
      traits,
      purchaseData,
    }),
    headers: { 'Content-Type': 'application/json' },
  };
}

/**
 * Extract filename from a URL.
 * Returns null if URL is invalid or has no pathname.
 *
 * @param url - The URL to extract filename from
 * @returns The filename or null
 */
export function extractFilenameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname.split('/').pop() ?? null;
  } catch {
    return null;
  }
}

/**
 * Build a shareable URL for a generated image.
 *
 * @param imageUrl - The original image URL
 * @param origin - The window location origin (defaults to current window)
 * @returns The shareable URL or null if invalid
 */
export function buildImageShareUrl(
  imageUrl: string | null,
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): string | null {
  if (!imageUrl) return null;

  const filename = extractFilenameFromUrl(imageUrl);
  if (!filename) return null;

  return `${origin}/shared/${filename}`;
}
