// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://menupro.cl',
  trailingSlash: 'never', // URLs sin trailing slash para consistencia SEO
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/_template-ciudad'),
      changefreq: 'weekly',
      lastmod: new Date(),
      // Función para asignar prioridad y lastmod según la URL
      serialize(item) {
        // Fecha actual para páginas dinámicas
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        // Página principal - máxima prioridad, actualización diaria
        if (item.url === 'https://menupro.cl' || item.url === 'https://menupro.cl/') {
          item.changefreq = 'daily';
          item.priority = 1.0;
          item.lastmod = now;
        }
        // Landing principal de restaurantes - alta prioridad
        else if (item.url.includes('/menu-digital-restaurantes') && !item.url.includes('/menu-digital-restaurantes-')) {
          item.changefreq = 'weekly';
          item.priority = 0.9;
          item.lastmod = oneWeekAgo;
        }
        // Páginas de ciudad - prioridad media-alta
        else if (item.url.includes('/menu-digital-restaurantes-')) {
          item.changefreq = 'weekly';
          item.priority = 0.8;
          item.lastmod = oneWeekAgo;
        }
        // Páginas de contenido (quienes-somos, contacto)
        else if (item.url.includes('/quienes-somos') || item.url.includes('/contacto')) {
          item.changefreq = 'monthly';
          item.priority = 0.7;
          item.lastmod = oneMonthAgo;
        }
        // Otras páginas - prioridad normal
        else {
          item.changefreq = 'monthly';
          item.priority = 0.6;
          item.lastmod = oneMonthAgo;
        }
        return item;
      }
    })
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});