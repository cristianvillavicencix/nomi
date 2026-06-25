import { useState } from "react";
import {
  Form,
  useCreate,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import { useNavigate } from "react-router";
import {
  FormGuardProvider,
  useGuardedDialogClose,
} from "@/components/admin/form-guard";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { clearFormDraft } from "@/lib/formPersistence/formDraftStorage";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { ContactDuplicateResolveDialog } from "@/modules/contacts/ContactDuplicateResolveDialog";
import {
  findMatchingContacts,
  type CreateDuplicateMatch,
} from "@/modules/contacts/contactDuplicateUtils";
import { Target } from "lucide-react";
import {
  PersonFormFields,
  defaultPersonFormValues,
} from "@/modules/contacts/PersonFormFields";
import { CreateFormDialogShell } from "@/modules/shared/createForm/CreateFormDialogShell";
import type { PersonFormValues } from "@/modules/contacts/personFormTypes";
import { getLeadShowPath } from "@/app/routing";
import {
  buildCompanyCreateData,
  buildContactCreatePayload,
} from "./buildCreateLeadPayload";
import type { NewLeadFormValues } from "./newLeadFormTypes";
import { personFormValuesToNewLeadForm } from "./personFormToLeadPayload";
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
    } else if (values.company_id != null && values.company_id !== "") {
      companyId = values.company_id;
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

  const handleSubmit = async (values: PersonFormValues) => {
    const leadValues = personFormValuesToNewLeadForm(values);

    try {
      const validation = validateNewLeadForm(leadValues);
      if (!validation.ok) {
        notify(validation.message, { type: "warning" });
        return;
      }

      if (shouldCreateContactPerson(leadValues)) {
        const matches = await findMatchingContacts(
          dataProvider,
          getLeadFormChannels(leadValues),
        );
        if (matches.length > 0) {
          setPendingValues(leadValues);
          setDuplicateMatches(matches);
          setDuplicatePromptOpen(true);
          return;
        }
      }

      setIsSaving(true);
      await finishLeadCreate(leadValues);
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
            defaultValues={defaultPersonFormValues("pipeline", identity?.id)}
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

  return (
    <CreateFormDialogShell
      icon={Target}
      iconTone="amber"
      title="New lead"
      description="A new prospect for the pipeline. This is a contact with sales status."
      isSaving={isSaving}
      isMobile={isMobile}
      onClose={() => guardedClose(false)}
      submitLabel="Create lead"
      submitFormId={NEW_LEAD_FORM_ID}
    >
      <PersonFormFields mode="pipeline" variant="create" />
    </CreateFormDialogShell>
  );
};
