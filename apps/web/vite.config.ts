import { defineConfig } from 'vite';

/**
 * Vite configuration of the web client. `vite build` writes `dist/`, which the game server
 * serves at `/`. `vite` (the development server) proxies the API and the WebSocket to a game
 * server on port 8787.
 */
export default defineConfig({
  base: process.env.VITE_STATIC_MODE === 'true' ? './' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    ...(process.env.STATIC_QA ? { rollupOptions: { input: { main: 'index.html', qa: 'static-qa.html' } } } : {}),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', ws: true },
    },
  },
});
