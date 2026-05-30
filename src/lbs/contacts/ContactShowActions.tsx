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
import { getContactsListPath } from "@/lbs/routing";

type ContactShowActionsProps = {
  record: Contact;
};

export const ContactShowActions = ({ record }: ContactShowActionsProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const listPath = location.state?.from ?? getContactsListPath();

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
          <span className="text-sm font-semibold">Contacts</span>
        </Button>
      </PageActions>

      <PageActionsTrailing>
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
