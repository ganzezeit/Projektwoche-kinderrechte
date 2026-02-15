import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  appType: 'spa',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Firebase SDK into separate cacheable chunk
          firebase: ['firebase/app', 'firebase/database'],
        },
      },
    },
  },
});
