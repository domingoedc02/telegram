// Placeholder entry point for apps/web.
// The real router root, pages, and feature folders land with TG-11
// (frontend foundation).

import { createRoot } from 'react-dom/client';

import { App } from './app';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
