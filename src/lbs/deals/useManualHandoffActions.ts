import {
  useGetIdentity,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import {
  buildManualHandoffBriefUpdate,
  isBriefRequirementsWaived,
} from "@/lbs/deals/projectManualHandoff";
import type { LbsDeal } from "@/lbs/types";

export const useManualHandoffActions = (record: LbsDeal) => {
  const { data: identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending }] = useUpdate();

  const waived = isBriefRequirementsWaived(record);

  const setWaived = (enable: boolean) => {
    update(
      "deals",
      {
        id: record.id,
        data: {
          website_brief: buildManualHandoffBriefUpdate(
            record.website_brief,
            enable,
            identity?.id,
          ),
        },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify(
            enable
              ? "Manual handoff enabled — brief no longer blocks the pipeline"
              : "Brief requirements restored for this project",
            { type: "info" },
          );
          refresh();
        },
        onError: () =>
          notify("Could not update manual handoff setting", { type: "error" }),
      },
    );
  };

  return { waived, setWaived, isPending };
};
