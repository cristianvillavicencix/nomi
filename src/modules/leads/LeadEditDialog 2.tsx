import type { Identifier } from "ra-core";
import {
  EditBase,
  Form,
  useEditContext,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFormContext } from "react-hook-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Contact } from "@/components/atomic-crm/types";
import {
  PersonFormFields,
  type PersonFormValues,
} from "@/modules/contacts/PersonFormFields";
import { CreateFormDialogShell } from "@/modules/shared/createForm/CreateFormDialogShell";
import {
  contactToLeadEditFormValues,
  leadEditTransform,
} from "@/modules/leads/leadEditForm";

const LEAD_EDIT_FORM_ID = "lbs-lead-edit-form";

const LeadEditFormInitializer = ({ record }: { record: Contact }) => {
  const form = useFormContext<PersonFormValues>();
  const recordId = String(record.id);

  useEffect(() => {
    form.reset(contactToLeadEditFormValues(record));
    // Only re-hydrate when switching to a different lead.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- record payload is tied to recordId
  }, [recordId]);

  return <PersonFormFields mode="pipeline" variant="full" />;
};

const LeadEditDialogLoaded = ({
  isSaving,
  isMobile,
  onClose,
}: {
  isSaving: boolean;
  isMobile: boolean;
  onClose: () => void;
}) => {
  const { record } = useEditContext<Contact>();
  if (!record) return null;

  return (
    <CreateFormDialogShell
      icon={Pencil}
      iconTone="amber"
      title="Edit lead"
      description="Update lead details, assignment, and pipeline info."
      isSaving={isSaving}
      isMobile={isMobile}
      onClose={onClose}
      submitLabel="Save changes"
      submitFormId={LEAD_EDIT_FORM_ID}
    >
      <LeadEditFormInitializer record={record} />
    </CreateFormDialogShell>
  );
};

const LeadEditDialogLoading = ({
  isMobile,
  onClose,
}: {
  isMobile: boolean;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  return (
    <CreateFormDialogShell
      icon={Pencil}
      iconTone="amber"
      title="Edit lead"
      description="Update lead details, assignment, and pipeline info."
      isSaving={false}
      isMobile={isMobile}
      onClose={onClose}
      submitLabel="Save changes"
    >
      <p className="py-8 text-center text-sm text-muted-foreground">
        {translate("ra.page.loading", { _: "Loading…" })}
      </p>
    </CreateFormDialogShell>
  );
};

const LeadEditDialogBody = ({
  isSaving,
  isMobile,
  onClose,
}: {
  isSaving: boolean;
  isMobile: boolean;
  onClose: () => void;
}) => {
  const { isPending, record } = useEditContext<Contact>();

  if (isPending || !record) {
    return <LeadEditDialogLoading isMobile={isMobile} onClose={onClose} />;
  }

  return (
    <LeadEditDialogLoaded
      isSaving={isSaving}
      isMobile={isMobile}
      onClose={onClose}
    />
  );
};

export type LeadEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: Identifier;
  onUpdated?: (contact: Contact) => void;
};

export const LeadEditDialog = ({
  open,
  onOpenChange,
  contactId,
  onUpdated,
}: LeadEditDialogProps) => {
  const isMobile = useIsMobile();
  const notify = useNotify();
  const refresh = useRefresh();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  if (!open || contactId == null) return null;

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-xl md:max-w-2xl",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        <EditBase
          resource="contacts"
          id={contactId}
          redirect={false}
          mutationMode="pessimistic"
          transform={leadEditTransform}
          mutationOptions={{
            onMutate: () => setIsSaving(true),
            onSuccess: async (saved) => {
              notify("Lead updated", { type: "info" });
              await queryClient.invalidateQueries({ queryKey: ["contacts"] });
              refresh();
              onUpdated?.(saved as Contact);
              handleClose();
            },
            onError: (error) =>
              notify(
                error instanceof Error ? error.message : "Failed to update lead",
                { type: "error" },
              ),
            onSettled: () => setIsSaving(false),
          }}
        >
          <Form id={LEAD_EDIT_FORM_ID} className="flex min-h-0 flex-1 flex-col">
            <LeadEditDialogBody
              isSaving={isSaving}
              isMobile={isMobile}
              onClose={handleClose}
            />
          </Form>
        </EditBase>
      </DialogContent>
    </Dialog>
  );
};
