import { ShowBase } from "ra-core";
import { useParams } from "react-router";
import { ContactShowContent } from "@/lbs/contacts/ContactShowContent";

export const LbsContactShowPage = () => {
  const { id } = useParams();
  if (!id) return null;

  return (
    <ShowBase resource="contacts" id={id}>
      <ContactShowContent />
    </ShowBase>
  );
};
