import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function normalizedSiteUrl() {
  const raw = process.env.VITE_SITE_URL || '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'repo-pulse-html-meta',
      transformIndexHtml(html: string) {
        return html.replaceAll('__SITE_URL__', normalizedSiteUrl());
      },
    },
  ],
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
  },
});
