import { defineConfig } from 'vitest/config';

// No @vitejs/plugin-react here: Vite's own esbuild transform already handles
// JSX per tsconfig's "jsx": "react-jsx" (the plugin's job is Fast
// Refresh/Babel, neither needed under Vitest), and pulling it in here hits a
// duplicate-`vite`-version type conflict between this package's vite@6 and
// vitest's own nested vite@5 peer — not worth the churn for a test-only config.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
