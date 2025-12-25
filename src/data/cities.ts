export interface CityData {
  name: string;
  slug: string;
  region: string;
  description: string;
  keywords: string[];
  localContext: string;
  neighborhoods?: string[];
  phone?: string;
}

export const cities: Record<string, CityData> = {
  valdivia: {
    name: "Valdivia",
    slug: "valdivia",
    region: "Región de Los Ríos",
    description: "Implementa un menú digital profesional para tu restaurante en Valdivia. Actualiza precios y platos en tiempo real sin reimpresiones.",
    keywords: [
      "menú digital Valdivia",
      "carta digital restaurante Valdivia",
      "menú QR Valdivia",
      "carta restaurante Valdivia",
      "menú digital Los Ríos"
    ],
    localContext: "Valdivia es conocida por su rica oferta gastronómica que combina tradiciones locales con influencias alemanas. MenuPro ayuda a los restaurantes valdivanos a modernizar su servicio manteniendo la calidez característica de la ciudad.",
    neighborhoods: [
      "Centro",
      "Collico",
      "Las Animas",
      "Isla Teja",
      "Niebla"
    ],
    phone: "+56912345678" // Actualiza con tu número
  },
  
  // Puedes agregar más ciudades fácilmente:
  /*
  santiago: {
    name: "Santiago",
    slug: "santiago",
    region: "Región Metropolitana",
    description: "Menú digital profesional para restaurantes en Santiago. Gestión simple de tu carta con código QR.",
    keywords: [
      "menú digital Santiago",
      "carta digital restaurante Santiago",
      "menú QR Santiago",
      "carta restaurante Santiago Centro"
    ],
    localContext: "Santiago concentra la mayor oferta gastronómica del país. MenuPro facilita la gestión de cartas digitales para restaurantes de todos los tamaños.",
    neighborhoods: [
      "Santiago Centro",
      "Providencia",
      "Las Condes",
      "Vitacura",
      "Ñuñoa"
    ],
    phone: "+56912345678"
  },
  */
};

// Helper para obtener datos de una ciudad
export function getCityData(citySlug: string): CityData | undefined {
  return cities[citySlug];
}

// Helper para generar el schema.org LocalBusiness
export function generateLocalBusinessSchema(city: CityData, businessName = "MenuPro") {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": businessName,
    "description": city.description,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": city.name,
      "addressRegion": city.region,
      "addressCountry": "CL"
    },
    "areaServed": {
      "@type": "City",
      "name": city.name
    },
    "telephone": city.phone || "",
    "priceRange": "$$",
    "serviceArea": {
      "@type": "GeoCircle",
      "geoMidpoint": {
        "@type": "GeoCoordinates",
        "addressLocality": city.name,
        "addressCountry": "CL"
      }
    }
  };
}

// Helper para generar el schema.org BreadcrumbList
export function generateBreadcrumbSchema(city: CityData, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Inicio",
        "item": "https://menupro.cl"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Menú Digital Restaurantes",
        "item": "https://menupro.cl/menu-digital-restaurantes"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": `Menú Digital ${city.name}`,
        "item": url
      }
    ]
  };
}
