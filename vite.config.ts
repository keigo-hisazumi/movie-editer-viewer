import { defineConfig } from 'vite';

// GitHub Pages ではリポジトリ名のパス（/movie-editer-viewer/）の下に置くので、ビルド時に VITE_BASE_PATH で渡す
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  // Firebase（Auth・Firestore）だけで 500 kB を超えるので、警告の目安を上げる
  build: { chunkSizeWarningLimit: 800 },
});
