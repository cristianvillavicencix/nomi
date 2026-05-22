import { ShowBase } from "ra-core";
import { useParams } from "react-router";
import { ContactShowContent } from "@/components/atomic-crm/contacts/ContactShow";

export const LeadShowPage = () => {
  const { id } = useParams();
  if (!id) return null;

  return (
    <ShowBase resource="contacts" id={id}>
      <ContactShowContent />
    </ShowBase>
  );
};
