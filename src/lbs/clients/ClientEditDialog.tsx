import { Form, useGetOne, type Identifier } from "ra-core";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FormGuardProvider,
  useGuardedDialogClose,
} from "@/components/admin/form-guard";
import { DialogFormSubmitButton } from "@/components/admin/form-guard/DialogFormSubmitButton";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { clearFormDraft } from "@/lib/formPersistence/formDraftStorage";
import type { Contact } from "@/components/atomic-crm/types";
import {
  ClientCreateFormFields,
  type ClientCreateFormValues,
} from "@/lbs/clients/ClientCreateForm";
import {
  companyToClientFormValues,
  emptyClientFormValues,
} from "@/lbs/clients/clientFormValues";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import { useUpdateClientSubmit } from "@/lbs/clients/useUpdateClientSubmit";

const clientEditDraftKey = (id: Identifier) => `lbs:client-edit:${id}`;
const clientEditFormId = (id: Identifier) => `lbs-edit-client-form-${id}`;

type ClientEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: Identifier;
};

export const ClientEditDialog = ({
  open,
  onOpenChange,
  companyId,
}: ClientEditDialogProps) => {
  const isMobile = useIsMobile();
  const draftKey = clientEditDraftKey(companyId);
  const formId = clientEditFormId(companyId);

  const { data: company, isPending: companyPending } =
    useGetOne<CompanyWithPrimaryContact>(
      "companies",
      { id: companyId },
      { enabled: open && companyId != null },
    );

  const { data: primaryContact, isPending: contactPending } =
    useGetOne<Contact>(
      "contacts",
      { id: company?.primary_contact_id ?? 0 },
      { enabled: open && !!company?.primary_contact_id },
    );

  const { submitClientUpdate, isSaving } = useUpdateClientSubmit(
    companyId,
    company?.primary_contact_id,
  );

  if (!open) return null;

  const isLoading =
    companyPending || (company?.primary_contact_id != null && contactPending);

  const defaultValues =
    company != null
      ? (companyToClientFormValues(company, primaryContact ?? null) ??
        emptyClientFormValues())
      : emptyClientFormValues();

  const handleSubmit = async (values: ClientCreateFormValues) => {
    const saved = await submitClientUpdate(values);
    if (!saved) return;
    clearFormDraft(draftKey);
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-xl md:max-w-3xl",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        {isLoading || !company ? (
          <div className="flex items-center justify-center px-6 py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading client…
          </div>
        ) : (
          <Form
            id={formId}
            key={String(company.id)}
            className="flex min-h-0 flex-1 flex-col"
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
          >
            <FormGuardProvider draftKey={draftKey} enabled>
              <ClientEditDialogBody
                formId={formId}
                isMobile={isMobile}
                isSaving={isSaving}
                companyId={company.id}
                primaryContact={primaryContact ?? null}
                onOpenChange={onOpenChange}
              />
            </FormGuardProvider>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ClientEditDialogBody = ({
  formId,
  isMobile,
  isSaving,
  companyId,
  primaryContact,
  onOpenChange,
}: {
  formId: string;
  isMobile: boolean;
  isSaving: boolean;
  companyId: Identifier;
  primaryContact: Contact | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const guardedClose = useGuardedDialogClose(onOpenChange);

  return (
    <>
      <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
        <DialogTitle>Edit company</DialogTitle>
        <DialogDescription>
          Update business details, primary contact, and billing information.
        </DialogDescription>
        <DialogClose
          className="absolute top-3.5 right-3.5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          disabled={isSaving}
          onClick={(event) => {
            event.preventDefault();
            guardedClose(false);
          }}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
        <ClientCreateFormFields
          mode="edit"
          companyId={companyId}
          primaryContact={primaryContact}
        />
      </div>

      <DialogFooter
        className={cn(
          "shrink-0 gap-2 border-t bg-muted/30 px-5 py-4 sm:px-6",
          isMobile && "flex-col-reverse sm:flex-col-reverse",
        )}
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => guardedClose(false)}
          disabled={isSaving}
          className={isMobile ? "w-full" : ""}
        >
          Cancel
        </Button>
        <DialogFormSubmitButton
          formId={formId}
          disabled={isSaving}
          className={isMobile ? "w-full" : ""}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </DialogFormSubmitButton>
      </DialogFooter>
    </>
  );
};
