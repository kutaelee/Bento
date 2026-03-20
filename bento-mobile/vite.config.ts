import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.BENTO_MOBILE_BASE || '/demo/bento-mobile/',
  plugins: [react()],
  server: {
    port: 13100,
    host: '0.0.0.0',
  },
  preview: {
    port: 13100,
    host: '0.0.0.0',
  },
});
