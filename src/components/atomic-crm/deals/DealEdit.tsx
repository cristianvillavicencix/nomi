import {
  EditBase,
  Form,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
} from "ra-core";
import { Link } from "react-router";
import { CancelButton } from "@/components/admin/cancel-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { SaveButton } from "@/components/admin/form";
import {
  FormGuardProvider,
  useGuardedDialogClose,
} from "@/components/admin/form-guard";
import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { clearFormDraft } from "@/lib/formPersistence/formDraftStorage";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import type { Deal } from "../types";
import { DealInputs } from "./DealInputs";
import { syncProjectAssignments } from "./projectAssignments";
import { normalizeProjectPayload } from "./projectForm";
import { isLbsMode } from "@/lbs/productMode";

const dealEditDraftKey = (id: string) => `crm:deal-edit:${id}`;

export const DealEdit = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const notify = useNotify();
  const dataProvider = useDataProvider();

  const handleClose = () => {
    redirect("/deals", undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  if (!open || !id) return null;

  return (
    <EditBase
      id={id}
      mutationMode="pessimistic"
      mutationOptions={{
        onSuccess: async (deal: Deal) => {
          clearFormDraft(dealEditDraftKey(String(id)));
          if (!isLbsMode()) {
            try {
              await syncProjectAssignments(
                dataProvider,
                deal.id,
                deal.salesperson_ids,
                deal.subcontractor_ids,
              );
            } catch {
              notify(
                "Project updated, but assignments could not be fully synced",
                {
                  type: "warning",
                },
              );
            }
          }
          notify("Project updated");
          redirect(`/deals/${id}/show`, undefined, undefined, undefined, {
            _scrollToTop: false,
          });
        },
      }}
    >
      <Form>
        <FormGuardProvider draftKey={dealEditDraftKey(String(id))} enabled>
          <DealEditDialogShell onClose={handleClose} />
        </FormGuardProvider>
      </Form>
    </EditBase>
  );
};

const DealEditDialogShell = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const guardedClose = useGuardedDialogClose((next) => {
    if (!next) onClose();
  });

  return (
    <Dialog open onOpenChange={guardedClose}>
      <DialogContent className="lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <EditHeader />
        <DealInputs />
        <div
          role="toolbar"
          className="sticky flex pt-4 pb-4 md:pb-0 bottom-0 bg-linear-to-b from-transparent to-card to-10% flex-row justify-end gap-2"
        >
          <CancelButton onClick={() => guardedClose(false)} />
          <SaveButton
            type="button"
            transform={normalizeProjectPayload}
            label="Save project"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

function EditHeader() {
  const deal = useRecordContext<Deal>();
  if (!deal) {
    return null;
  }

  return (
    <DialogTitle className="pb-0">
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <ReferenceField source="company_id" reference="companies" link="show">
            <CompanyAvatar />
          </ReferenceField>
          <h2 className="text-2xl font-semibold">Edit {deal.name} project</h2>
        </div>
        <div className="flex gap-2 pr-12">
          <DeleteButton />
          <Button asChild variant="outline" className="h-9">
            <Link to={`/deals/${deal.id}/show`}>Back to project</Link>
          </Button>
        </div>
      </div>
    </DialogTitle>
  );
}
