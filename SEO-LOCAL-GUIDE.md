# 🌍 Guía de SEO Local por Ciudad

Esta guía explica cómo agregar nuevas páginas optimizadas para SEO local en MenuPro.

## 📁 Estructura de Archivos

```
src/
├── data/
│   └── cities.ts          # Datos de todas las ciudades
├── layouts/
│   └── SeoLayout.astro    # Layout con meta tags completos
└── pages/
    ├── _template-ciudad.astro                       # Plantilla base
    └── menu-digital-restaurantes-[ciudad].astro     # Páginas por ciudad
```

## 🚀 Agregar una Nueva Ciudad

### Paso 1: Agregar datos en `src/data/cities.ts`

Abre el archivo y agrega una nueva entrada en el objeto `cities`:

```typescript
export const cities: Record<string, CityData> = {
  // ... ciudades existentes
  
  santiago: {
    name: "Santiago",
    slug: "santiago",
    region: "Región Metropolitana",
    description: "Implementa un menú digital profesional para tu restaurante en Santiago. Gestión simple y actualización en tiempo real.",
    keywords: [
      "menú digital Santiago",
      "carta digital restaurante Santiago",
      "menú QR Santiago",
      "carta restaurante Santiago Centro"
    ],
    localContext: "Santiago concentra la mayor oferta gastronómica del país, desde restaurantes de autor hasta picadas tradicionales. MenuPro facilita la gestión de cartas digitales para restaurantes de todos los tamaños en la capital.",
    neighborhoods: [
      "Santiago Centro",
      "Providencia",
      "Las Condes",
      "Vitacura",
      "Ñuñoa"
    ],
    phone: "+56912345678" // Tu número de WhatsApp
  },
};
```

### Paso 2: Crear la página

1. Copia el archivo `_template-ciudad.astro`
2. Renómbralo según el patrón: `menu-digital-restaurantes-[ciudad].astro`
   - Ejemplo: `menu-digital-restaurantes-santiago.astro`
3. Abre el archivo y cambia la constante `CITY_SLUG` en la línea 18:

```typescript
const CITY_SLUG = "santiago"; // Cambia por el slug de tu ciudad
```

¡Eso es todo! La página ya está lista y optimizada para SEO.

## 🎯 Características de SEO Implementadas

### 1. Meta Tags Completos
- ✅ Title y Description optimizados
- ✅ Canonical URL
- ✅ Keywords locales
- ✅ Open Graph (Facebook)
- ✅ Twitter Cards
- ✅ Geo tags para localización

### 2. Schema.org JSON-LD
- ✅ LocalBusiness Schema
- ✅ BreadcrumbList Schema
- ✅ WebPage Schema

### 3. Contenido Contextualizado
- ✅ Títulos personalizados por ciudad
- ✅ Descripción del contexto local
- ✅ Barrios/zonas atendidas
- ✅ Beneficios adaptados a la ciudad

## 📝 Personalizar Contenido Local

Si quieres agregar contenido específico diferente para una ciudad, puedes editar directamente el archivo `.astro` de esa ciudad. Por ejemplo, para cambiar la descripción de las tarjetas:

```astro
<div class="bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-sm">
  <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
    <span class="text-2xl">🍽️</span>
    Ideal para tu restaurante
  </h3>
  <p class="text-sm text-muted">
    <!-- 👇 Personaliza este texto -->
    Contenido específico para {cityData.name}...
  </p>
</div>
```

## 🔍 Verificar el SEO

### En desarrollo:
```bash
npm run dev
```
Visita: `http://localhost:4321/menu-digital-restaurantes-[ciudad]`

### Verificar Schema:
1. Ve a [Google Rich Results Test](https://search.google.com/test/rich-results)
2. Ingresa la URL de tu página
3. Verifica que los schemas aparezcan correctamente

### Verificar Open Graph:
1. Ve a [OpenGraph.xyz](https://www.opengraph.xyz/)
2. Ingresa la URL de tu página
3. Verifica cómo se ve en redes sociales

## 🌐 URLs Generadas

Las páginas siguen este patrón:
```
https://menupro.cl/menu-digital-restaurantes-[ciudad]
```

Ejemplos:
- `https://menupro.cl/menu-digital-restaurantes-valdivia`
- `https://menupro.cl/menu-digital-restaurantes-santiago`
- `https://menupro.cl/menu-digital-restaurantes-concepcion`

## 💡 Tips para Keywords

### Keywords principales a incluir:
- "menú digital [ciudad]"
- "carta digital restaurante [ciudad]"
- "menú QR [ciudad]"
- "carta restaurante [ciudad]"
- "menú digital [región]"

### Keywords secundarias:
- "digitalizar menú [ciudad]"
- "carta contactless [ciudad]"
- "menú sin contacto [ciudad]"
- Barrios específicos: "menú digital [barrio]"

## 📊 Datos Estructurados (Schema.org)

Cada página incluye automáticamente:

### LocalBusiness Schema
```json
{
  "@type": "LocalBusiness",
  "name": "MenuPro",
  "address": {
    "addressLocality": "Ciudad",
    "addressRegion": "Región",
    "addressCountry": "CL"
  },
  "areaServed": {
    "@type": "City",
    "name": "Ciudad"
  }
}
```

### BreadcrumbList Schema
Ayuda a Google a entender la jerarquía:
```
Inicio > Menú Digital Restaurantes > Menú Digital [Ciudad]
```

## ❓ FAQ

### ¿Puedo tener múltiples páginas para la misma ciudad?
Sí, pero considera usar barrios específicos. Por ejemplo:
- `menu-digital-restaurantes-santiago-providencia.astro`
- `menu-digital-restaurantes-santiago-vitacura.astro`

### ¿Cómo agrego imágenes específicas por ciudad?
Agrega la propiedad `ogImage` en la configuración de ciudad:

```typescript
santiago: {
  // ... otros datos
  ogImage: "/images/og/santiago.jpg"
}
```

Luego en el SeoLayout:
```astro
ogImage={cityData.ogImage || "/images/og-default.jpg"}
```

### ¿Debo crear un sitemap?
Sí, Astro puede generar uno automáticamente. Agrega en `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://menupro.cl',
  integrations: [
    // ... otros
  ],
});
```

## 🚢 Deploy

Después de agregar nuevas ciudades:

```bash
# Build del proyecto
npm run build

# Preview local
npm run preview

# Deploy (según tu hosting)
# Vercel: git push
# Netlify: git push
# etc.
```

## 📞 Contacto WhatsApp

No olvides actualizar el número de WhatsApp en:
1. `src/data/cities.ts` (propiedad `phone`)
2. `src/components/sections/CTA.astro` (botón de WhatsApp)

---

**¿Dudas?** Revisa los archivos existentes como ejemplos:
- [src/pages/menu-digital-restaurantes-valdivia.astro](./src/pages/menu-digital-restaurantes-valdivia.astro)
- [src/data/cities.ts](./src/data/cities.ts)
