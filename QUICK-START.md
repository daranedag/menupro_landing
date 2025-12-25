# 🚀 Quick Start - Agregar Nueva Ciudad

## Pasos Rápidos (5 minutos)

### 1️⃣ Agregar datos de ciudad
Abre: `src/data/cities.ts`

```typescript
// Copia este bloque y edita los valores
tuciudad: {
  name: "Tu Ciudad",
  slug: "tuciudad",
  region: "Tu Región",
  description: "Implementa un menú digital para tu restaurante en Tu Ciudad...",
  keywords: [
    "menú digital Tu Ciudad",
    "carta digital restaurante Tu Ciudad",
    "menú QR Tu Ciudad"
  ],
  localContext: "Describe algo característico de Tu Ciudad relacionado con restaurantes...",
  neighborhoods: ["Barrio 1", "Barrio 2", "Centro"],
  phone: "+56912345678"
},
```

### 2️⃣ Crear página
```bash
# Copia la plantilla
cp src/pages/_template-ciudad.astro src/pages/menu-digital-restaurantes-tuciudad.astro
```

### 3️⃣ Editar slug
Abre: `src/pages/menu-digital-restaurantes-tuciudad.astro`

Línea 18, cambia:
```typescript
const CITY_SLUG = "tuciudad";
```

### 4️⃣ Agregar link en página principal
Abre: `src/pages/menu-digital-restaurantes.astro`

Agrega antes de "Próximamente":
```astro
<a 
  href="/menu-digital-restaurantes-tuciudad"
  class="group p-6 rounded-2xl border border-default bg-[var(--color-bg)] hover:bg-[var(--color-bg-soft)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
>
  <h3 class="text-xl font-semibold mb-2 group-hover:text-[var(--color-accent)] transition">
    📍 Tu Ciudad
  </h3>
  <p class="text-sm text-muted mb-4">
    Tu Región
  </p>
  <p class="text-sm text-muted">
    Menús digitales para restaurantes en Tu Ciudad.
  </p>
  <div class="mt-4 text-sm font-medium text-[var(--color-accent)] group-hover:underline">
    Ver más →
  </div>
</a>
```

### ✅ Listo!

Prueba en desarrollo:
```bash
npm run dev
```

Visita: `http://localhost:4321/menu-digital-restaurantes-tuciudad`

---

## 📋 Checklist

- [ ] Datos agregados en `cities.ts`
- [ ] Página creada con el nombre correcto
- [ ] Slug actualizado en la página
- [ ] Link agregado en página principal
- [ ] Probado en desarrollo
- [ ] Número de WhatsApp actualizado
- [ ] Schema.org validado en [Google Rich Results](https://search.google.com/test/rich-results)

## 🎯 URLs a verificar

- `/menu-digital-restaurantes` - Página principal
- `/menu-digital-restaurantes-tuciudad` - Tu nueva página
- Compartir en WhatsApp/Facebook para ver Open Graph

## 💡 Pro Tips

1. **Keywords relevantes**: Incluye nombres de barrios populares
2. **Contexto local**: Menciona características únicas de la ciudad
3. **Imágenes**: Considera agregar fotos de restaurantes locales
4. **Testimonios**: Agrega reseñas de clientes de esa ciudad si tienes

## 🐛 Troubleshooting

**Error 404**: Verifica que el nombre del archivo coincida con el slug en cities.ts

**No se ve el contenido**: Asegúrate de que el CITY_SLUG sea exactamente igual al slug en cities.ts (case-sensitive)

**Schema no válido**: Verifica que todos los campos requeridos estén completos en cities.ts
