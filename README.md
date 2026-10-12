# ECKVEK Ingeniería SpA

Sitio corporativo estático en español. Conserva la portada, la galería y los canales de contacto; no necesita un backend ni una base de datos.

## Preparación y vista local

Requiere Node.js 22 o superior y npm.

```sh
npm ci
npx playwright install chromium firefox webkit
npm run build
npm run preview
```

La vista local está en http://127.0.0.1:4173. `npm run build` crea `dist/` con HTML, CSS, JavaScript, imágenes e iconos/fuentes locales y sus licencias. No se debe servir la raíz del repositorio: contiene herramientas y pruebas. Las fotografías originales se conservan; las páginas usan derivados WebP optimizados con dimensiones intrínsecas.

## Pruebas

```sh
npm test
npm audit --audit-level=high
```

`npm test` compila y ejecuta las tres suites en orden, deteniéndose ante cualquier fallo:

- `npm run test:static`: 7 controles de archivos/enlaces/anclas, IDs únicos, metadatos, recursos CSS, sintaxis JavaScript, distribución y presupuesto de imágenes (<1 MB por página).
- `npm run test:e2e`: 135 pruebas en Chromium, Firefox, WebKit y emulación móvil Android/iPhone. Revisa carga sin errores ni dependencias externas, menú y ARIA, teclado/foco del visor, cierres, accesibilidad automatizada WCAG 2.2 AA, funcionamiento sin JavaScript y sin IntersectionObserver, anchos de 320 a 1440 px, enlace de salto, animación y recuperación 404.
- `npm run test:load`: servidor aislado en loopback, 10/50/100 clientes concurrentes, 10 segundos por nivel más el tiempo de finalizar las visitas activas. Cada cliente descarga una página y sus recursos, comprueba HTTP 200, longitud y SHA-256. Umbrales por nivel: cero errores, p95 <1500 ms y p99 <3000 ms. También comprueba HEAD, 404, métodos y exposición de archivos internos.

Antes de ejecutar suites individuales, ejecutar `npm run build`. Playwright inicia su propio servidor; el puerto 4173 debe estar libre. Para Linux, usar `npx playwright install --with-deps chromium firefox webkit`.

Informes generados: `playwright-report/index.html`, `test-results/results.json` y `reports/load.json`. Se excluyen de Git. La prueba de carga mide el servidor local con archivos sin comprimir; no demuestra capacidad de Vercel/CDN ni latencias de Internet. Los controles de accesibilidad automatizados complementan una revisión manual, no certifican conformidad completa.

Si el cargador de Windows impide iniciar Firefox desde su caché (`SideBySide`/`mozglue`), se puede copiar íntegramente el navegador descargado a una ruta del workspace y establecer `PLAYWRIGHT_FIREFOX_EXECUTABLE` con la ruta absoluta a ese mismo `firefox.exe`. La configuración acepta ese override sin cambiar el navegador ni omitir sus pruebas. No requiere esta variable en CI.

## Despliegue

`vercel.json` configura instalación con `npm ci`, compilación con `npm run build` y publicación exclusiva de `dist/`. Incluye cabeceras contra inclusión en marcos, detección incorrecta de MIME, permisos innecesarios y una política CSP. `style-src` permite estilos inline por las reglas existentes y la gestión del visor; los scripts sólo se cargan desde el propio sitio.

En otro hosting estático, publicar únicamente `dist/` y configurar las cabeceras equivalentes y el documento de error `404.html`. Se mantienen las rutas existentes `/` y `/galeria.html`. Si cambia el dominio, actualizar canonical, Open Graph, `robots.txt` y `sitemap.xml`.

`.github/workflows/quality.yml` ejecuta las pruebas y la auditoría en pushes/PR y guarda informes. Sólo comprueba calidad; no contiene pasos de despliegue. Requerir el check `checks` en la protección de la rama principal para bloquear merges con fallos. Esa protección y los Deployment Checks se configuran en GitHub/Vercel, no quedan activados por añadir este archivo.

## Estructura

```text
index.html / galeria.html / 404.html
css/              Estilos compartidos y por página
js/main.js        Menú, visor nativo y reveal progresivo
js/lightning.js   Canvas: límite 30 FPS, pausa fuera de vista y pestaña oculta
img/              Originales y derivados WebP
scripts/          Compilación y servidor de vista local
 tests/           Controles estáticos, navegador y carga
vercel.json       Compilación y cabeceras
```

El menú mantiene su estado accesible y cierra con Escape, clic fuera, selección de enlaces o cambio entre móvil/escritorio. El visor admite teclado, restaura foco y scroll, y conserva enlaces a las imágenes como alternativa sin JavaScript. El contenido es visible por defecto. La animación respeta reducción de movimiento y se desactiva en móvil.

Las descripciones de TE2, TE3 y TE4 se corrigieron según la documentación oficial de la [SEC](https://www.sec.cl/e-declarador/): alumbrado público, cercos eléctricos y puesta en servicio de generadoras residenciales, respectivamente. Las afirmaciones comerciales y las credenciales de la empresa deben ser mantenidas por su titular.

Las fuentes Inter se distribuyen bajo SIL OFL y Font Awesome Free bajo sus licencias originales, incluidas en `dist/vendor/`. Se mantienen los iconos existentes para preservar la presentación.

## Pulso eléctrico del hero en teléfonos

El canvas se omite cuando el ancho es ≤768 px o el dispositivo tiene puntero táctil principal sin hover, también en horizontal. La reducción de movimiento lo desactiva en cualquier dispositivo. El estado inicial usa una superficie 0×0: en estos casos no se crea el contexto 2D, ni los nodos, ni ResizeObserver, ni se programa requestAnimationFrame. El fondo y el contenido del hero siguen visibles.

En escritorio sólo se inicializa al entrar en la vista. Al quedar fuera de vista, ocultarse la pestaña o activarse una condición de omisión, se cancela el frame pendiente y se libera la superficie del canvas; al volver a un estado permitido se restaura. Las pruebas cuentan llamadas a contexto, ResizeObserver y requestAnimationFrame en portada y galería, en vertical/horizontal y con reducción de movimiento, además de comprobar pausa y reanudación.

## Optimización del dibujo eléctrico

La red utiliza 32 nodos, hasta 96 conexiones reutilizables y tres grupos de opacidad. Se actualizan las conexiones cada 100 ms, con coordenadas de nodos reutilizadas y halos cacheados. Se eliminan gradientes por fotograma y sombras por conexión; el pulso principal conserva el resplandor y utiliza Path2D. El movimiento y la duración del pulso dependen del tiempo transcurrido, con un máximo de 30 FPS. Se mantiene la inicialización diferida y la omisión en teléfonos.

Las pruebas de presupuesto de dibujo comprueban en ambas páginas que no se creen gradientes en el canvas principal por fotograma y que se realicen como máximo ocho trazos por fotograma (seis para la red y dos para el pulso), además del límite de FPS. No imponen tiempos absolutos de CPU, que dependen del hardware y del navegador.
