/** Overlay live client name + drawn signature onto filled agreement markdown. */
export const applyLiveClientSignatureFields = (
  markdown: string,
  params: {
    signatoryName?: string | null;
    signaturePng?: string | null;
  },
) => {
  const name = params.signatoryName?.trim() || "—";
  const png = params.signaturePng?.trim() || "";
  const mark = png.startsWith("data:image/")
    ? `<img src="${png}" alt="Client signature" class="contract-signature-img" />`
    : `<span class="contract-signature-line" aria-hidden="true"></span>`;

  let out = markdown;
  out = out.replace(/\{\{client_representative\}\}/g, name);
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
