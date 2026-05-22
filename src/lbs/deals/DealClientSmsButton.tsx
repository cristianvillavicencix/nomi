import { useMemo } from "react";
import { useGetOne } from "ra-core";
import type { Contact, Deal } from "@/components/atomic-crm/types";
import { OpenClientSmsButton } from "@/lbs/messages/OpenClientSmsButton";

export const DealClientSmsButton = ({ record }: { record: Deal }) => {
  const mainContactId = useMemo(() => {
    if (record.contact_id != null) return record.contact_id;
    if (Array.isArray(record.contact_ids) && record.contact_ids.length > 0) {
      return record.contact_ids[0];
    }
    return null;
  }, [record.contact_id, record.contact_ids]);

  const { data: mainContact } = useGetOne<Contact>(
    "contacts",
    { id: mainContactId as number },
    { enabled: mainContactId != null },
  );

  return <OpenClientSmsButton contact={mainContact} dealId={record.id} />;
};
