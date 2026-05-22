import { ShowBase } from "ra-core";
import { useParams } from "react-router";
import { ClientShowContent } from "./ClientShowContent";

export const ClientShowPage = () => {
  const { id } = useParams();
  if (!id) return null;

  return (
    <ShowBase resource="companies" id={id}>
      <ClientShowContent />
    </ShowBase>
  );
};
