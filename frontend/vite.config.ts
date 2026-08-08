import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/oauth2/authorization': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Code-split the heavy vendor libraries into their own cacheable chunks
    // instead of one ~1MB bundle.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          axios: ['axios', 'js-cookie'],
          charts: ['recharts'],
          pdf: ['react-pdf'],
          markdown: ['react-markdown', 'remark-gfm'],
          calendar: ['react-calendar'],
        },
      },
    },
  },
});