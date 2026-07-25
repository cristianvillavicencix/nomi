/** Minimal HTML fixtures for mail render regression tests (no real PII). */

export const MAIL_RENDER_FIXTURES = {
  googleNewsletter: `<!DOCTYPE html><html><head>
<style>
@import url(https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap);
.cta-button { background:#1a73e8; border-radius:4px; padding:12px 24px; }
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto" />
</head><body bgcolor="#f5f5f5">
<table width="600" cellpadding="0"><tr><td>
<h1 style="font-family:Roboto,sans-serif;color:#1a73e8;">Resumen de tu semana</h1>
<p>Gracias por compartir tu conocimiento local.</p>
<a class="cta-button" href="https://maps.google.com/contribute" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;">Hacer una contribución nueva</a>
<table width="100%" bgcolor="#fff9e6"><tr><td>Cómo fue tu semana</td></tr></table>
</td></tr></table>
</body></html>`,

  forwardedNested: `<html><head><style>.quote { color:#666; }</style></head><body>
<p>---------- Forwarded message ----------</p>
<html><head><style>.inner { width:600px; }</style></head><body>
<table width="600"><tr><td>Inner newsletter block</td></tr></table>
</body></html>
</body></html>`,

  inlineImages: `<body>
<img src="cid:logo@local" alt="inline" />
<img src="https://example.com/logo.png" alt="remote" width="120" height="40" />
</body>`,

  externalFontLink: `<head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans" />
<link rel="stylesheet" href="https://evil.example.com/steal.css" />
</head><body><p>Hello</p></body>`,

  hostingerTransactional: `<body>
<table width="600"><tr><td align="center">
<img src="https://www.hostinger.com/logo-400x400.png" alt="Hostinger logo" width="64" height="64" />
<h1>Your domain is ready</h1>
</td></tr></table>
</body>`,

  appleMailPlain: `<html><body style="overflow-wrap: break-word;">
<p style="margin: 0px; margin-block: 0px;">Hola Guillermo,</p>
<p style="margin: 0px; margin-block: 0px;"><br></p>
<p style="margin: 0px; margin-block: 0px;">Gracias por tu tiempo.</p>
<p style="margin: 0px; margin-block: 0px;">Saludos,</p>
</body></html>`,
} as const;
