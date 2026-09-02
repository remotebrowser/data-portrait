import type { DataTransformSchema } from './DataTransformSchema.js';
import type { Schema } from './Schema.js';

export type BrandConfig = {
  brand_id: string;
  brand_name: string;
  logo_url: string;
  is_mandatory: boolean;
  is_dpage?: boolean;
  /**
   * Use the iframe-based distill sign-in flow (DpageConnectionModal) instead
   * of the credential-form + MCP flow (SignInDialog). Opt in per brand via config
   * so the page never branches on a brand id.
   */
  use_dpage_iframe?: boolean;
  schema: Array<Schema>;
  dataTransform: DataTransformSchema;
};
