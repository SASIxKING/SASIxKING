import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = process.env.API_PORT || 8787;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Accept the sandbox/preview host as well as localhost. The browser is not
    // the server, so it must never be told to call localhost directly — all
    // API traffic goes through this proxy on a relative /api path.
    allowedHosts: true,
    cors: true,
    hmr: { clientPort: 443 },
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
});
