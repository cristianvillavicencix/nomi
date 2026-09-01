import { Form, useGetIdentity, type Identifier } from "ra-core";
import { useNavigate } from "react-router";
import { Building2 } from "lucide-react";
import { useWatch } from "react-hook-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  FormGuardProvider,
  useGuardedDialogClose,
} from "@/components/admin/form-guard";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { clearFormDraft } from "@/lib/formPersistence/formDraftStorage";
import type { Company } from "@/components/atomic-crm/types";
import { ClientCreateStreamlinedFields } from "@/modules/clients/ClientCreateStreamlinedFields";
import { clientCreateFormValuesToCompanySnapshot } from "@/modules/clients/companySummary";
import { emptyClientFormValues } from "@/modules/clients/clientFormValues";
import { getClientShowPath } from "@/app/routing";
import { useCreateClientSubmit } from "@/modules/clients/useCreateClientSubmit";
import type { ClientCreateFormValues } from "@/modules/clients/ClientCreateForm";
import { CreateFormDialogShell } from "@/modules/shared/createForm/CreateFormDialogShell";
import { useCompanyNameDuplicateCheck } from "@/modules/clients/useCompanyNameDuplicateCheck";
import { CompanyNameDuplicateAlert } from "@/modules/clients/CompanyNameDuplicateAlert";
import type { PrimaryContactDraft } from "@/modules/clients/primaryContactDraft";

const COMPANY_CREATE_FORM_ID = "lbs-company-create-form";

export type CompanyCreateDialogResult = {
  companyId: Identifier;
  contactId?: Identifier | null;
  name: string;
  sector?: string;
  /** Display snapshot for inline pickers (address, phone, email). */
  company?: Company;
};

export type CompanyCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill business name (e.g. from contact company search). */
  initialCompanyName?: string;
  /** Prefill primary contact name when creating from a people search. */
  initialPrimaryContactName?: string;
  /** In-progress contact from a parent create form — preview only, not saved with the company. */
  linkingContactDraft?: PrimaryContactDraft | null;
  title?: string;
  description?: string;
  submitLabel?: string;
  /** When set, the dialog links back instead of navigating to the company page. */
  onCreated?: (result: CompanyCreateDialogResult) => void;
  /** Inline pickers: select an existing match instead of creating. */
  onUseExistingCompany?: (company: Company) => void;
  draftKey?: string;
  enableDraft?: boolean;
};

export const CompanyCreateDialog = ({
  open,
  onOpenChange,
  initialCompanyName = "",
  initialPrimaryContactName = "",
  linkingContactDraft = null,
  title = "New account",
  description,
  submitLabel = "Create account",
  onCreated,
  onUseExistingCompany,
  draftKey = "lbs:new-company",
  enableDraft = true,
}: CompanyCreateDialogProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { identity } = useGetIdentity();
  const { submitClientCreate, isSaving } = useCreateClientSubmit();
  const resolvedDescription =
    description ??
    (linkingContactDraft
      ? "Create the account record. The contact you're creating will be linked when you save the contact form."
      : "Create the account record. Add a primary contact later or from the People form.");

  const handleSubmit = async (values: ClientCreateFormValues) => {
    const result = await submitClientCreate(values);
    if (result == null) return;

    if (enableDraft) {
      clearFormDraft(draftKey);
    }

    if (onCreated) {
      onCreated({
        companyId: result.company_id,
        contactId: result.contact_id,
        name: values.company_name.trim(),
        sector: values.company_sector?.trim() || undefined,
        company: identity?.id
          ? clientCreateFormValuesToCompanySnapshot(
              result.company_id,
              values,
              identity.id,
            )
          : undefined,
      });
      onOpenChange(false);
      return;
    }

    onOpenChange(false);
    navigate(getClientShowPath(result.company_id));
  };

  if (!open) return null;

  return (
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
          id={COMPANY_CREATE_FORM_ID}
          key={`${open}-${initialCompanyName}-${initialPrimaryContactName}-${linkingContactDraft?.fullName ?? ""}`}
          className="flex min-h-0 flex-1 flex-col"
          defaultValues={{
            ...emptyClientFormValues(),
            company_name: initialCompanyName,
            primary_full_name: linkingContactDraft
              ? ""
              : initialPrimaryContactName,
            organization_member_id: identity?.id ?? null,
          }}
          onSubmit={handleSubmit}
        >
          <FormGuardProvider draftKey={draftKey} enabled={enableDraft}>
            <CompanyCreateDialogBody
              isMobile={isMobile}
              isSaving={isSaving}
              title={title}
              description={resolvedDescription}
              submitLabel={submitLabel}
              onOpenChange={onOpenChange}
              onUseExistingCompany={onUseExistingCompany}
              linkingContactPreview={linkingContactDraft}
            />
          </FormGuardProvider>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const CompanyCreateDialogBody = ({
  isMobile,
  isSaving,
  title,
  description,
  submitLabel,
  onOpenChange,
  onUseExistingCompany,
  linkingContactPreview,
}: {
  isMobile: boolean;
  isSaving: boolean;
  title: string;
  description: string;
  submitLabel: string;
  onOpenChange: (open: boolean) => void;
  onUseExistingCompany?: (company: Company) => void;
  linkingContactPreview?: PrimaryContactDraft | null;
}) => {
  const guardedClose = useGuardedDialogClose(onOpenChange);
  const companyName = useWatch<ClientCreateFormValues, "company_name">({
    name: "company_name",
  });
  const { duplicateCompany } = useCompanyNameDuplicateCheck(companyName ?? "");

  const handleUseExistingCompany = (company: Company) => {
    onUseExistingCompany?.(company);
    guardedClose(false);
  };

  return (
    <CreateFormDialogShell
      icon={Building2}
      iconTone="violet"
      title={title}
      description={description}
      isSaving={isSaving}
      isMobile={isMobile}
      onClose={() => guardedClose(false)}
      submitLabel={submitLabel}
      submitFormId={COMPANY_CREATE_FORM_ID}
      submitDisabled={Boolean(duplicateCompany)}
    >
      <ClientCreateStreamlinedFields
        linkingContactPreview={linkingContactPreview}
        duplicateNotice={
          duplicateCompany ? (
            <CompanyNameDuplicateAlert
              company={duplicateCompany}
              onUseExisting={
                onUseExistingCompany ? handleUseExistingCompany : undefined
              }
            />
          ) : null
        }
      />
    </CreateFormDialogShell>
  );
};
