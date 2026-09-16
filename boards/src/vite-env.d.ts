/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** What the app is called. */
  readonly VITE_SITE_NAME?: string;
  /** Superseded by VITE_SITE_NAME; still read so older setups keep working. */
  readonly VITE_BOARD_TITLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
