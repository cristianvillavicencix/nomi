import { Form } from "ra-core";
import { useNavigate } from "react-router";
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
import {
  ClientCreateFormFields,
  type ClientCreateFormValues,
} from "@/modules/clients/ClientCreateForm";
import { emptyClientFormValues } from "@/modules/clients/clientFormValues";
import { getClientShowPath } from "@/app/routing";
import { useCreateClientSubmit } from "@/modules/clients/useCreateClientSubmit";

const NEW_CLIENT_DRAFT_KEY = "lbs:new-client";
const NEW_CLIENT_FORM_ID = "lbs-new-client-form";

type NewClientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const NewClientDialog = ({ open, onOpenChange }: NewClientDialogProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { submitClientCreate, isSaving } = useCreateClientSubmit();

  const handleSubmit = async (values: ClientCreateFormValues) => {
    const companyId = await submitClientCreate(values);
    if (companyId == null) return;
    clearFormDraft(NEW_CLIENT_DRAFT_KEY);
    onOpenChange(false);
    navigate(getClientShowPath(companyId));
  };

  if (!open) return null;

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
        <Form
          id={NEW_CLIENT_FORM_ID}
          className="flex min-h-0 flex-1 flex-col"
          defaultValues={emptyClientFormValues()}
          onSubmit={handleSubmit}
        >
          <FormGuardProvider draftKey={NEW_CLIENT_DRAFT_KEY} enabled>
            <NewClientDialogBody
              isMobile={isMobile}
              isSaving={isSaving}
              onOpenChange={onOpenChange}
            />
          </FormGuardProvider>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const NewClientDialogBody = ({
  isMobile,
  isSaving,
  onOpenChange,
}: {
  isMobile: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const guardedClose = useGuardedDialogClose(onOpenChange);

  return (
    <>
      <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
        <DialogTitle>New company</DialogTitle>
        <DialogDescription>
          Business details, primary contact, and billing information.
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
        <ClientCreateFormFields mode="create" />
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
          formId={NEW_CLIENT_FORM_ID}
          disabled={isSaving}
          className={isMobile ? "w-full" : ""}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Create company"
          )}
        </DialogFormSubmitButton>
      </DialogFooter>
    </>
  );
};
