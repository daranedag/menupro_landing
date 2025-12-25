// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://menupro.cl',
  trailingSlash: 'never', // URLs sin trailing slash para consistencia SEO
  vite: {
    plugins: [tailwindcss()]
  }
});