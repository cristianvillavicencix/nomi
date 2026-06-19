import type { Identifier } from "ra-core";
import {
  CreateBase,
  EditBase,
  Form,
  useEditContext,
  useGetIdentity,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { Loader2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
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
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_CLIENT_STATUS } from "@/app/navigation";
import { getPersonShowPath } from "@/app/routing";
import type { PrimaryContactDraft } from "@/modules/clients/primaryContactDraft";
import {
  COMPANY_DRAFT_NAME_FIELD,
  COMPANY_DRAFT_SECTOR_FIELD,
  PRIMARY_MOVE_CONFIRMED_FIELD,
  hasCompanySelection,
  resolveContactCompanyForSave,
} from "@/modules/contacts/companyDraft";
import {
  compactContactFieldsToPayload,
  compactContactFullName,
  hasCompactContactName,
  LbsContactFormFields,
} from "@/modules/contacts/LbsContactFormFields";
import {
  LBS_LEAD_SOURCE_OTHER,
  LBS_LEAD_SOURCE_REFERRAL,
} from "@/modules/leads/leadFormConstants";
import { prepareContactWriteData } from "@/components/atomic-crm/providers/supabase/dataProviderWriteHelpers";
import { normalizeUsPhoneToE164 } from "@/utils/phone";

/** Hide company field in LbsContactFormFields while company is not created yet. */
export const PENDING_COMPANY_LOCK = "__pending_company__" as Identifier;

/** Avoid Radix aria-hidden warnings when focus returns to the ticket reply field. */
const contactDialogContentProps = {
  onCloseAutoFocus: (event: Event) => event.preventDefault(),
} as const;

type ContactFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog opens in edit mode for that contact id. */
  contactId?: Identifier;
  lockCompanyId?: Identifier;
  /**
   * When true, do not insert into the DB — return compact field values to the
   * parent (used by new-company flow so cancel never leaves orphan contacts).
   */
  deferCreate?: boolean;
  /** @deprecated Prefer deferCreate for new-company primary contact drafts. */
  allowOrphanContact?: boolean;
  title?: string;
  description?: string;
  submitLabel?: string;
  navigateOnCreate?: boolean;
  /** Merged into create form defaultValues (e.g. ticket sender prefill). */
  createDefaults?: Record<string, unknown>;
  onCreated?: (contact: Contact) => void;
  onDraftSubmit?: (draft: PrimaryContactDraft) => void;
  /** Called after a successful edit save (pessimistic — server confirmed). */
  onUpdated?: (contact: Contact) => void;
};

/** Normalize phone rows on submit so Save works even if the field was not blurred. */
const withSubmitNormalizedPhones = (data: Contact): Contact => ({
  ...data,
  phone_jsonb: data.phone_jsonb?.map((entry) => {
    const raw = String(entry.number ?? "").trim();
    if (!raw) {
      return entry;
    }
    const normalized = normalizeUsPhoneToE164(raw);
    return normalized ? { ...entry, number: normalized } : entry;
  }),
});

/** Strip referral/other fields that don't apply to the chosen lead source. */
const editTransform = (data: Contact): Partial<Contact> => {
  const normalized = withSubmitNormalizedPhones(data);
  const isReferral = normalized.lead_source === LBS_LEAD_SOURCE_REFERRAL;
  const isOther = normalized.lead_source === LBS_LEAD_SOURCE_OTHER;
  const prepared = prepareContactWriteData(
    normalized as unknown as Record<string, unknown>,
  ) as Partial<Contact>;
  return {
    ...prepared,
    referred_by_contact_id: isReferral
      ? (normalized.referred_by_contact_id ?? null)
      : null,
    referred_by_company_id: isReferral
      ? (normalized.referred_by_company_id ?? null)
      : null,
    lead_source_other: isOther ? (normalized.lead_source_other ?? null) : null,
  };
};

const defaultCreateValues = (lockCompanyId?: Identifier) => ({
  first_name: "",
  last_name: "",
  title: "",
  company_id:
    lockCompanyId === PENDING_COMPANY_LOCK ? null : (lockCompanyId ?? null),
  email_jsonb: [{ email: "", type: "Work" }],
  phone_jsonb: [{ number: "", type: "Work" }],
  address: "",
  status: LBS_CLIENT_STATUS,
  background: "",
  organization_member_id: undefined as Identifier | undefined,
  _compact_first_name: "",
  _compact_last_name: "",
  _compact_email: "",
  _compact_phone: "",
  [COMPANY_DRAFT_NAME_FIELD]: "",
  [COMPANY_DRAFT_SECTOR_FIELD]: "",
  [PRIMARY_MOVE_CONFIRMED_FIELD]: false,
});

