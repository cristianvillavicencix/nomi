import { useMemo } from "react";
import { useNotify, useRefresh, useUpdate } from "ra-core";
import { Input } from "@/components/ui/input";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { resolveProjectDeploymentUrls } from "@/modules/deals/projects/projectDeploymentUrls";
import type { LbsDeal } from "@/modules/types";

export const ProjectDeploymentCard = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canEdit = useMemberCapability("crm.pipeline.edit");
  const [update] = useUpdate();
  const deploymentUrls = useMemo(
    () => resolveProjectDeploymentUrls(record),
    [record],
  );

  const saveFields = (patch: Partial<LbsDeal>) => {
    update(
      "deals",
      {
        id: record.id,
        data: patch,
        previousData: record,
      },
      {
        onSuccess: () => refresh(),
        onError: () =>
          notify("Could not save project details", { type: "error" }),
      },
    );
  };

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b bg-muted/20 px-4 py-3">
        <h3 className="text-sm font-semibold">Deployment URLs</h3>
      </div>

      <div className="space-y-4 p-4">
        {(["staging_url", "production_url"] as const).map((field) => {
          const label = field === "staging_url" ? "Staging" : "Production";
          const storedValue = record[field] ?? "";
          const effectiveValue =
            field === "production_url"
              ? deploymentUrls.productionUrl
              : deploymentUrls.stagingUrl;
          const displayValue = storedValue || effectiveValue;

          return (
            <div key={field} className="space-y-1">
              <div className="text-sm text-muted-foreground">{label}</div>
              {canEdit ? (
                <Input
                  value={displayValue}
                  placeholder={`https://${field === "staging_url" ? "staging" : "www"}.example.com`}
                  onChange={(event) =>
                    saveFields({ [field]: event.target.value || null })
                  }
                />
              ) : (
                <div className="text-sm font-medium break-all">
                  {displayValue || "—"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
