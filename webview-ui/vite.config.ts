import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import * as path from 'path';

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src/shared'),
    },
  },
});
