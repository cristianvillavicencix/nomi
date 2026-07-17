const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildTicketDeliveryEmailHtml = (params: {
  orgName: string;
  invoiceNumber: string;
  propertyAddress: string;
  fileNames: string[];
  downloadLinks?: Array<{ name: string; url: string }>;
}) => {
  const hasLinks = (params.downloadLinks?.length ?? 0) > 0;
  const filesHtml = hasLinks
    ? `<ul style="margin:12px 0;padding-left:20px;">${params.downloadLinks!
        .map(
          (file) =>
            `<li style="margin:6px 0;"><a href="${escapeHtml(file.url)}" style="color:#2563eb;">${escapeHtml(file.name)}</a></li>`,
        )
        .join("")}</ul>`
    : params.fileNames.length > 0
      ? `<ul style="margin:12px 0;padding-left:20px;">${params.fileNames
          .map((name) => `<li style="margin:4px 0;">${escapeHtml(name)}</li>`)
          .join("")}</ul>`
      : "<p>Your supplement files are ready.</p>";

  const deliveryLine = hasLinks
    ? `<p>Your supplement files for <strong>${escapeHtml(params.propertyAddress)}</strong> are ready to download (links expire in 7 days):</p>`
    : `<p>Your supplement files for <strong>${escapeHtml(params.propertyAddress)}</strong> are attached to this email:</p>`;

  return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      <p>Thank you for your payment (<strong>${escapeHtml(params.invoiceNumber)}</strong>).</p>
      ${deliveryLine}
      ${filesHtml}
      <p style="color:#64748b;font-size:13px;">${escapeHtml(params.orgName)}</p>
    </div>`;
};
