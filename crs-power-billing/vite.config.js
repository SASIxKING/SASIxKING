import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = process.env.API_PORT || 8787;

/**
 * One codebase, three outputs:
 *
 *   default              → web app; talks to the Express API through /api
 *   VITE_APP_TARGET set  → embedded build for Android (Capacitor) and Windows
 *                          (Electron). Assets use relative paths so the bundle
 *                          loads from file:// or the Capacitor scheme, and the
 *                          business core runs in-process with no server.
 */
export default defineConfig(({ mode }) => {
  const target = process.env.VITE_APP_TARGET || 'web';
  const embedded = target !== 'web';

  return {
    plugins: [react()],

    // file:// and capacitor:// cannot resolve absolute /assets paths
    base: embedded ? './' : '/',

    define: {
      'import.meta.env.VITE_APP_TARGET': JSON.stringify(target),
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Keep the bundle debuggable in the field without shipping huge maps
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },

    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      // The preview/sandbox host must be allowed; the browser is not the
      // server, so the app only ever uses relative URLs and this proxy.
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
  };
});
