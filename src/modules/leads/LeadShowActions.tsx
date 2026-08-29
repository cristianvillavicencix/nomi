import { useState } from "react";
import { ChevronLeft, Pencil } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  PageActions,
  PageActionsTrailing,
} from "@/components/atomic-crm/layout/PageActions";
import type { Contact } from "@/components/atomic-crm/types";
import { ConvertLeadButton } from "@/modules/leads/ConvertLeadButton";
import { LeadEditDialog } from "@/modules/leads/LeadEditDialog";
import { CreateProposalButton } from "@/modules/proposals/CreateProposalButton";
import { getLeadsListPath } from "@/app/routing";
import type { LeadStageId } from "@/modules/leads/leadStages";

export const LeadShowActions = ({
  record,
  embedded = false,
  kanbanStage = null,
}: {
  record: Contact;
  embedded?: boolean;
  kanbanStage?: LeadStageId | null;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const listPath =
    kanbanStage != null
      ? getLeadsListPath()
      : (location.state?.from ?? getLeadsListPath());
  const backLabel = kanbanStage != null ? "Board" : "Accounts";

  return (
    <>
      <LeadEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
      />

      {!embedded ? (
        <PageActions>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2 link-action"
            onClick={() => navigate(listPath)}
          >
            <ChevronLeft className="size-4" />
            <span className="text-sm font-semibold">{backLabel}</span>
          </Button>
        </PageActions>
      ) : null}

      <PageActionsTrailing>
        <CreateProposalButton
          contactId={record.id}
          companyId={record.company_id}
          variant="secondary"
        />
        <ConvertLeadButton record={record} />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-4" />
          Edit
        </Button>
      </PageActionsTrailing>
    </>
  );
};
