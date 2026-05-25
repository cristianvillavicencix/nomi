import { Mail } from "lucide-react";
import type { PortalCopy } from "@/lbs/portal/portalI18n";
import type { PortalCorporateEmail } from "@/lbs/portal/portalTypes";

export const ClientCorporateEmailsSection = ({
  emails,
  copy,
}: {
  emails: PortalCorporateEmail[];
  copy: PortalCopy;
}) => {
  if (emails.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {copy.noCorporateEmails}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{copy.corporateEmailsIntro}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">{copy.emailColumn}</th>
              <th className="px-4 py-3 font-medium">{copy.emailNotesColumn}</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((entry) => (
              <tr key={entry.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium">
                    <Mail className="size-4 text-[#1E5FA8]" />
                    {entry.email}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {entry.config_notes || copy.corporateEmailPasswordHint}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
