import type { DataTransformSchema } from './DataTransformSchema.js';
import type { Schema } from './Schema.js';

export type RetailerConfig = {
  retailer_id: string;
  retailer_name: string;
  logo_url: string;
  is_mandatory: boolean;
  is_dpage?: boolean;
  /**
   * Use the iframe-based distill sign-in flow (GoodreadsConnectionModal) instead
   * of the credential-form + MCP flow (SignInDialog). Opt in per retailer via config
   * so the page never branches on a retailer id.
   */
  use_dpage_iframe?: boolean;
  schema: Array<Schema>;
  dataTransform: DataTransformSchema;
};
