import { useState } from "react";
import { ChevronLeft, MoreHorizontal, Pencil } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { RecordContextProvider } from "ra-core";
import { Button } from "@/components/ui/button";
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
import { ContactEditModal } from "@/components/atomic-crm/contacts/ContactEditModal";
import { ConvertLeadButton } from "@/lbs/leads/ConvertLeadButton";
import { CreateProposalButton } from "@/lbs/proposals/CreateProposalButton";
import { getLeadsListPath } from "@/lbs/routing";

export const LeadShowActions = ({ record }: { record: Contact }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const listPath = location.state?.from ?? getLeadsListPath();

  return (
    <>
      <ContactEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
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
          <span className="text-sm font-semibold">Leads</span>
        </Button>
      </PageActions>

      <PageActionsTrailing>
        <CreateProposalButton
          contactId={record.id}
          companyId={record.company_id}
          variant="outline"
        />
        <ConvertLeadButton record={record} />
        <RecordContextProvider value={record}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="More options"
              >
                <MoreHorizontal className="size-4" />
              </Button>
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
