import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, type Identifier } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact } from "@/modules/types";
import { resolveBookingShareUrl } from "@/modules/booking/bookingFormatUtils";

export const useSmsBookNowInsert = ({
  contact,
  dealId,
  onInsertLink,
}: {
  contact?: Contact | null;
  dealId?: Identifier | null;
  onInsertLink: (url: string, label: string) => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();

  const generateMutation = useMutation({
    mutationFn: () =>
      dataProvider.generateBookingLink({
        contactId: contact?.id != null ? Number(contact.id) : null,
        companyId:
          contact?.company_id != null ? Number(contact.company_id) : null,
        dealId: dealId != null ? Number(dealId) : null,
        organizationMemberId: identity?.id != null ? Number(identity.id) : null,
        expiresInDays: 30,
        baseUrl: window.location.origin,
      }),
    onSuccess: (result) => {
      const url = resolveBookingShareUrl(result, window.location.origin);
      onInsertLink(url, "Book now");
    },
  });

  return { generateMutation };
};
