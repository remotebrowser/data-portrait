import type { DataTransformSchema } from './DataTransformSchema.js';

export type BrandConfig = {
  brand_id: string;
  brand_name: string;
  logo_url: string;
  is_mandatory: boolean;
  /**
   * Maps the retailer's distilled rows onto PurchaseHistory. Since every retailer
   * signs in through the same dpage flow, this is the only per-retailer behavior
   * left in config — the sign-in form itself comes from mcp-getgather's distiller.
   */
  dataTransform: DataTransformSchema;
};
