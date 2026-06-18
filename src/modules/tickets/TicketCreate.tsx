import { useNavigate, useSearchParams } from "react-router";
import { NewTicketDialog } from "@/modules/tickets/NewTicketDialog";

export const TicketCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const defaultCompanyId = searchParams.get("company_id") ?? null;
  const defaultContactId = searchParams.get("contact_id") ?? null;

  return (
    <NewTicketDialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) navigate("/tickets");
      }}
      defaultCompanyId={defaultCompanyId}
      defaultContactId={defaultContactId}
    />
  );
};
