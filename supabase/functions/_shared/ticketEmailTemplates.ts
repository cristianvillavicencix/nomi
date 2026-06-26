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
}) => {
  const filesHtml =
    params.fileNames.length > 0
      ? `<ul style="margin:12px 0;padding-left:20px;">${params.fileNames
          .map((name) => `<li style="margin:4px 0;">${escapeHtml(name)}</li>`)
          .join("")}</ul>`
      : "<p>Your supplement files are attached to this email.</p>";

  return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      <p>Thank you for your payment (<strong>${escapeHtml(params.invoiceNumber)}</strong>).</p>
      <p>Your supplement files for <strong>${escapeHtml(params.propertyAddress)}</strong> are attached to this email:</p>
      ${filesHtml}
      <p style="color:#64748b;font-size:13px;">${escapeHtml(params.orgName)}</p>
    </div>`;
};
