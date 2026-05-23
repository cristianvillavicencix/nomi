import { useQueryClient } from "@tanstack/react-query";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useListContext,
  useNotify,
  useRedirect,
  type GetListResult,
} from "ra-core";
import { useSearchParams } from "react-router";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { isLbsMode } from "@/lbs/productMode";
import {
  LBS_DEFAULT_AGENCY_PROJECT_TYPE,
  LBS_DEFAULT_AGENCY_STAGE,
  LBS_DEFAULT_DELIVERY_STATUS,
  LBS_DEFAULT_LIFECYCLE_PHASE,
  LBS_DEFAULT_PROJECT_PRIORITY,
} from "@/lbs/deals/lbsAgencyProjectModel";
import {
  LBS_DEFAULT_PROJECT_CATEGORY,
} from "@/lbs/deals/lbsProjectConstants";
import { emptyWebsiteBriefValues } from "@/lbs/deals/websiteBriefSchema";

import type { Deal } from "../types";
import { DealInputs } from "./DealInputs";
import { syncProjectAssignments } from "./projectAssignments";
import { normalizeProjectPayload } from "./projectForm";

export const DealCreate = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose?: () => void;
}) => {
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const { data: allDeals } = useListContext<Deal>();

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    redirect("/deals");
  };

  const queryClient = useQueryClient();
  const lbsMode = isLbsMode();

  const onSuccess = async (deal: Deal) => {
    try {
      await syncProjectAssignments(
        dataProvider,
        deal.id,
        deal.salesperson_ids,
        deal.subcontractor_ids,
      );
    } catch {
      notify("Project saved, but assignments could not be fully synced", {
        type: "warning",
      });
    }

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

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <DialogTitle className="text-2xl font-semibold">New Project</DialogTitle>
        <DialogDescription>
          {lbsMode
            ? "Set up a website or digital marketing project with service details, budget, and goals."
            : "Create and configure a construction project with contact, address, stage, and assignments."}
        </DialogDescription>
        <Create
          resource="deals"
          title={false}
          disableBreadcrumb
          mutationOptions={{ onSuccess }}
        >
          <Form
            defaultValues={{
              organization_member_id: identity?.id,
              category: lbsMode ? LBS_DEFAULT_PROJECT_CATEGORY : "retail",
              stage: lbsMode ? LBS_DEFAULT_AGENCY_STAGE : "lead",
              project_type: lbsMode ? LBS_DEFAULT_AGENCY_PROJECT_TYPE : "roofing",
              lifecycle_phase: lbsMode ? LBS_DEFAULT_LIFECYCLE_PHASE : undefined,
              delivery_status: lbsMode ? LBS_DEFAULT_DELIVERY_STATUS : undefined,
              priority: lbsMode ? LBS_DEFAULT_PROJECT_PRIORITY : undefined,
              estimated_value: lbsMode ? undefined : 0,
              amount: lbsMode ? undefined : 0,
              notes: "",
              project_address: lbsMode ? undefined : "",
              website_brief: lbsMode ? emptyWebsiteBriefValues() : undefined,
              company_id: presetCompanyId ? Number(presetCompanyId) : null,
              contact_id: presetContactId ? Number(presetContactId) : null,
              contact_ids: presetContactId ? [Number(presetContactId)] : [],
              salesperson_ids: [],
              subcontractor_ids: [],
              index: 0,
              pipeline_id: "default",
            }}
          >
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
          </Form>
        </Create>
      </DialogContent>
    </Dialog>
  );
};
