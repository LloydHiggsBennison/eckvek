# ECKVEK® Ingeniería SpA — Sitio Web

Sitio web corporativo de **ECKVEK Ingeniería SpA**, empresa de instalaciones eléctricas certificadas SEC a nivel nacional.

## 🗂 Estructura del Proyecto

```
Vectec/
├── css/
│   ├── shared.css        → Estilos compartidos (variables, nav, botones, footer, lightbox)
│   ├── index.css         → Estilos específicos de la página principal
│   └── galeria.css       → Estilos específicos de la galería
├── js/
│   ├── lightning.js      → Efecto de rayos eléctricos (canvas)
│   ├── main.js           → Lógica de la página principal
│   └── galeria.js        → Lógica de la galería
├── img/
│   ├── eckvek-logo.png
│   ├── sec-badge.png
│   ├── trabajos/         → Imágenes de "Nuestros Trabajos"
│   └── galeria/          → Imágenes de la galería de proyectos
├── index.html            → Página principal
├── galeria.html          → Galería de trabajos
├── robots.txt            → Configuración para crawlers
├── sitemap.xml           → Mapa del sitio
└── README.md
```

## 🚀 Deploy

El sitio está diseñado para ser desplegado en **Vercel** como sitio estático:

1. Conectar el repositorio a Vercel
2. Framework Preset: `Other`
3. Build Command: (vacío)
4. Output Directory: `./`

## ⚡ Tecnologías

- HTML5 semántico
- CSS3 con variables personalizadas
- JavaScript vanilla (ES6+)
- Canvas API (efecto lightning)
- Font Awesome 5 para iconos
- Google Fonts (Inter)

## 📱 Características

- Diseño responsive (mobile-first breakpoints)
- Menú hamburguesa para dispositivos móviles
- Efecto de rayos eléctricos animado en el hero
- Lightbox para visualizar imágenes
- Animaciones de scroll reveal
- Botón flotante de WhatsApp
- Badge SEC fijo
- SEO optimizado (Open Graph, meta tags, sitemap)
