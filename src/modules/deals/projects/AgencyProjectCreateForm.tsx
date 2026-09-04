import { useMemo, useRef, useState, useEffect } from "react";
import {
  CreateBase,
  Form,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRedirect,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { useSearchParams } from "react-router";
import { Briefcase, Loader2 } from "lucide-react";
import { SaveButton } from "@/components/admin/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { isValidRecordId } from "@/lib/isValidRecordId";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { normalizeProjectPayload } from "@/components/atomic-crm/deals/projectForm";
import { LbsDealInputs } from "@/modules/deals/LbsDealInputs";
import {
  LBS_DEFAULT_AGENCY_PROJECT_TYPE,
  LBS_DEFAULT_AGENCY_STAGE,
  LBS_DEFAULT_DELIVERY_STATUS,
  LBS_DEFAULT_LIFECYCLE_PHASE,
  LBS_DEFAULT_PROJECT_PRIORITY,
} from "@/modules/deals/lbsAgencyProjectModel";
import { LBS_DEFAULT_PROJECT_CATEGORY } from "@/modules/deals/lbsProjectConstants";
import { emptyWebsiteBriefValues } from "@/modules/deals/websiteBriefSchema";
import { runProjectCreateAutomations } from "@/modules/deals/projects/projectStageAutomations";
import { DEFAULT_WEBSITE_CONTENT_PAGES } from "@/modules/deals/projects/websiteContentSchema";
import type { LbsDeal } from "@/modules/types";
import { CreateFormDialogShell } from "@/modules/shared/createForm/CreateFormDialogShell";
import {
  contactHasSmsPhone,
  getContactDisplayName,
} from "@/modules/messages/messageContactUtils";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { useSendClientSms } from "@/modules/messages/useClientSms";

const NEW_DEAL_FORM_ID = "lbs-new-deal-project-form";

const parsePresetId = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return isValidRecordId(parsed) ? parsed : null;
};

const buildProjectCreatedSms = (deal: Deal, contact: Contact) => {
  const firstName =
    contact.first_name?.trim() ||
    getContactDisplayName(contact).split(/\s+/)[0] ||
    "there";
  const projectName = String(deal.name ?? "").trim() || "your project";
  return `Hi ${firstName}, we started working on "${projectName}". We'll keep you updated.`;
};

const ProjectCreateNotifyOption = ({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) => {
  const contactId = useWatch({ name: "contact_id" });
  const selectedContactId = isValidRecordId(contactId)
    ? Number(contactId)
    : null;
  const { smsEnabled, isPending: messagingPending } = useMessagingEnabled();
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: selectedContactId as number },
    { enabled: selectedContactId != null },
  );

  const canSms =
    !messagingPending &&
    smsEnabled &&
    contact != null &&
    contactHasSmsPhone(contact);

  useEffect(() => {
    if (!canSms && checked) onCheckedChange(false);
  }, [canSms, checked, onCheckedChange]);

  return (
    <label
      className={cn(
        "flex items-center gap-2 text-sm",
        !canSms && "opacity-70",
      )}
    >
      <Checkbox
        checked={checked && canSms}
        disabled={disabled || !canSms}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span className="min-w-0">
        <span className="font-medium">Notify client</span>
        {!canSms ? (
          <span className="ml-1 text-xs text-muted-foreground">
            {selectedContactId == null
              ? "(select a contact with a phone)"
              : "(needs phone + SMS enabled)"}
          </span>
        ) : null}
      </span>
    </label>
  );
};

