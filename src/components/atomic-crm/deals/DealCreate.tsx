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
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";

import type { Deal } from "../types";
import { DealInputs } from "./DealInputs";
import { syncProjectAssignments } from "./projectAssignments";
import { normalizeProjectPayload } from "./projectForm";

export const DealCreate = ({ open }: { open: boolean }) => {
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const { data: allDeals } = useListContext<Deal>();

  const handleClose = () => {
    redirect("/deals");
  };

  const queryClient = useQueryClient();

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
      redirect("/deals");
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
    redirect("/deals");
  };

  const { identity } = useGetIdentity();

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <DialogTitle className="text-2xl font-semibold">New Project</DialogTitle>
        <DialogDescription>
          Create and configure a construction project with contact, address, stage, and assignments.
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
              category: "retail",
              stage: "lead",
              project_type: "roofing",
              estimated_value: 0,
              notes: "",
              project_address: "",
              contact_id: null,
              contact_ids: [],
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
