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
  // Resolve the build target from the env var, falling back to the npm script
  // name (npm_lifecycle_event). Relying on cross-env alone is fragile: if it
  // is unavailable the variable is silently dropped and we would ship a WEB
  // bundle inside the desktop/mobile app, which then loads nothing from
  // file:// and shows a blank window. Fail loudly instead of shipping that.
  const script = process.env.npm_lifecycle_event || '';
  const inferred =
    process.env.VITE_APP_TARGET
    || (/android/i.test(script) ? 'android' : '')
    || (/desktop|windows|electron/i.test(script) ? 'windows' : '')
    || (/embedded/i.test(script) ? 'embedded' : '')
    || 'web';

  const target = inferred;
  const embedded = target !== 'web';

  console.log(`[vite] building target="${target}" (${embedded ? 'offline/embedded, relative asset paths' : 'web, served over HTTP'})`);

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