/** Agency project create — same field set as Edit project (`LbsDealInputs`). */
export const AgencyProjectCreateForm = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const isMobile = useIsMobile();
  const notify = useNotify();
  const redirect = useRedirect();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const sendClientSms = useSendClientSms();
  const { identity, isPending: identityPending } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [notifyClient, setNotifyClient] = useState(false);
  const notifyClientRef = useRef(false);
  notifyClientRef.current = notifyClient;

  const presetCompanyId = searchParams.get("company_id");
  const presetContactId = searchParams.get("contact_id");
  const presetProposalId = searchParams.get("proposal_id");

  const parsedContactId = useMemo(
    () => parsePresetId(presetContactId),
    [presetContactId],
  );
  const parsedCompanyId = useMemo(
    () => parsePresetId(presetCompanyId),
    [presetCompanyId],
  );
  const parsedProposalId = useMemo(
    () => parsePresetId(presetProposalId),
    [presetProposalId],
  );

  const {
    data: presetContact,
    isPending: presetContactPending,
    isError: presetContactError,
  } = useGetOne<Contact>(
    "contacts",
    { id: parsedContactId as number },
    { enabled: parsedContactId != null, retry: false },
  );

  const { data: presetCompany } = useGetOne<Company>(
    "companies",
    { id: parsedCompanyId as number },
    {
      enabled: parsedCompanyId != null && !presetContact?.company_name?.trim(),
      retry: false,
    },
  );

  const resolvedContactId =
    parsedContactId != null && presetContact && !presetContactError
      ? parsedContactId
      : null;

  const resolvedCompanyId =
    parsedCompanyId ??
    (presetContact?.company_id && isValidRecordId(presetContact.company_id)
      ? Number(presetContact.company_id)
      : null);

  const resolvedCompanyName =
    presetContact?.company_name?.trim() || presetCompany?.name?.trim() || "";

  const formReady =
    !identityPending && (parsedContactId == null || !presetContactPending);

  const formKey = `${identity?.id ?? "anon"}-${resolvedContactId ?? "none"}`;

  const defaultValues = useMemo(
    () => ({
      organization_member_id: identity?.id ?? null,
      category: LBS_DEFAULT_PROJECT_CATEGORY,
      stage: LBS_DEFAULT_AGENCY_STAGE,
      project_type: LBS_DEFAULT_AGENCY_PROJECT_TYPE,
      lifecycle_phase: LBS_DEFAULT_LIFECYCLE_PHASE,
      delivery_status: LBS_DEFAULT_DELIVERY_STATUS,
      priority: LBS_DEFAULT_PROJECT_PRIORITY,
      website_brief: emptyWebsiteBriefValues(),
      website_content: { pages: DEFAULT_WEBSITE_CONTENT_PAGES },
      company_id: resolvedCompanyId,
      company_name: resolvedCompanyName,
      contact_id: resolvedContactId,
      contact_ids: resolvedContactId ? [resolvedContactId] : [],
      accepted_proposal_id: parsedProposalId,
      name: "",
      description: "",
      notes: "",
      amount: null,
      estimated_value: null,
      expected_closing_date: null,
      start_date: null,
      expected_end_date: null,
      github_repo: "",
      salesperson_ids: [] as number[],
      subcontractor_ids: [] as number[],
      index: 0,
      pipeline_id: "default",
    }),
    [
      identity?.id,
      parsedProposalId,
      resolvedCompanyId,
      resolvedCompanyName,
      resolvedContactId,
    ],
  );

  const onSuccess = async (deal: Deal) => {
    if (identity?.id) {
      try {
        const count = await runProjectCreateAutomations({
          dataProvider,
          deal: deal as LbsDeal,
          organizationMemberId: identity.id,
        });
        if (count > 0) {
          notify(`${count} starter task${count === 1 ? "" : "s"} created`, {
            type: "info",
          });
        }
      } catch {
        /* non-blocking */
      }
    }

    const shouldNotify = notifyClientRef.current;
    const contactId =
      deal.contact_id != null
        ? Number(deal.contact_id)
        : Array.isArray(deal.contact_ids) && deal.contact_ids.length > 0
          ? Number(deal.contact_ids[0])
          : null;

    onClose();
    redirect(`/deals/${deal.id}/show`);

    if (!shouldNotify || !isValidRecordId(contactId)) return;

    void (async () => {
      try {
        const { data: contact } = await dataProvider.getOne<Contact>(
          "contacts",
          { id: contactId },
        );
        if (!contact || !contactHasSmsPhone(contact)) {
          notify("Project created, but the contact has no SMS phone", {
            type: "warning",
          });
          return;
        }
        await sendClientSms({
          contactId: contact.id,
          dealId: deal.id,
          body: buildProjectCreatedSms(deal, contact),
        });
        notify("Client notified by SMS", { type: "info" });
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : "Project created, but client SMS failed",
          { type: "warning" },
        );
      }
    })();
  };

  const handleClose = () => {
    setNotifyClient(false);
    onClose();
  };

  useEffect(() => {
    if (open) setNotifyClient(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "!flex max-h-[min(92vh,52rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-xl md:max-w-2xl",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        {!formReady ? (
          <div className="flex min-h-48 items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CreateBase
            resource="deals"
            redirect={false}
            mutationOptions={{
              onMutate: () => setIsSaving(true),
              onSuccess,
              onSettled: () => setIsSaving(false),
            }}
          >
            <Form
              id={NEW_DEAL_FORM_ID}
              key={formKey}
              className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
              defaultValues={defaultValues}
            >
              <CreateFormDialogShell
                icon={Briefcase}
                iconTone="slate"
                title="New project"
                description="Same fields as Edit project. Link a contact, set service type, timeline, and team."
                isSaving={isSaving}
                isMobile={isMobile}
                onClose={handleClose}
                submitLabel="Create project"
                footerNotice={
                  <ProjectCreateNotifyOption
                    checked={notifyClient}
                    onCheckedChange={setNotifyClient}
                    disabled={isSaving}
                  />
                }
                submitSlot={
                  <SaveButton
                    type="button"
                    transform={normalizeProjectPayload}
                    label="Create project"
                    disabled={isSaving}
                  />
                }
              >
                <LbsDealInputs
                  mode="create"
                  seedContact={presetContact ?? null}
                />
              </CreateFormDialogShell>
            </Form>
          </CreateBase>
        )}
      </DialogContent>
    </Dialog>
  );
};
