import { useMemo, useState } from "react";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { Link } from "react-router";
import { Loader2, X } from "lucide-react";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
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
import type {
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  toStageChoices,
  getDefaultPipeline,
} from "@/components/atomic-crm/deals/pipelines";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { getDefaultDealStage } from "@/modules/deals/createDeal";
import { useLbsPipelineConfig } from "@/modules/deals/useLbsPipelineConfig";
import { CONTACT_STATUS_FILTER } from "@/modules/shared/relatedFilters";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const NEW_DEAL_FORM_ID = "lbs-new-deal-form";

type NewDealFormValues = {
  name: string;
  stage: string;
  amount?: number | null;
  expected_closing_date?: string | null;
  contact_id?: Identifier | null;
  organization_member_id?: Identifier | null;
  notes?: string;
};

type NewDealDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: Identifier;
  defaultContactId?: Identifier | null;
  onCreated?: (dealId: Identifier) => void;
};

const memberDisplayName = (member: OrganizationMember) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ").trim() ||
  member.email ||
  "Team member";

const getMemberOptionText = (member?: Partial<OrganizationMember>) => {
  if (!member) return "";
  const name = memberDisplayName(member as OrganizationMember);
  return member.email ? `${name} (${member.email})` : name;
};

export const NewDealDialog = ({
  open,
  onOpenChange,
  companyId,
  defaultContactId,
  onCreated,
}: NewDealDialogProps) => {
  const isMobile = useIsMobile();
  const [isSaving, setIsSaving] = useState(false);
  const pipelineConfig = useLbsPipelineConfig();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();

  const defaultStage = useMemo(
    () => getDefaultDealStage(pipelineConfig),
    [pipelineConfig],
  );

  const stageChoices = useMemo(() => {
    const pipeline = getDefaultPipeline(pipelineConfig);
    return toStageChoices(pipeline?.stages ?? []);
  }, [pipelineConfig]);

  const { data: companyContacts = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: {
        "company_id@eq": companyId,
        "status@in": CONTACT_STATUS_FILTER,
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: open && companyId != null, staleTime: 30_000 },
  );

  const contactChoices = useMemo(
    () =>
      companyContacts.map((contact) => ({
        id: contact.id,
        name: getContactFullName(contact),
      })),
    [companyContacts],
  );

  const defaultValues = useMemo(
    (): NewDealFormValues => ({
      name: "",
      stage: defaultStage,
      amount: undefined,
      expected_closing_date: undefined,
      contact_id: defaultContactId ?? companyContacts[0]?.id ?? null,
      organization_member_id: identity?.id ?? null,
      notes: "",
    }),
    [companyContacts, defaultContactId, defaultStage, identity?.id],
  );

  const handleSubmit = async (values: NewDealFormValues) => {
    const name = values.name.trim();
    if (!name) {
      notify("Deal name is required", { type: "warning" });
      return;
    }

    if (!values.organization_member_id) {
      notify("Owner is required", { type: "warning" });
      return;
    }

    setIsSaving(true);
    try {
      const { data: deal } = await dataProvider.createDeal({
        name,
        companyId,
        contactId: values.contact_id,
        organizationMemberId: values.organization_member_id,
        stage: values.stage,
        amount: values.amount,
        expectedClosingDate: values.expected_closing_date ?? null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      });

      refresh();
      onOpenChange(false);
      onCreated?.(deal.id);

      notify(
        <span>
          Deal created.{" "}
          <Link
            to={`/deals/${deal.id}/show`}
            className="font-medium underline underline-offset-2"
          >
            View deal
          </Link>
        </span>,
        { type: "info", autoHideDuration: 8000 },
      );
    } catch (error) {
      console.error("[NewDealDialog] create failed", error);
      notify(error instanceof Error ? error.message : "Failed to create deal", {
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-xl",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        <Form
          id={NEW_DEAL_FORM_ID}
          className="flex min-h-0 flex-1 flex-col"
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
        >
          <FormGuardProvider enabled={false}>
            <NewDealDialogBody
              isMobile={isMobile}
              isSaving={isSaving}
              stageChoices={stageChoices}
              contactChoices={contactChoices}
              onOpenChange={onOpenChange}
            />
          </FormGuardProvider>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const NewDealDialogBody = ({
  isMobile,
  isSaving,
  stageChoices,
  contactChoices,
  onOpenChange,
}: {
  isMobile: boolean;
  isSaving: boolean;
  stageChoices: Array<{ value: string; label: string }>;
  contactChoices: Array<{ id: Identifier; name: string }>;
  onOpenChange: (open: boolean) => void;
}) => {
  const guardedClose = useGuardedDialogClose(onOpenChange);

  return (
    <>
      <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
        <DialogTitle>New deal</DialogTitle>
        <DialogDescription>
          Create a pipeline deal for this client. Company and contact are
          pre-filled from this page.
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
          <TextInput
            source="name"
            label="Deal name"
            helperText={false}
            validate={(value) =>
              typeof value === "string" && value.trim().length > 0
                ? undefined
                : "Deal name is required"
            }
            labelVariant="floating"
          />
          <SelectInput
            source="stage"
            label="Stage"
            choices={stageChoices}
            helperText={false}
            labelVariant="floating"
          />
          <NumberInput
            source="amount"
            label="Amount"
            helperText={false}
            min={0}
            labelVariant="floating"
          />
          <DateInput
            source="expected_closing_date"
            label="Expected close date"
            helperText={false}
            labelVariant="floating"
          />
          <SelectInput
            source="contact_id"
            label="Primary contact"
            choices={contactChoices}
            optionText="name"
            optionValue="id"
            helperText={false}
            emptyText="No contacts for this company"
            labelVariant="floating"
          />
          <ReferenceInput
            source="organization_member_id"
            reference="organization_members"
            filter={{ "disabled@neq": true }}
          >
            <AutocompleteInput
              label="Owner"
              optionText={getMemberOptionText}
              helperText={false}
              validate={(value) => (value ? undefined : "Owner is required")}
              labelVariant="floating"
            />
          </ReferenceInput>
          <TextInput
            source="notes"
            label="Notes"
            multiline
            rows={3}
            helperText={false}
            labelVariant="floating"
          />
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
          variant="secondary"
          onClick={() => guardedClose(false)}
          disabled={isSaving}
          className={isMobile ? "w-full" : ""}
        >
          Cancel
        </Button>
        <DialogFormSubmitButton
          formId={NEW_DEAL_FORM_ID}
          disabled={isSaving}
          className={isMobile ? "w-full" : ""}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create deal"
          )}
        </DialogFormSubmitButton>
      </DialogFooter>
    </>
  );
};
