/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BOARD_TITLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
