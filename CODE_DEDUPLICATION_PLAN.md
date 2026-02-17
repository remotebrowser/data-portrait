# Code Deduplication Plan

Ordered from smallest to largest impact:

## 1. Extract filename from URL
**Location:** `src/client/components/ImagePreviewModal.tsx`
**Duplication:** The `extractFilenameFromUrl` function is defined inline and only used once.
**Benefit:** Could be reused if other components need URL parsing.
**Lines affected:** ~8 lines

## 2. Gender default value
**Locations:** `portrait-handler.ts`, `stories-handler.ts`, `stories-service.ts`
**Duplication:** `gender || ''`, `gender || 'neutral'` patterns repeated.
**Benefit:** Single source of truth for gender defaults.
**Lines affected:** ~2 lines per file

## 3. Array field parsing
**Locations:** `portrait-handler.ts`, `stories-handler.ts`
**Duplication:** Same pattern parsing `imageStyle`, `traits` from array or comma-separated string.
**Benefit:** Eliminates conditional parsing logic.
**Lines affected:** ~6 lines per file

## 4. Purchase data parsing
**Locations:** `portrait-handler.ts`, `stories-handler.ts`
**Duplication:** Parsing `purchaseData` from array or JSON string.
**Benefit:** Centralizes JSON parsing with error handling.
**Lines affected:** ~4 lines per file

## 5. Error response formatting
**Locations:** `portrait-handler.ts`, `stories-handler.ts`, `mcp-handler.ts`
**Duplication:** Same error logging + JSON response structure repeated.
**Benefit:** Consistent error format across all endpoints.
**Lines affected:** ~6 lines per file

## 6. File cleanup with logging
**Locations:** `portrait-handler.ts`, `stories-service.ts`
**Duplication:** Loop through files, try/unlink, log success/failure.
**Benefit:** Consistent cleanup behavior with proper logging.
**Lines affected:** ~10+ lines per file

## 7. Sharp image processing
**Locations:** `portrait-handler.ts`, `stories-service.ts`
**Duplication:** Logger call, path construction, sharp resize, jpeg quality, cleanup tracking.
**Benefit:** Centralizes image processing configuration (size, quality, etc.).
**Lines affected:** ~15 lines per file

## 8. FormData/JSON body construction
**Location:** `PortraitGeneration.ts`
**Duplication:** Identical IIFE blocks in both `generateSingleImage` and `generateStories`.
**Benefit:** Single function for all generation API calls.
**Lines affected:** ~20 lines per function
