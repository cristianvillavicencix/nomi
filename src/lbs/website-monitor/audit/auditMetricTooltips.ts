export const METRIC_TOOLTIPS: Record<string, string> = {
  overall:
    "Puntuación general del sitio (0–100). Combina rendimiento, SEO, buenas prácticas y accesibilidad. Verde ≥90, naranja 50–89, rojo <50.",
  performance:
    "Qué tan rápido carga y responde la página. Incluye LCP, bloqueo del hilo principal y estabilidad visual.",
  seo: "Qué tan bien está optimizado el sitio para buscadores: títulos, meta, enlaces, indexación y datos estructurados.",
  bestPractices:
    "Seguridad, HTTPS, buenas prácticas de desarrollo y APIs modernas recomendadas por Google.",
  accessibility:
    "Facilidad de uso para personas con discapacidad: contraste, etiquetas, navegación por teclado y lectores de pantalla.",
  fcp: "First Contentful Paint: cuándo aparece el primer texto o imagen. Menos de 1,8 s suele ser bueno en móvil.",
  lcp: "Largest Contentful Paint: cuándo carga el elemento principal (hero, imagen grande). Objetivo <2,5 s.",
  cls: "Cumulative Layout Shift: cuánto “salta” el diseño mientras carga. Objetivo <0,1.",
  tbt: "Total Blocking Time: tiempo en que la página no responde por JavaScript pesado.",
  combined:
    "Promedio ponderado: 70% puntuación móvil + 30% desktop, para reflejar que la mayoría del tráfico es móvil.",
};
