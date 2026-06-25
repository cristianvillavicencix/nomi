import { useMemo, useState } from "react";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRedirect,
} from "ra-core";
import { useSearchParams } from "react-router";
import { Briefcase, Loader2 } from "lucide-react";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { isValidRecordId } from "@/lib/isValidRecordId";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import { normalizeProjectPayload } from "@/components/atomic-crm/deals/projectForm";
import { LbsDealCreateFields } from "@/modules/deals/LbsDealCreateFields";
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

const NEW_DEAL_FORM_ID = "lbs-new-deal-project-form";

const parsePresetId = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return isValidRecordId(parsed) ? parsed : null;
};

/** LBS agency project create dialog — single-step essentials matching the product mockup. */
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
  const dataProvider = useDataProvider();
  const { identity, isPending: identityPending } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);

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
      enabled:
        parsedCompanyId != null &&
        !presetContact?.company_name?.trim(),
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
      amount: null,
      estimated_value: null,
      expected_closing_date: null,
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

    onClose();
    redirect(`/deals/${deal.id}/show`);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
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
          <Create
            resource="deals"
            title={false}
            disableBreadcrumb
            mutationOptions={{
              onMutate: () => setIsSaving(true),
              onSuccess,
              onSettled: () => setIsSaving(false),
            }}
          >
            <Form
              id={NEW_DEAL_FORM_ID}
              key={formKey}
              className="flex min-h-0 flex-1 flex-col"
              defaultValues={defaultValues}
            >
              <CreateFormDialogShell
                icon={Briefcase}
                iconTone="slate"
                title="New deal / project"
                description="Link this deal to a contact. Search by name, email, or phone."
                isSaving={isSaving}
                isMobile={isMobile}
                onClose={handleClose}
                submitLabel="Create deal"
                submitSlot={
                  <SaveButton
                    type="button"
                    transform={normalizeProjectPayload}
                    label="Create deal"
                    disabled={isSaving}
                  />
                }
              >
                <LbsDealCreateFields
                  seedContact={presetContact ?? null}
                />
              </CreateFormDialogShell>
            </Form>
          </Create>
        )}
      </DialogContent>
    </Dialog>
  );
};