const ContactFormDialogChrome = ({
  title,
  description,
  isSaving,
  isMobile,
  onClose,
  submitLabel,
  children,
}: {
  title: string;
  description: string;
  isSaving: boolean;
  isMobile: boolean;
  onClose: () => void;
  submitLabel: string;
  children: ReactNode;
}) => (
  <>
    <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <DialogClose
        className="absolute top-3.5 right-3.5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        disabled={isSaving}
        onClick={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <X className="size-4" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </DialogHeader>

    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
      {children}
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
        onClick={onClose}
        disabled={isSaving}
        className={isMobile ? "w-full" : ""}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={isSaving}
        className={isMobile ? "w-full" : ""}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Saving…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </DialogFooter>
  </>
);

export const ContactFormDialog = ({
  open,
  onOpenChange,
  contactId,
  lockCompanyId,
  deferCreate = false,
  allowOrphanContact = false,
  title,
  description = "Person linked to a client company. Company is required.",
  submitLabel,
  navigateOnCreate = true,
  createDefaults,
  onCreated,
  onDraftSubmit,
  onUpdated,
}: ContactFormDialogProps) => {
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const isEdit = contactId != null;
  const resolvedTitle = title ?? (isEdit ? "Edit contact" : "New contact");
  const resolvedSubmitLabel =
    submitLabel ?? (isEdit ? "Save changes" : "Create contact");

  const handleClose = () => {
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
    onOpenChange(false);
  };

  const formLockCompanyId = deferCreate
    ? PENDING_COMPANY_LOCK
    : allowOrphanContact
      ? PENDING_COMPANY_LOCK
      : lockCompanyId;

  if (!open) return null;

  const dialogShellClass = cn(
    "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
    "sm:max-w-xl md:max-w-3xl",
    isMobile &&
      "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
  );

  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className={dialogShellClass}
          {...contactDialogContentProps}
        >
          <EditBase
            resource="contacts"
            id={contactId}
            redirect={false}
            mutationMode="pessimistic"
            transform={editTransform}
            mutationOptions={{
              onMutate: () => setIsSaving(true),
              onSuccess: async (saved) => {
                notify("Contact updated", { type: "info" });
                await queryClient.invalidateQueries({ queryKey: ["contacts"] });
                refresh();
                onUpdated?.(saved as Contact);
                handleClose();
              },
              onError: (error) =>
                notify(
                  error instanceof Error
                    ? error.message
                    : "Failed to update contact",
                  { type: "error" },
                ),
              onSettled: () => setIsSaving(false),
            }}
          >
            <ContactFormDialogEditBody
              title={resolvedTitle}
              description={description}
              submitLabel={resolvedSubmitLabel}
              isSaving={isSaving}
              isMobile={isMobile}
              onClose={handleClose}
            />
          </EditBase>
        </DialogContent>
      </Dialog>
    );
  }

  if (deferCreate) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className={dialogShellClass}
          {...contactDialogContentProps}
        >
          <Form
            id="lbs-contact-form-deferred"
            className="flex min-h-0 flex-1 flex-col"
            defaultValues={defaultCreateValues(formLockCompanyId)}
            onSubmit={(values: Record<string, unknown>) => {
              const fullName = compactContactFullName(values);
              if (!hasCompactContactName(values)) {
                notify("First name is required", { type: "warning" });
                return;
              }
              onDraftSubmit?.({
                fullName,
                email: String(values._compact_email ?? "").trim(),
                phone: String(values._compact_phone ?? "").trim(),
              });
              handleClose();
            }}
          >
            <ContactFormDialogChrome
              title={resolvedTitle}
              description={
                description ||
                "Contact details are saved with the company — nothing is written until you create the company."
              }
              isSaving={false}
              isMobile={isMobile}
              onClose={handleClose}
              submitLabel={resolvedSubmitLabel}
            >
              <LbsContactFormFields
                variant="compact"
                lockCompanyId={formLockCompanyId}
              />
            </ContactFormDialogChrome>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={dialogShellClass}
        {...contactDialogContentProps}
      >
        <CreateBase
          resource="contacts"
          redirect={false}
          transform={(values: Record<string, unknown>): Partial<Contact> => {
            const compact = compactContactFieldsToPayload(values);
            const useCompact = hasCompactContactName(values);
            const now = new Date().toISOString();
            const effectiveLock =
              allowOrphanContact || deferCreate
                ? PENDING_COMPANY_LOCK
                : lockCompanyId;
            if (
              !allowOrphanContact &&
              !hasCompanySelection(values, effectiveLock)
            ) {
              throw new Error("Company is required");
            }
            const { companyId, companyDraft } = resolveContactCompanyForSave(
              values,
              effectiveLock,
            );
            return {
              first_name: useCompact
                ? compact.first_name
                : String(values.first_name ?? ""),
              last_name: useCompact
                ? compact.last_name
                : String(values.last_name ?? ""),
              company_id: companyId as Identifier | null,
              [COMPANY_DRAFT_NAME_FIELD]: companyDraft?.name ?? "",
              [COMPANY_DRAFT_SECTOR_FIELD]: companyDraft?.sector ?? "",
              status: String(values.status ?? LBS_CLIENT_STATUS),
              organization_member_id:
                (values.organization_member_id as Identifier | undefined) ??
                identity?.id,
              email_jsonb: useCompact
                ? compact.email_jsonb
                : (values.email_jsonb as Contact["email_jsonb"]),
              phone_jsonb: useCompact
                ? compact.phone_jsonb
                : (values.phone_jsonb as Contact["phone_jsonb"]),
              address: String(values.address ?? "") || null,
              background: String(values.background ?? ""),
              first_seen: now,
              last_seen: now,
              tags: [],
            };
          }}
          mutationOptions={{
            onMutate: () => setIsSaving(true),
            onSuccess: (record) => {
              notify("Contact created", { type: "info" });
              refresh();
              handleClose();
              const contact = record as Contact;
              onCreated?.(contact);
              if (navigateOnCreate && contact?.id != null) {
                navigate(getPersonShowPath(contact));
              }
            },
            onError: () =>
              notify("Failed to create contact", { type: "error" }),
            onSettled: () => setIsSaving(false),
          }}
        >
          <Form
            id="lbs-contact-form"
            key={createDefaults ? JSON.stringify(createDefaults) : "lbs-contact-form"}
            className="flex min-h-0 flex-1 flex-col"
            defaultValues={{
              ...defaultCreateValues(formLockCompanyId),
              ...createDefaults,
            }}
          >
            <ContactFormDialogChrome
              title={resolvedTitle}
              description={
                allowOrphanContact
                  ? "Creates a contact without a company. The new company form will link them on save."
                  : description
              }
              isSaving={isSaving}
              isMobile={isMobile}
              onClose={handleClose}
              submitLabel={resolvedSubmitLabel}
            >
              <LbsContactFormFields
                variant="compact"
                lockCompanyId={formLockCompanyId}
              />
            </ContactFormDialogChrome>
          </Form>
        </CreateBase>
      </DialogContent>
    </Dialog>
  );
};

const ContactFormDialogEditBody = ({
  title,
  description,
  submitLabel,
  isSaving,
  isMobile,
  onClose,
}: {
  title: string;
  description: string;
  submitLabel: string;
  isSaving: boolean;
  isMobile: boolean;
  onClose: () => void;
}) => {
  const { isPending, record } = useEditContext<Contact>();
  const translate = useTranslate();
  if (isPending || !record) {
    return (
      <ContactFormDialogChrome
        title={title}
        description={description}
        isSaving={false}
        isMobile={isMobile}
        onClose={onClose}
        submitLabel={submitLabel}
      >
        <p className="py-8 text-center text-sm text-muted-foreground">
          {translate("ra.page.loading", { _: "Loading…" })}
        </p>
      </ContactFormDialogChrome>
    );
  }

  return (
    <Form id="lbs-contact-form-edit" className="flex min-h-0 flex-1 flex-col">
      <ContactFormDialogChrome
        title={title}
        description={description}
        isSaving={isSaving}
        isMobile={isMobile}
        onClose={onClose}
        submitLabel={submitLabel}
      >
        <LbsContactFormFields variant="full" />
      </ContactFormDialogChrome>
    </Form>
  );
};
