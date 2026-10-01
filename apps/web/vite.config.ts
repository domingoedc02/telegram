import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev-server proxy: Vite serves apps/web on :5173, Fastify serves the API +
// WS gateway on :3000 (spec/setup). Mirrors production, where @fastify/static
// serves the built SPA from the same origin as the API, so same-origin
// cookies (the HttpOnly session cookie, the CSRF header check) behave the
// same in dev as in prod.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
