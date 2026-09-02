const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Overlay live client name + drawn signature onto filled agreement markdown. */
export const applyLiveClientSignatureFields = (
  markdown: string,
  params: {
    signatoryName?: string | null;
    signaturePng?: string | null;
  },
) => {
  const rawName = params.signatoryName?.trim() || "";
  const name = rawName || "—";
  const safeName = escapeHtml(name);
  const png = params.signaturePng?.trim() || "";
  const mark = png.startsWith("data:image/")
    ? `<img src="${png}" alt="Client signature" class="contract-signature-img" />`
    : `<span class="contract-signature-line" aria-hidden="true"></span>`;

  let out = markdown;
  out = out.replace(/\{\{client_representative\}\}/g, safeName);
  out = out.replace(/\{\{client_signature_mark\}\}/g, mark);
  out = out.replace(
    /<img\s+src="data:image\/[^"]+"\s+alt="Client signature"\s+class="contract-signature-img"\s*\/>/g,
    mark,
  );

  if (!/<img[^>]*alt="Client signature"/i.test(out)) {
    const empty =
      '<span class="contract-signature-line" aria-hidden="true"></span>';
    const idx = out.lastIndexOf(empty);
    if (idx >= 0) {
      out = out.slice(0, idx) + mark + out.slice(idx + empty.length);
    }
  }

  // Acceptance block: <p class="…">Por el Cliente</p> … <p><strong>NAME</strong></p>
  out = out.replace(
    /(Por el Cliente<\/p>\s*<div class="contract-signatures-mark">[\s\S]*?<\/div>\s*<p><strong>)([^<]*)(<\/strong><\/p>)/i,
    `$1${safeName}$3`,
  );

  // Narrative Partes: representado(a) por **NAME**
  out = out.replace(
    /(representado\(a\) por\s+)\*\*[^*]*\*\*/gi,
    `$1**${name}**`,
  );

  // Legacy labels if present
  out = out.replace(
    /(Por el Cliente[\s\S]*?\*\*Nombre:\*\*\s*)([^\n<]+)/i,
    `$1${name}`,
  );
  out = out.replace(
    /(Por el Cliente[\s\S]*?\*\*Name:\*\*\s*)([^\n<]+)/i,
    `$1${name}`,
  );

  return out;
};
