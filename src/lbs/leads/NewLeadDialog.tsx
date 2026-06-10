import { useState } from "react";
import {
  Form,
  useCreate,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import { TextInput } from "@/components/admin/text-input";
import {
  FormGuardProvider,
  useGuardedDialogClose,
} from "@/components/admin/form-guard";
import { DialogFormSubmitButton } from "@/components/admin/form-guard/DialogFormSubmitButton";
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
import { X } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { clearFormDraft } from "@/lib/formPersistence/formDraftStorage";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { ContactDuplicateResolveDialog } from "@/lbs/contacts/ContactDuplicateResolveDialog";
import {
  findMatchingContacts,
  type CreateDuplicateMatch,
} from "@/lbs/contacts/contactDuplicateUtils";
import { getLeadShowPath } from "@/lbs/routing";
import {
  buildCompanyCreateData,
  buildContactCreatePayload,
} from "./buildCreateLeadPayload";
import { LeadCompanySection } from "./LeadCompanySection";
import { LeadContactSection } from "./LeadContactSection";
import { LeadFormSection } from "./LeadFormSection";
import { LeadInfoSection } from "./LeadInfoSection";
import { LeadTypeToggle } from "./LeadTypeToggle";
import {
  defaultNewLeadFormValues,
  type NewLeadFormValues,
} from "./newLeadFormTypes";
import { validateNewLeadForm } from "./newLeadFormValidation";

const NEW_LEAD_DRAFT_KEY = "lbs:new-lead";
const NEW_LEAD_FORM_ID = "lbs-new-lead-form";

const shouldCreateContactPerson = (values: NewLeadFormValues) =>
  values.lead_type === "individual" ||
  (values.lead_type === "business" && values.add_primary_contact);

const getLeadFormChannels = (values: NewLeadFormValues) => ({
  first_name: values.first_name,
  last_name: values.last_name,
  email: values.email_jsonb.find((row) => row.email?.trim())?.email ?? "",
  phone: values.phone_jsonb.find((row) => row.number?.trim())?.number ?? "",
});

type NewLeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const NewLeadDialog = ({ open, onOpenChange }: NewLeadDialogProps) => {
  const isMobile = useIsMobile();
  const [isSaving, setIsSaving] = useState(false);
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [create] = useCreate();
  const [duplicateMatches, setDuplicateMatches] = useState<
    CreateDuplicateMatch[]
  >([]);
  const [duplicatePromptOpen, setDuplicatePromptOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<NewLeadFormValues | null>(
    null,
  );

  const finishLeadCreate = async (values: NewLeadFormValues) => {
    let companyId: number | string | null = null;
    let companyName = "";

    if (values.lead_type === "business") {
      const created = (await create(
        "companies",
        {
          data: buildCompanyCreateData(values, identity?.id),
        },
        { returnPromise: true },
      )) as Company;
      companyId = created?.id ?? null;
      companyName = values.company_draft_name.trim();
    }

    const payload = buildContactCreatePayload(values, companyId, companyName);
    const contact = await create(
      "contacts",
      { data: payload },
      { returnPromise: true },
    );

    clearFormDraft(NEW_LEAD_DRAFT_KEY);
    notify("Lead created", { type: "info" });
    refresh();
    onOpenChange(false);
    if (contact?.id != null) {
      navigate(getLeadShowPath(contact.id));
    }
  };

  const handleSubmit = async (values: NewLeadFormValues) => {
    try {
      const validation = validateNewLeadForm(values);
      if (!validation.ok) {
        notify(validation.message, { type: "warning" });
        return;
      }

      if (shouldCreateContactPerson(values)) {
        const matches = await findMatchingContacts(
          dataProvider,
          getLeadFormChannels(values),
        );
        if (matches.length > 0) {
          setPendingValues(values);
          setDuplicateMatches(matches);
          setDuplicatePromptOpen(true);
          return;
        }
      }

      setIsSaving(true);
      await finishLeadCreate(values);
    } catch (error) {
      console.error("[NewLeadDialog] create failed", error);
      notify(
        error instanceof Error ? error.message : "Failed to create lead",
        { type: "error" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseExistingContact = (contact: Contact) => {
    clearFormDraft(NEW_LEAD_DRAFT_KEY);
    refresh();
    onOpenChange(false);
    navigate(getLeadShowPath(contact.id));
  };

  if (!open) return null;

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-xl md:max-w-2xl",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        <Form
          id={NEW_LEAD_FORM_ID}
          className="flex min-h-0 flex-1 flex-col"
          defaultValues={defaultNewLeadFormValues(identity?.id)}
          onSubmit={handleSubmit}
        >
          <FormGuardProvider draftKey={NEW_LEAD_DRAFT_KEY} enabled>
            <NewLeadDialogBody
              isMobile={isMobile}
              isSaving={isSaving}
              onOpenChange={onOpenChange}
            />
          </FormGuardProvider>
        </Form>
      </DialogContent>
    </Dialog>

      <ContactDuplicateResolveDialog
        open={duplicatePromptOpen}
        onOpenChange={setDuplicatePromptOpen}
        matches={duplicateMatches}
        pending={pendingValues ? getLeadFormChannels(pendingValues) : {}}
        onUseExisting={handleUseExistingContact}
        onCreateAnyway={async () => {
          if (!pendingValues) return;
          setIsSaving(true);
          try {
            await finishLeadCreate(pendingValues);
          } finally {
            setIsSaving(false);
          }
        }}
      />
    </>
  );
};

const NewLeadDialogBody = ({
  isMobile,
  isSaving,
  onOpenChange,
}: {
  isMobile: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const guardedClose = useGuardedDialogClose(onOpenChange);
  const leadType = useWatch<NewLeadFormValues, "lead_type">({ name: "lead_type" });
  const addPrimaryContact = useWatch<NewLeadFormValues, "add_primary_contact">({
    name: "add_primary_contact",
  });

  const showCompany = leadType === "business";
  const showContact =
    leadType === "individual" ||
    (leadType === "business" && addPrimaryContact);

  return (
    <>
      <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
        <DialogTitle>New lead</DialogTitle>
        <DialogDescription>
          Lead type, company or contact, source, and assignment.
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
        <div className="flex flex-col gap-4">
          <LeadTypeToggle />

          {showCompany ? (
            <LeadFormSection title="Company" collapsible={false}>
              <LeadCompanySection />
            </LeadFormSection>
          ) : null}

          {showContact ? (
            <LeadFormSection title="Contact" collapsible={false}>
              <LeadContactSection />
            </LeadFormSection>
          ) : null}

          <LeadFormSection title="Lead details" collapsible={false}>
            <LeadInfoSection />
          </LeadFormSection>

          <LeadFormSection title="Notes" defaultOpen={false}>
            <TextInput
              source="background"
              label="Notes"
              multiline
              helperText={false}
            />
          </LeadFormSection>
        </div>
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
          formId={NEW_LEAD_FORM_ID}
          disabled={isSaving}
          className={isMobile ? "w-full" : ""}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create lead"
          )}
        </DialogFormSubmitButton>
      </DialogFooter>
    </>
  );
};
