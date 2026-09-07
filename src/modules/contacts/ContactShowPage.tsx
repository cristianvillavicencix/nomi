import { ShowBase } from "ra-core";
import { useParams } from "react-router";
import { ContactShowContent } from "@/modules/contacts/ContactShowContent";
import { isValidRecordId } from "@/lib/isValidRecordId";

export const LbsContactShowPage = () => {
  const { id } = useParams();
  if (!isValidRecordId(id)) return null;

  return (
    <ShowBase resource="contacts" id={id}>
      <ContactShowContent />
    </ShowBase>
  );
};
