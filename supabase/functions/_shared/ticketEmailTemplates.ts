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
  downloadLinks: Array<{ name: string; url: string }>;
}) => {
  const filesHtml = `<ul style="margin:12px 0;padding-left:20px;">${params.downloadLinks
    .map(
      (file) =>
        `<li style="margin:6px 0;"><a href="${escapeHtml(file.url)}" style="color:#2563eb;">${escapeHtml(file.name)}</a></li>`,
    )
    .join("")}</ul>`;

  return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      <p>Thank you for your payment (<strong>${escapeHtml(params.invoiceNumber)}</strong>).</p>
      <p>Your supplement files for <strong>${escapeHtml(params.propertyAddress)}</strong> are ready to download (links expire in 7 days):</p>
      ${filesHtml}
      <p style="color:#64748b;font-size:13px;">${escapeHtml(params.orgName)}</p>
    </div>`;
};
