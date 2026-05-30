import { ShowBase } from "ra-core";
import { useParams } from "react-router";
import { LeadShowContent } from "@/lbs/leads/LeadShowContent";

export const LeadShowPage = () => {
  const { id } = useParams();
  if (!id) return null;

  return (
    <ShowBase resource="contacts" id={id}>
      <LeadShowContent />
    </ShowBase>
  );
};
