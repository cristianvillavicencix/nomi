import { useQueryClient } from "@tanstack/react-query";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useListContext,
  useRedirect,
  type GetListResult,
} from "ra-core";
import { useSearchParams } from "react-router";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import {
  FormGuardProvider,
  useGuardedDialogClose,
} from "@/components/admin/form-guard";
import { FormToolbar } from "@/components/admin/simple-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { clearFormDraft } from "@/lib/formPersistence/formDraftStorage";
import {
  LBS_DEFAULT_AGENCY_PROJECT_TYPE,
  LBS_DEFAULT_AGENCY_STAGE,
  LBS_DEFAULT_DELIVERY_STATUS,
  LBS_DEFAULT_LIFECYCLE_PHASE,
  LBS_DEFAULT_PROJECT_PRIORITY,
} from "@/modules/deals/lbsAgencyProjectModel";
import { LBS_DEFAULT_PROJECT_CATEGORY } from "@/modules/deals/lbsProjectConstants";
import { emptyWebsiteBriefValues } from "@/modules/deals/websiteBriefSchema";

import type { Deal } from "../types";
import { DealInputs } from "./DealInputs";
import { normalizeProjectPayload } from "./projectForm";

const DEAL_CREATE_DRAFT_KEY = "crm:deal-create";

export const DealCreate = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose?: () => void;
}) => {
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const { data: allDeals } = useListContext<Deal>();

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    redirect("/deals");
  };

  const queryClient = useQueryClient();

  const onSuccess = async (deal: Deal) => {
    clearFormDraft(DEAL_CREATE_DRAFT_KEY);

    if (!allDeals) {
      if (onClose) {
        onClose();
      } else {
        redirect("/deals");
      }
      return;
    }
    // increase the index of all deals in the same stage as the new deal
    // first, get the list of deals in the same stage
    const deals = allDeals.filter(
      (d: Deal) => d.stage === deal.stage && d.id !== deal.id,
    );
    // update the actual deals in the database
    await Promise.all(
      deals.map(async (oldDeal) =>
        dataProvider.update("deals", {
          id: oldDeal.id,
          data: { index: oldDeal.index + 1 },
          previousData: oldDeal,
        }),
      ),
    );
    // refresh the list of deals in the cache as we used dataProvider.update(),
    // which does not update the cache
    const dealsById = deals.reduce(
      (acc, d) => ({
        ...acc,
        [d.id]: { ...d, index: d.index + 1 },
      }),
      {} as { [key: string]: Deal },
    );
    const now = Date.now();
    queryClient.setQueriesData<GetListResult | undefined>(
      { queryKey: ["deals", "getList"] },
      (res) => {
        if (!res) return res;
        return {
          ...res,
          data: res.data.map((d: Deal) => dealsById[d.id] || d),
        };
      },
      { updatedAt: now },
    );
    if (onClose) {
      onClose();
    } else {
      redirect("/deals");
    }
  };

  const { identity } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const presetCompanyId = searchParams.get("company_id");
  const presetContactId = searchParams.get("contact_id");

  if (!open) return null;

  return (
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
          estimated_value: undefined,
          amount: undefined,
          notes: "",
          website_brief: emptyWebsiteBriefValues(),
          company_id: presetCompanyId ? Number(presetCompanyId) : null,
          contact_id: presetContactId ? Number(presetContactId) : null,
          contact_ids: presetContactId ? [Number(presetContactId)] : [],
          salesperson_ids: [],
          subcontractor_ids: [],
          index: 0,
          pipeline_id: "default",
        }}
      >
        <FormGuardProvider draftKey={DEAL_CREATE_DRAFT_KEY} enabled>
          <DealCreateDialogShell onClose={handleClose} />
        </FormGuardProvider>
      </Form>
    </Create>
  );
};

const DealCreateDialogShell = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const guardedClose = useGuardedDialogClose((next) => {
    if (!next) onClose();
  });

  return (
    <Dialog open onOpenChange={guardedClose}>
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <DialogTitle className="text-2xl font-semibold">
          New Project
        </DialogTitle>
        <DialogDescription>
          Set up a website or digital marketing project with service details,
          budget, and goals.
        </DialogDescription>
        <DealInputs />
        <FormToolbar>
          <div className="flex justify-end">
            <SaveButton
              type="button"
              transform={normalizeProjectPayload}
              label="Save project"
            />
          </div>
        </FormToolbar>
      </DialogContent>
    </Dialog>
  );
};
