type Row = {
  purpose: string;
  address: string;
};

type Props = {
  billingFromPreview: string | null;
  generalFromPreview: string | null;
  ticketInboxEmail: string | null;
};

export const EmailSenderBreakdown = ({
  billingFromPreview,
  generalFromPreview,
  ticketInboxEmail,
}: Props) => {
  const billing = billingFromPreview?.trim() || "Not configured";
  const general = generalFromPreview?.trim() || "Not configured";
  const ticketInbox = ticketInboxEmail?.trim() || "supplements@lbs.bz";

  const rows: Row[] = [
    { purpose: "Invoices & payment links", address: billing },
    { purpose: "Portal access codes & meetings", address: general },
    { purpose: "Ticket replies (outbound)", address: ticketInbox },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">Who sends what</p>
      <div className="overflow-hidden rounded-lg border text-xs">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Purpose</th>
              <th className="px-3 py-2 font-medium">From</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.purpose} className="border-b last:border-0">
                <td className="px-3 py-2 align-top text-foreground">
                  {row.purpose}
                </td>
                <td className="px-3 py-2 align-top font-mono text-[11px] text-foreground">
                  {row.address}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Each address must be verified in Twilio Console → Email. Ticket inbox
        is configured in the row below.
      </p>
    </div>
  );
};
