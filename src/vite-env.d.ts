/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Firebase コンソールの firebaseConfig（JSON か JavaScript の書き方。ビルド時に埋め込む。公開してよい値） */
  readonly VITE_FIREBASE_CONFIG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
