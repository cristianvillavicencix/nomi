import { useState } from "react";
import { ChevronLeft, MoreHorizontal, Pencil } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { RecordContextProvider } from "ra-core";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PageActions,
  PageActionsTrailing,
} from "@/components/atomic-crm/layout/PageActions";
import type { Contact } from "@/components/atomic-crm/types";
import { getClientsListPath } from "@/app/routing";
import { isLeadLifecycleStatus } from "@/modules/constants/contactStatus";
import { ContactFormDialog } from "@/modules/contacts/ContactFormDialog";
import { ConvertLeadButton } from "@/modules/leads/ConvertLeadButton";
import { CreateProposalButton } from "@/modules/proposals/CreateProposalButton";

type ContactShowActionsProps = {
  record: Contact;
  onContactUpdated?: () => void;
};

export const ContactShowActions = ({
  record,
  onContactUpdated,
}: ContactShowActionsProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const listPath = location.state?.from ?? getClientsListPath();
  const isLead = isLeadLifecycleStatus(record.status);

  return (
    <>
      <ContactFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
        onUpdated={() => onContactUpdated?.()}
      />

      <PageActions>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 link-action"
          onClick={() => navigate(listPath)}
        >
          <ChevronLeft className="size-4" />
          <span className="text-sm font-semibold">Accounts</span>
        </Button>
      </PageActions>

      <PageActionsTrailing>
        <CreateProposalButton
          contactId={record.id}
          companyId={record.company_id}
          variant="secondary"
        />
        {isLead ? <ConvertLeadButton record={record} /> : null}
        <RecordContextProvider value={record}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton className="size-9" aria-label="More options">
                <MoreHorizontal className="size-4" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RecordContextProvider>
      </PageActionsTrailing>
    </>
  );
};
