import { useGetList } from "ra-core";
import { Link } from "react-router";
import { Handshake } from "lucide-react";
import type { Contact } from "@/components/atomic-crm/types";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { getPersonShowPath } from "@/lbs/routing";

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((entry) => entry.email?.trim())?.email ?? "—";
const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((entry) => entry.number?.trim())?.number ?? "—";

/**
 * Lists every contact referred by the given person or company. Used as a
 * "Referidos" tab inside both contact (LeadShowPage) and company profiles.
 */
export const ReferralsTab = ({
  referrerContactId,
  referrerCompanyId,
}: {
  referrerContactId?: string | number | null;
  referrerCompanyId?: string | number | null;
}) => {
  const filter: Record<string, unknown> = {};
  if (referrerContactId != null) {
    filter["referred_by_contact_id@eq"] = referrerContactId;
  } else if (referrerCompanyId != null) {
    filter["referred_by_company_id@eq"] = referrerCompanyId;
  } else {
    filter["id@eq"] = -1;
  }

  const { data, isPending } = useGetList<Contact>("contacts", {
    filter,
    sort: { field: "last_seen", order: "DESC" },
    pagination: { page: 1, perPage: 50 },
  });

  if (isPending) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Cargando referidos...
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        <Handshake className="mx-auto mb-2 size-5 opacity-60" />
        Todavía no ha referido leads. Cuando se cree un lead con fuente
        "Referido" apuntando aquí, aparecerá en esta pestaña.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium"></th>
            <th className="px-4 py-3 text-left font-medium">Lead</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Service</th>
            <th className="px-4 py-3 text-left font-medium">Email</th>
            <th className="px-4 py-3 text-left font-medium">Phone</th>
          </tr>
        </thead>
        <tbody>
          {data.map((contact) => {
            const fullName =
              `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
              "Unnamed";
            return (
              <tr
                key={contact.id}
                className="border-t border-border transition-colors hover:bg-muted/30"
              >
                <td className="w-[52px] px-4 py-3">
                  <Avatar record={contact} width={25} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={getPersonShowPath(contact)}
                    className="link-action font-medium"
                  >
                    {fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {contact.status ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {contact.interested_service ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {getPrimaryEmail(contact)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {getPrimaryPhone(contact)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
