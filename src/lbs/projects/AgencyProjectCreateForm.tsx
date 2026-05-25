import { useState } from "react";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRedirect,
} from "ra-core";
import { useSearchParams } from "react-router";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Deal } from "@/components/atomic-crm/types";
import { normalizeProjectPayload } from "@/components/atomic-crm/deals/projectForm";
import { LbsDealInputs } from "@/lbs/deals/LbsDealInputs";
import {
  LBS_DEFAULT_AGENCY_PROJECT_TYPE,
  LBS_DEFAULT_AGENCY_STAGE,
  LBS_DEFAULT_DELIVERY_STATUS,
  LBS_DEFAULT_LIFECYCLE_PHASE,
  LBS_DEFAULT_PROJECT_PRIORITY,
} from "@/lbs/deals/lbsAgencyProjectModel";
import { LBS_DEFAULT_PROJECT_CATEGORY } from "@/lbs/deals/lbsProjectConstants";
import { emptyWebsiteBriefValues } from "@/lbs/deals/websiteBriefSchema";
import { runProjectCreateAutomations } from "@/lbs/projects/projectStageAutomations";
import { DEFAULT_WEBSITE_CONTENT_PAGES } from "@/lbs/projects/websiteContentSchema";
import type { LbsDeal } from "@/lbs/types";

const CREATE_STEPS = [
  { id: 1 as const, label: "Client & basics" },
  { id: 2 as const, label: "Timeline & team" },
];

const AgencyProjectCreateStepToolbar = ({
  step,
  onBack,
  onNext,
}: {
  step: 1 | 2;
  onBack: () => void;
  onNext: () => void;
}) => (
  <FormToolbar>
    <div className="flex w-full items-center justify-between gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={step === 1}
        onClick={onBack}
      >
        Back
      </Button>
      {step < 2 ? (
        <Button type="button" onClick={onNext}>
          Next
        </Button>
      ) : (
        <SaveButton
          transform={normalizeProjectPayload}
          label="Create project"
        />
      )}
    </div>
  </FormToolbar>
);

/** LBS agency project create dialog — multi-step, no contractor fields. */
export const AgencyProjectCreateForm = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const notify = useNotify();
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);

  const presetCompanyId = searchParams.get("company_id");
  const presetContactId = searchParams.get("contact_id");
  const presetProposalId = searchParams.get("proposal_id");

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

    setStep(1);
    onClose();
    redirect(`/deals/${deal.id}/show`);
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto lg:max-w-4xl">
        <DialogTitle className="text-2xl font-semibold">
          New agency project
        </DialogTitle>
        <DialogDescription>
          Step {step} of {CREATE_STEPS.length}: {CREATE_STEPS[step - 1].label}
        </DialogDescription>

        <div className="flex gap-2 pb-2">
          {CREATE_STEPS.map((entry) => (
            <div
              key={entry.id}
              className={`h-1 flex-1 rounded-full ${
                entry.id <= step ? "bg-primary" : "bg-muted"
              }`}
              aria-hidden
            />
          ))}
        </div>

        <Create
          resource="deals"
          title={false}
          disableBreadcrumb
          mutationOptions={{ onSuccess }}
        >
          <Form
            defaultValues={{
              organization_member_id: identity?.id,
              category: LBS_DEFAULT_PROJECT_CATEGORY,
              stage: LBS_DEFAULT_AGENCY_STAGE,
              project_type: LBS_DEFAULT_AGENCY_PROJECT_TYPE,
              lifecycle_phase: LBS_DEFAULT_LIFECYCLE_PHASE,
              delivery_status: LBS_DEFAULT_DELIVERY_STATUS,
              priority: LBS_DEFAULT_PROJECT_PRIORITY,
              website_brief: emptyWebsiteBriefValues(),
              website_content: { pages: DEFAULT_WEBSITE_CONTENT_PAGES },
              company_id: presetCompanyId ? Number(presetCompanyId) : null,
              contact_id: presetContactId ? Number(presetContactId) : null,
              contact_ids: presetContactId ? [Number(presetContactId)] : [],
              accepted_proposal_id: presetProposalId
                ? Number(presetProposalId)
                : null,
              salesperson_ids: [],
              subcontractor_ids: [],
              index: 0,
              pipeline_id: "default",
            }}
          >
            <LbsDealInputs createStep={step} />
            <AgencyProjectCreateStepToolbar
              step={step}
              onBack={() =>
                setStep((current) =>
                  current > 1 ? ((current - 1) as 1 | 2) : current,
                )
              }
              onNext={() =>
                setStep((current) =>
                  current < 2 ? ((current + 1) as 1 | 2) : current,
                )
              }
            />
          </Form>
        </Create>
      </DialogContent>
    </Dialog>
  );
};
