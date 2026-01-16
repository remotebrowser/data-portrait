import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client'),
    },
  },
  build: {
    outDir: 'dist/client',
  },
  server: {
    proxy: {
      '/getgather': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/dpage': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/dpage': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dpage/, '/dpage'),
      },
    },
  },
});
