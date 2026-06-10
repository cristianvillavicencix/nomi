import type { Identifier } from "ra-core";
import {
  CreateBase,
  Form,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import { Loader2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
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
import { LBS_CLIENT_STATUS } from "@/lbs/navigation";
import { getPersonShowPath } from "@/lbs/routing";
import type { PrimaryContactDraft } from "@/lbs/clients/primaryContactDraft";
import {
  COMPANY_DRAFT_NAME_FIELD,
  COMPANY_DRAFT_SECTOR_FIELD,
  PRIMARY_MOVE_CONFIRMED_FIELD,
  hasCompanySelection,
  resolveContactCompanyForSave,
} from "@/lbs/contacts/companyDraft";
import {
  compactContactFieldsToPayload,
  LbsContactFormFields,
} from "@/lbs/contacts/LbsContactFormFields";

/** Hide company field in LbsContactFormFields while company is not created yet. */
export const PENDING_COMPANY_LOCK = "__pending_company__" as Identifier;

type ContactFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  onCreated?: (contact: Contact) => void;
  onDraftSubmit?: (draft: PrimaryContactDraft) => void;
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
  _compact_full_name: "",
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
  lockCompanyId,
  deferCreate = false,
  allowOrphanContact = false,
  title = "New contact",
  description = "Person linked to a client company. Company is required.",
  submitLabel = "Create contact",
  navigateOnCreate = true,
  onCreated,
  onDraftSubmit,
}: ContactFormDialogProps) => {
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => onOpenChange(false);

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

  if (deferCreate) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className={dialogShellClass}>
          <Form
            id="lbs-contact-form-deferred"
            className="flex min-h-0 flex-1 flex-col"
            defaultValues={defaultCreateValues(formLockCompanyId)}
            onSubmit={(values: Record<string, unknown>) => {
              const fullName = String(values._compact_full_name ?? "").trim();
              if (!fullName) {
                notify("Full name is required", { type: "warning" });
                return;
              }
              compactContactFieldsToPayload(values);
              onDraftSubmit?.({
                fullName,
                email: String(values._compact_email ?? "").trim(),
                phone: String(values._compact_phone ?? "").trim(),
              });
              handleClose();
            }}
          >
            <ContactFormDialogChrome
              title={title}
              description={
                description ||
                "Contact details are saved with the company — nothing is written until you create the company."
              }
              isSaving={false}
              isMobile={isMobile}
              onClose={handleClose}
              submitLabel={submitLabel}
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
      <DialogContent showCloseButton={false} className={dialogShellClass}>
        <CreateBase
          resource="contacts"
          redirect={false}
          transform={(values: Record<string, unknown>): Partial<Contact> => {
            const compact = compactContactFieldsToPayload(values);
            const useCompact =
              String(values._compact_full_name ?? "").trim().length > 0;
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
            className="flex min-h-0 flex-1 flex-col"
            defaultValues={defaultCreateValues(formLockCompanyId)}
          >
            <ContactFormDialogChrome
              title={title}
              description={
                allowOrphanContact
                  ? "Creates a contact without a company. The new company form will link them on save."
                  : description
              }
              isSaving={isSaving}
              isMobile={isMobile}
              onClose={handleClose}
              submitLabel={submitLabel}
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
