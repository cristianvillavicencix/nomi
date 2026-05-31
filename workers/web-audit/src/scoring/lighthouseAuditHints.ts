/** Spanish fix hints keyed by Lighthouse audit id. */
export const LIGHTHOUSE_FIX_HINTS: Record<string, string> = {
  "render-blocking-resources":
    "Mueve CSS/JS crítico inline o difiere scripts con async/defer. Elimina archivos que bloquean el primer pintado.",
  "unused-css-rules":
    "Elimina CSS no usado o divide estilos por página. En WordPress revisa plugins que cargan CSS global.",
  "unused-javascript":
    "Quita JS no usado, code-split por ruta y evita librerías pesadas en la home.",
  "uses-optimized-images":
    "Convierte imágenes a WebP/AVIF, comprime y sirve tamaños responsive (srcset).",
  "uses-responsive-images":
    "Usa srcset/sizes para no servir imágenes gigantes en móvil.",
  "offscreen-images":
    "Aplica lazy-loading a imágenes below-the-fold.",
  "uses-text-compression":
    "Activa gzip/brotli en el servidor o CDN.",
  "uses-rel-preconnect":
    "Añade preconnect a dominios externos críticos (fuentes, analytics, CDN).",
  "server-response-time":
    "Mejora TTFB: hosting más rápido, caché, menos trabajo en PHP/Laravel al primer byte.",
  "total-byte-weight":
    "Reduce peso total: menos imágenes/videos, minifica assets, quita plugins innecesarios.",
  "dom-size":
    "Simplifica el HTML: menos nodos anidados, evita widgets que inflan el DOM.",
  "legacy-javascript":
    "Transpila solo lo necesario; evita polyfills duplicados para navegadores modernos.",
  "document-title":
    "Agrega <title> único con marca + servicio principal (50–60 caracteres).",
  "meta-description":
    "Escribe meta description de 120–160 caracteres con propuesta de valor y ciudad.",
  "link-text":
    "Evita enlaces genéricos (“clic aquí”); usa texto descriptivo del destino.",
  "is-crawlable":
    "Quita noindex si la página debe posicionar; revisa robots meta y X-Robots-Tag.",
  "robots-txt":
    "Publica /robots.txt válido y no bloquees URLs importantes.",
  "hreflang":
    "Si hay varios idiomas, define hreflang correctamente.",
  "canonical":
    "Define link rel=canonical para evitar contenido duplicado.",
  "structured-data":
    "Añade JSON-LD (LocalBusiness, Organization) con nombre, teléfono y dirección.",
  "image-alt":
    "Toda imagen informativa necesita atributo alt descriptivo.",
  "color-contrast":
    "Sube contraste texto/fondo a WCAG AA (4.5:1 cuerpo, 3:1 títulos grandes).",
  "heading-order":
    "No saltes niveles de encabezado (H1 → H2 → H3).",
  "label":
    "Asocia <label> a inputs o usa aria-label en campos de formulario.",
  "button-name":
    "Botones e iconos clicables necesitan nombre accesible (texto o aria-label).",
  "link-name":
    "Enlaces e iconos sociales necesitan texto visible o aria-label.",
  "uses-https":
    "Sirve todo el sitio por HTTPS con certificado válido.",
  "is-on-https":
    "Corrige mixed content: carga recursos http:// solo por https://.",
  "viewport":
    "Meta viewport: width=device-width, initial-scale=1.",
  "font-display":
    "Usa font-display: swap en @font-face para evitar texto invisible.",
  "largest-contentful-paint-element":
    "Optimiza el elemento LCP (hero): imagen comprimida, preload, sin lazy en above-the-fold.",
  "layout-shift-elements":
    "Reserva espacio (width/height) para imágenes y embeds para evitar saltos CLS.",
};

export const lighthouseFixHint = (auditId: string, fallback?: string | null) =>
  LIGHTHOUSE_FIX_HINTS[auditId] ??
  fallback ??
  "Revisa la auditoría en Lighthouse DevTools para el paso técnico exacto.";
