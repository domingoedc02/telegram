import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Full dev-server proxy (/api, /ws -> http://localhost:3000) lands with TG-11
// (frontend foundation). This stub is enough for `pnpm build`/`pnpm dev` to run
// against the placeholder server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
