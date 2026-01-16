/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_USE_HOSTED_LINK: string;
  readonly VITE_SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
